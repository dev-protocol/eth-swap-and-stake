import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { ethers, waffle } from 'hardhat'
import { type SwapAndStakeV3Polygon, type ISwapRouter } from '../typechain'
import { type SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { type Contract, type BigNumber } from 'ethers'
import * as dotenv from 'dotenv'

dotenv.config()
const RPC_KEY =
	typeof process.env.ALCHEMY_KEY === 'undefined' ? '' : process.env.ALCHEMY_KEY

use(solidity)

describe('SwapAndStakeV3 Polygon', () => {
	let account1: SignerWithAddress
	let gateway: SignerWithAddress
	let swapAndStakeContract: SwapAndStakeV3Polygon
	let lockupContract: Contract
	let sTokensManagerContract: Contract

	// Polygon
	const wethAddress = '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'
	const devAddress = '0xA5577D1cec2583058A6Bd6d5DEAC44797c205701'
	const lockupAddress = '0x42767B12d3f07bE0D951a64eE6573B40Ff165C4e'
	const propertyAddress = '0x803854e0676cd5892f6100eb452551D22e9c38ec'
	const sTokensManagerAddress = '0x89904De861CDEd2567695271A511B3556659FfA2'
	const SwapRouterAddress = '0xE592427A0AEce92De3Edee1F18E0157C05861564'
	const WMATICAddress = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'
	let wethContract: Contract
	let swapRouter: ISwapRouter

	beforeEach(async () => {
		await ethers.provider.send('hardhat_reset', [
			{
				forking: {
					jsonRpcUrl: 'https://polygon-mainnet.g.alchemy.com/v2/' + RPC_KEY,
					blockNumber: 58590400,
				},
			},
		])

		const accounts = await ethers.getSigners()
		account1 = accounts[0]
		gateway = accounts[1]

		const factory = await ethers.getContractFactory('SwapAndStakeV3Polygon')
		swapAndStakeContract = (await factory.deploy(
			wethAddress,
			devAddress,
			lockupAddress,
			sTokensManagerAddress
		)) as SwapAndStakeV3Polygon

		await swapAndStakeContract.deployed()

		wethContract = new ethers.Contract(
			wethAddress,
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
	describe('swap eth for dev', () => {
		it('should stake eth for dev', async () => {
			// Get latest block
			const block = await waffle.provider.getBlock('latest')
			const deadline = block.timestamp + 300

			// Get WETH via MATIC(Native Token) -> wMATIC -> WETH
			await swapRouter.connect(account1).exactInputSingle(
				{
					tokenIn: WMATICAddress,
					tokenOut: wethAddress,
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

			// Approve WETH to SwapAndStakeV3
			await wethContract
				.connect(account1)
				.approve(swapAndStakeContract.address, ethers.utils.parseEther('1'))

			// Use callStaic to execute getEstimatedDevForEth as a read method
			const amountOut =
				await swapAndStakeContract.callStatic.getEstimatedDevForEth(
					ethers.utils.parseEther('0.00001')
				)
			const amountIn =
				await swapAndStakeContract.callStatic.getEstimatedEthForDev(amountOut)
			expect(amountIn).to.equal(ethers.utils.parseEther('0.00001'))

			// STokenId = currentIndex + 1 will be minted.
			let sTokenId: BigNumber = await sTokensManagerContract.currentIndex()
			sTokenId = sTokenId.add(1)
			await expect(
				await swapAndStakeContract[
					'swapEthAndStakeDev(address,uint256,uint256,bytes32)'
				](
					propertyAddress,
					ethers.utils.parseEther('0.00001'),
					deadline,
					ethers.utils.formatBytes32String('payload')
				)
			)
				.to.emit(lockupContract, 'Lockedup')
				.withArgs(
					swapAndStakeContract.address,
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

		it('should stake eth for dev and deduct gateway fee', async () => {
			// Get latest block
			const block = await waffle.provider.getBlock('latest')
			const deadline = block.timestamp + 300
			// Get WETH via MATIC(Native Token) -> wMATIC -> WETH
			await swapRouter.connect(account1).exactInputSingle(
				{
					tokenIn: WMATICAddress,
					tokenOut: wethAddress,
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

			// Approve WETH to SwapAndStakeV3
			await wethContract
				.connect(account1)
				.approve(swapAndStakeContract.address, ethers.utils.parseEther('1'))

			const gatewayFeeBasisPoints = 333 // In basis points, so 3.33%
			const depositAmount = ethers.utils.parseEther('0.00001')
			const feeAmount = depositAmount.mul(gatewayFeeBasisPoints).div(10000)
			const amountOut =
				await swapAndStakeContract.callStatic.getEstimatedDevForEth(
					depositAmount.sub(feeAmount)
				)
			const amountIn =
				await swapAndStakeContract.callStatic.getEstimatedEthForDev(amountOut)
			expect(amountIn).to.equal(depositAmount.sub(feeAmount))

			let sTokenId: BigNumber = await sTokensManagerContract.currentIndex()

			sTokenId = sTokenId.add(1)
			await expect(
				swapAndStakeContract[
					'swapEthAndStakeDev(address,uint256,uint256,bytes32,address,uint256)'
				](
					propertyAddress,
					depositAmount,
					deadline,
					ethers.constants.HashZero,
					gateway.address,
					gatewayFeeBasisPoints
				)
			)
				.to.emit(lockupContract, 'Lockedup')
				.withArgs(
					swapAndStakeContract.address,
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
				await swapAndStakeContract.gatewayFees(gateway.address, wethAddress)
			).to.eq(feeAmount)

			// Withdraw credit
			await expect(swapAndStakeContract.connect(gateway).claim(wethAddress))
				.to.emit(swapAndStakeContract, 'Withdrawn')
				.withArgs(gateway.address, wethAddress, feeAmount)

			// Check gateway credit has been deducted
			expect(
				await swapAndStakeContract.gatewayFees(gateway.address, wethAddress)
			).to.eq(0)
		})
	})
})
