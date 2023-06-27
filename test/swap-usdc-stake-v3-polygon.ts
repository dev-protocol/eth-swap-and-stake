import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { ethers, waffle } from 'hardhat'
import { SwapUsdcAndStakeV3Polygon, ISwapRouter } from '../typechain'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract, BigNumber } from 'ethers'
import * as dotenv from 'dotenv'

dotenv.config()

const alchemyKeyPolygon =
	typeof process.env.ALCHEMY_KEY_POLYGON === 'undefined'
		? ''
		: process.env.ALCHEMY_KEY_POLYGON

use(solidity)

describe('SwapUsdcAndStakeV3 Polygon', () => {
	let account1: SignerWithAddress
	let gateway: SignerWithAddress
	let swapUsdcAndStakeContract: SwapUsdcAndStakeV3Polygon
	let lockupContract: Contract
	let sTokensManagerContract: Contract

	// Polygon
    const usdcAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
	const wethAddress = '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'
	const devAddress = '0xA5577D1cec2583058A6Bd6d5DEAC44797c205701'
	const lockupAddress = '0x42767B12d3f07bE0D951a64eE6573B40Ff165C4e'
	const propertyAddress = '0x803854e0676cd5892f6100eb452551D22e9c38ec'
	const sTokensManagerAddress = '0x89904De861CDEd2567695271A511B3556659FfA2'
	const SwapRouterAddress = '0xE592427A0AEce92De3Edee1F18E0157C05861564'
	const WMATICAddress = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'
	let usdcContract: Contract
	let swapRouter: ISwapRouter

	beforeEach(async () => {
		await ethers.provider.send('hardhat_reset', [
			{
				forking: {
					jsonRpcUrl:
						'https://polygon-mainnet.g.alchemy.com/v2/' + alchemyKeyPolygon,
					blockNumber: 44358690,
				},
			},
		])

		const accounts = await ethers.getSigners()
		account1 = accounts[0]
		gateway = accounts[1]

		const factory = await ethers.getContractFactory('SwapUsdcAndStakeV3Polygon')
		swapUsdcAndStakeContract = (await factory.deploy(
            usdcAddress,
			wethAddress,
			devAddress,
			lockupAddress,
			sTokensManagerAddress
		)) as SwapUsdcAndStakeV3Polygon


		await swapUsdcAndStakeContract.deployed()

		usdcContract = new ethers.Contract(
			usdcAddress,
			[
				'function balanceOf(address owner) view returns (uint256)',
				'function approve(address spender, uint256 amount) public returns (bool)',
				'function transfer(address to, uint256 amount) external returns (bool)',
			],
			ethers.provider
		)
		swapRouter = (await ethers.getContractAt(
			'@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol:ISwapRouter',
			SwapRouterAddress
		)) as ISwapRouter

		lockupContract = await ethers.getContractAt(
			'contracts/interfaces/ILockup.sol:ILockup',
			lockupAddress
		)
		sTokensManagerContract = await ethers.getContractAt(
			'contracts/interfaces/ISTokensManager.sol:ISTokensManager',
			sTokensManagerAddress
		)
	})
	describe('swap usdc for dev', () => {
		it('should stake dev for usdc', async () => {
			// Get latest block
			const block = await waffle.provider.getBlock('latest')
			const deadline = block.timestamp + 300

			// Get USDC via MATIC(Native Token) -> wMATIC -> USDC
			await swapRouter.connect(account1).exactInputSingle(
				{
					tokenIn: WMATICAddress,
					tokenOut: usdcAddress,
					fee: 3000,
					recipient: account1.address,
					deadline,
					amountIn: ethers.utils.parseEther('1700'),
					amountOutMinimum: 0,
					sqrtPriceLimitX96: 0,
				},
				{
					value: ethers.utils.parseEther('1700'),
				}
			)

			// Approve USDC to SwapAndStakeV3
			await usdcContract
				.connect(account1)
				.approve(swapUsdcAndStakeContract.address, ethers.utils.parseUnits('100', 6))

			// Use callStaic to execute getEstimatedDevForUsdc as a read method
			const amountOut =
				await swapUsdcAndStakeContract.callStatic.getEstimatedDevForUsdc(
					ethers.utils.parseUnits('1', 6)
				)
			console.log('amountOut', amountOut.toString())
			const amountIn =
				await swapUsdcAndStakeContract.callStatic.getEstimatedUsdcForDev(amountOut)
			console.log('amountIn', amountIn.toString())
			// Assuming only 1% slippage, it can be dynamic so need to make more better assertion
			const expected = ethers.utils.parseUnits('1', 6)
			expect(amountIn).to.lte((expected.sub(expected.mul(1).div(100))))
			
			// STokenId = currentIndex + 1 will be minted.
			let sTokenId: BigNumber = await sTokensManagerContract.currentIndex()
			sTokenId = sTokenId.add(1)
			await expect(
				await swapUsdcAndStakeContract.connect(account1)[
					'swapUsdcAndStakeDev(address,uint256,uint256,uint256,bytes32)'
				](
					propertyAddress,
					ethers.utils.parseUnits('1', 6),
					amountOut,
					deadline,
					ethers.utils.formatBytes32String('payload')
				)
			)
				.to.emit(lockupContract, 'Lockedup')
				.withArgs(
					swapUsdcAndStakeContract.address,
					propertyAddress,
					amountOut,
					sTokenId
				)

			const sTokenOwner = await sTokensManagerContract.ownerOf(sTokenId)
			const sTokenPosition: number[] = await sTokensManagerContract.positions(
				sTokenId
			)
			expect(sTokenOwner).to.equal(account1.address)
			expect(sTokenPosition[1]).to.equal(amountOut)
		})

		it('should stake usdc for dev and deduct gateway fee', async () => {
			// Get latest block
			const block = await waffle.provider.getBlock('latest')
			const deadline = block.timestamp + 300

			// Get USDC via MATIC(Native Token) -> wMATIC -> USDC
			await swapRouter.connect(account1).exactInputSingle(
				{
					tokenIn: WMATICAddress,
					tokenOut: usdcAddress,
					fee: 3000,
					recipient: account1.address,
					deadline,
					amountIn: ethers.utils.parseEther('1700'),
					amountOutMinimum: 0,
					sqrtPriceLimitX96: 0,
				},
				{
					value: ethers.utils.parseEther('1700'),
				}
			)

			// Approve USDC to SwapAndStakeV3
			await usdcContract
				.connect(account1)
				.approve(swapUsdcAndStakeContract.address, ethers.utils.parseEther('1'))

			const gatewayFeeBasisPoints = 333 // In basis points, so 3.33%
			const depositAmount = ethers.utils.parseUnits('1', 6)
			const feeAmount = depositAmount.mul(gatewayFeeBasisPoints).div(10000)
			const amountOut =
				await swapUsdcAndStakeContract.callStatic.getEstimatedDevForUsdc(
					depositAmount.sub(feeAmount)
				)
			const amountIn =
				await swapUsdcAndStakeContract.callStatic.getEstimatedUsdcForDev(amountOut)
			const expected = ethers.utils.parseUnits('1', 6)
			// Assuming only 1% slippage, it can be dynamic so need to make more better assertion
			expect(amountIn).to.lte((expected.sub(expected.mul(1).div(100))))

			let sTokenId: BigNumber = await sTokensManagerContract.currentIndex()

			sTokenId = sTokenId.add(1)
			await expect(
				swapUsdcAndStakeContract[
					'swapUsdcAndStakeDev(address,uint256,uint256,uint256,bytes32,address,uint256)'
				](
					propertyAddress,
					depositAmount,
					amountOut,
					deadline,
					ethers.constants.HashZero,
					gateway.address,
					gatewayFeeBasisPoints
				)
			)
				.to.emit(lockupContract, 'Lockedup')
				.withArgs(
					swapUsdcAndStakeContract.address,
					propertyAddress,
					amountOut,
					sTokenId
				)

			const sTokenOwner = await sTokensManagerContract.ownerOf(sTokenId)
			const sTokenPosition: number[] = await sTokensManagerContract.positions(
				sTokenId
			)
			expect(sTokenOwner).to.equal(account1.address)
			expect(sTokenPosition[1]).to.equal(amountOut)

			// Check gateway has been credited
			expect(
				await swapUsdcAndStakeContract.gatewayFees(gateway.address, usdcAddress)
			).to.eq(feeAmount)

			// Withdraw credit
			await expect(swapUsdcAndStakeContract.connect(gateway).claim(usdcAddress))
				.to.emit(swapUsdcAndStakeContract, 'Withdrawn')
				.withArgs(gateway.address, usdcAddress, feeAmount)

			// Check gateway credit has been deducted
			expect(
				await swapUsdcAndStakeContract.gatewayFees(
					gateway.address,
					usdcAddress
				)
			).to.eq(0)
		})
	})
})
