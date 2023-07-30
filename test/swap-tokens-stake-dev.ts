import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { ethers, waffle } from 'hardhat'
import { type SwapTokensAndStakeDev, type ISwapRouter } from '../typechain'
import { type SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { deployWithProxy } from './utils'
import { type Contract, type BigNumber } from 'ethers'
import * as dotenv from 'dotenv'

dotenv.config()

use(solidity)

type Path = {
	token1: string
	fee1: number
	token2: string
	fee2: number
	token3: string
}

describe('SwapTokensAndStakeDev', () => {
	let account1: SignerWithAddress
	let gateway: SignerWithAddress
	let lockupContract: Contract
	let sTokensManagerContract: Contract

	// Polygon
	const usdcAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174'
	const wethAddress = '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'
	const weth9 = '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270'
	const devAddress = '0xA5577D1cec2583058A6Bd6d5DEAC44797c205701'
	const lockupAddress = '0x42767B12d3f07bE0D951a64eE6573B40Ff165C4e'
	const propertyAddress = '0x803854e0676cd5892f6100eb452551D22e9c38ec'
	const sTokensManagerAddress = '0x89904De861CDEd2567695271A511B3556659FfA2'
	const SwapRouterAddress = '0xE592427A0AEce92De3Edee1F18E0157C05861564'
	let usdcContract: Contract
	let swapRouter: ISwapRouter

	beforeEach(async () => {
		await ethers.provider.send('hardhat_reset', [
			{
				forking: {
					jsonRpcUrl: 'https://polygon-rpc.com/',
					blockNumber: 45237517,
				},
			},
		])

		const accounts = await ethers.getSigners()
		account1 = accounts[0]
		gateway = accounts[1]

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
	describe('SwapTokensAndStakeDev', () => {
		describe('initialize', () => {
			it('success:initializing', async () => {
				const [cont, admin] = await deployWithProxy<SwapTokensAndStakeDev>(
					'SwapTokensAndStakeDev'
				)
				const [addr1] = await ethers.getSigners()
				await cont.initialize(devAddress, lockupAddress, sTokensManagerAddress)
				expect(admin).to.equal(addr1.address)
			})

			it('fail:should fail to initialize when already initialized', async () => {
				const [cont] = await deployWithProxy<SwapTokensAndStakeDev>(
					'SwapTokensAndStakeDev'
				)
				await cont.initialize(devAddress, lockupAddress, sTokensManagerAddress)

				await expect(
					cont.initialize(devAddress, lockupAddress, sTokensManagerAddress)
				).to.be.revertedWith('Initializable: contract is already initialized')
			})
		})
		describe('ERC-20 swapping', () => {
			it('should swap token and stake dev', async () => {
				// Get latest block
				const block = await waffle.provider.getBlock('latest')
				const deadline = block.timestamp + 300
				const [cont] = await deployWithProxy<SwapTokensAndStakeDev>(
					'SwapTokensAndStakeDev'
				)
				await cont.initialize(devAddress, lockupAddress, sTokensManagerAddress)

				// Get USDC via MATIC(Native Token) -> wMATIC -> USDC
				await swapRouter.connect(account1).exactInputSingle(
					{
						tokenIn: weth9,
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

				// Approve USDC
				await usdcContract
					.connect(account1)
					.approve(cont.address, ethers.utils.parseUnits('1900', 6))

				const path: Path = {
					token1: usdcAddress,
					fee1: 500,
					token2: wethAddress,
					fee2: 10000,
					token3: devAddress,
				}

				// Use callStaic to execute getEstimatedDevForUsdc as a read method
				const amountOut = await cont.callStatic.getEstimatedDevForTokens(
					ethers.utils.solidityPack(
						['address', 'uint24', 'address', 'uint24', 'address'],
						[path.token1, path.fee1, path.token2, path.fee2, path.token3]
					),
					ethers.utils.parseUnits('1', 6)
				)

				const amountIn = await cont.callStatic.getEstimatedTokensForDev(
					ethers.utils.solidityPack(
						['address', 'uint24', 'address', 'uint24', 'address'],
						[path.token3, path.fee2, path.token2, path.fee1, path.token1]
					),
					amountOut
				)

				// Assuming only 1% slippage, it can be dynamic so need to make more better assertion
				const expected = ethers.utils.parseUnits('1', 6)
				expect(amountIn).to.lte(expected.sub(expected.mul(1).div(100)))
				// STokenId = currentIndex + 1 will be minted.
				let sTokenId: BigNumber = await sTokensManagerContract.currentIndex()
				sTokenId = sTokenId.add(1)

				await expect(
					await cont
						.connect(account1)
						[
							'swapTokensAndStakeDev(address,address,bytes,address,uint256,uint256,uint256,bytes32)'
						](
							account1.address,
							usdcAddress,
							ethers.utils.solidityPack(
								['address', 'uint24', 'address', 'uint24', 'address'],
								[path.token1, path.fee1, path.token2, path.fee2, path.token3]
							),
							propertyAddress,
							ethers.utils.parseUnits('1', 6),
							amountOut,
							deadline,
							ethers.utils.formatBytes32String('')
						)
				)
					.to.emit(lockupContract, 'Lockedup')
					.withArgs(cont.address, propertyAddress, amountOut, sTokenId)

				const sTokenOwner = await sTokensManagerContract.ownerOf(sTokenId)
				const sTokenPosition: number[] = await sTokensManagerContract.positions(
					sTokenId
				)
				expect(sTokenOwner).to.equal(account1.address)
				expect(sTokenPosition[1]).to.equal(amountOut)
			})
			it('should stake dev by swapping tokens and deduct gateway fee', async () => {
				// Get latest block
				const block = await waffle.provider.getBlock('latest')
				const deadline = block.timestamp + 300

				const [cont] = await deployWithProxy<SwapTokensAndStakeDev>(
					'SwapTokensAndStakeDev'
				)
				await cont.initialize(devAddress, lockupAddress, sTokensManagerAddress)

				// Get USDC via MATIC(Native Token) -> wMATIC -> USDC
				await swapRouter.connect(account1).exactInputSingle(
					{
						tokenIn: weth9,
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

				// Approve USDC
				await usdcContract
					.connect(account1)
					.approve(cont.address, ethers.utils.parseUnits('1900', 6))

				const gatewayFeeBasisPoints = 333 // In basis points, so 3.33%
				const depositAmount = ethers.utils.parseUnits('1', 6)
				const feeAmount = depositAmount.mul(gatewayFeeBasisPoints).div(10000)

				const path: Path = {
					token1: usdcAddress,
					fee1: 500,
					token2: wethAddress,
					fee2: 10000,
					token3: devAddress,
				}

				// Use callStaic to execute getEstimatedDevForUsdc as a read method
				const amountOut = await cont.callStatic.getEstimatedDevForTokens(
					ethers.utils.solidityPack(
						['address', 'uint24', 'address', 'uint24', 'address'],
						[path.token1, path.fee1, path.token2, path.fee2, path.token3]
					),
					depositAmount.sub(feeAmount)
				)

				const amountIn = await cont.callStatic.getEstimatedTokensForDev(
					ethers.utils.solidityPack(
						['address', 'uint24', 'address', 'uint24', 'address'],
						[path.token3, path.fee2, path.token2, path.fee1, path.token1]
					),
					amountOut
				)

				// Assuming only 1% slippage, it can be dynamic so need to make more better assertion
				const expected = ethers.utils.parseUnits('1', 6)
				expect(amountIn).to.lte(expected.sub(expected.mul(1).div(100)))
				// STokenId = currentIndex + 1 will be minted.
				let sTokenId: BigNumber = await sTokensManagerContract.currentIndex()
				sTokenId = sTokenId.add(1)

				await expect(
					await cont
						.connect(account1)
						[
							'swapTokensAndStakeDev(address,address,bytes,address,uint256,uint256,uint256,bytes32,address,uint256)'
						](
							account1.address,
							usdcAddress,
							ethers.utils.solidityPack(
								['address', 'uint24', 'address', 'uint24', 'address'],
								[path.token1, path.fee1, path.token2, path.fee2, path.token3]
							),
							propertyAddress,
							ethers.utils.parseUnits('1', 6),
							amountOut,
							deadline,
							ethers.utils.formatBytes32String(''),
							gateway.address,
							gatewayFeeBasisPoints
						)
				)
					.to.emit(lockupContract, 'Lockedup')
					.withArgs(cont.address, propertyAddress, amountOut, sTokenId)

				const sTokenOwner = await sTokensManagerContract.ownerOf(sTokenId)
				const sTokenPosition: number[] = await sTokensManagerContract.positions(
					sTokenId
				)
				expect(sTokenOwner).to.equal(account1.address)
				expect(sTokenPosition[1]).to.equal(amountOut)

				// Check gateway has been credited
				expect(await cont.gatewayFees(gateway.address, usdcAddress)).to.eq(
					feeAmount
				)

				// Withdraw credit
				await expect(cont.connect(gateway).claim(usdcAddress))
					.to.emit(cont, 'Withdrawn')
					.withArgs(gateway.address, usdcAddress, feeAmount)

				// Check gateway credit has been deducted
				expect(await cont.gatewayFees(gateway.address, usdcAddress)).to.eq(0)
			})
		})
		describe('Native token swapping', () => {
			it('should swap native token and stake dev', async () => {
				// Get latest block
				const block = await waffle.provider.getBlock('latest')
				const deadline = block.timestamp + 300
				const [cont] = await deployWithProxy<SwapTokensAndStakeDev>(
					'SwapTokensAndStakeDev'
				)
				await cont.initialize(devAddress, lockupAddress, sTokensManagerAddress)

				const path: Path = {
					token1: weth9,
					fee1: 500,
					token2: wethAddress,
					fee2: 10000,
					token3: devAddress,
				}

				// Use callStaic to execute getEstimatedDevForUsdc as a read method
				const amountOut = await cont.callStatic.getEstimatedDevForTokens(
					ethers.utils.solidityPack(
						['address', 'uint24', 'address', 'uint24', 'address'],
						[path.token1, path.fee1, path.token2, path.fee2, path.token3]
					),
					ethers.utils.parseEther('1')
				)

				const amountIn = await cont.callStatic.getEstimatedTokensForDev(
					ethers.utils.solidityPack(
						['address', 'uint24', 'address', 'uint24', 'address'],
						[path.token3, path.fee2, path.token2, path.fee1, path.token1]
					),
					amountOut
				)

				// Assuming only 1% slippage, it can be dynamic so need to make more better assertion
				const expected = ethers.utils.parseEther('1')
				expect(amountIn).to.lte(expected.sub(expected.mul(1).div(100)))
				// STokenId = currentIndex + 1 will be minted.
				let sTokenId: BigNumber = await sTokensManagerContract.currentIndex()
				sTokenId = sTokenId.add(1)

				await expect(
					await cont
						.connect(account1)
						[
							'swapTokensAndStakeDev(address,bytes,address,uint256,uint256,bytes32)'
						](
							account1.address,
							ethers.utils.solidityPack(
								['address', 'uint24', 'address', 'uint24', 'address'],
								[path.token1, path.fee1, path.token2, path.fee2, path.token3]
							),
							propertyAddress,
							amountOut,
							deadline,
							ethers.utils.formatBytes32String(''),
							{
								value: ethers.utils.parseEther('1'),
							}
						)
				)
					.to.emit(lockupContract, 'Lockedup')
					.withArgs(cont.address, propertyAddress, amountOut, sTokenId)
			})
			it('should stake dev by swapping native token and deduct gateway fee', async () => {
				// Get latest block
				const block = await waffle.provider.getBlock('latest')
				const deadline = block.timestamp + 300

				const gatewayFeeBasisPoints = 333 // In basis points, so 3.33%
				const depositAmount = ethers.utils.parseEther('1')
				const feeAmount = depositAmount.mul(gatewayFeeBasisPoints).div(10000)

				const [cont] = await deployWithProxy<SwapTokensAndStakeDev>(
					'SwapTokensAndStakeDev'
				)
				await cont.initialize(devAddress, lockupAddress, sTokensManagerAddress)

				const path: Path = {
					token1: weth9,
					fee1: 500,
					token2: wethAddress,
					fee2: 10000,
					token3: devAddress,
				}

				// Use callStaic to execute getEstimatedDevForUsdc as a read method
				const amountOut = await cont.callStatic.getEstimatedDevForTokens(
					ethers.utils.solidityPack(
						['address', 'uint24', 'address', 'uint24', 'address'],
						[path.token1, path.fee1, path.token2, path.fee2, path.token3]
					),
					depositAmount.sub(feeAmount)
				)

				const amountIn = await cont.callStatic.getEstimatedTokensForDev(
					ethers.utils.solidityPack(
						['address', 'uint24', 'address', 'uint24', 'address'],
						[path.token3, path.fee2, path.token2, path.fee1, path.token1]
					),
					amountOut
				)

				// Assuming only 1% slippage, it can be dynamic so need to make more better assertion
				const expected = ethers.utils.parseEther('1')
				expect(amountIn).to.lte(expected.sub(expected.mul(1).div(100)))
				// STokenId = currentIndex + 1 will be minted.
				let sTokenId: BigNumber = await sTokensManagerContract.currentIndex()
				sTokenId = sTokenId.add(1)

				await expect(
					await cont
						.connect(account1)
						[
							'swapTokensAndStakeDev(address,bytes,address,uint256,uint256,bytes32,address,uint256)'
						](
							account1.address,
							ethers.utils.solidityPack(
								['address', 'uint24', 'address', 'uint24', 'address'],
								[path.token1, path.fee1, path.token2, path.fee2, path.token3]
							),
							propertyAddress,
							amountOut,
							deadline,
							ethers.utils.formatBytes32String(''),
							gateway.address,
							gatewayFeeBasisPoints,
							{
								value: ethers.utils.parseEther('1'),
							}
						)
				)
					.to.emit(lockupContract, 'Lockedup')
					.withArgs(cont.address, propertyAddress, amountOut, sTokenId)
				const sTokenOwner = await sTokensManagerContract.ownerOf(sTokenId)
				const sTokenPosition: number[] = await sTokensManagerContract.positions(
					sTokenId
				)
				expect(sTokenOwner).to.equal(account1.address)
				expect(sTokenPosition[1]).to.equal(amountOut)
				// Check gateway has been credited
				expect(
					await cont.gatewayFees(gateway.address, ethers.constants.AddressZero)
				).to.eq(feeAmount)

				// Withdraw credit
				await expect(cont.connect(gateway).claim(ethers.constants.AddressZero))
					.to.emit(cont, 'Withdrawn')
					.withArgs(gateway.address, ethers.constants.AddressZero, feeAmount)
				// Check gateway credit has been deducted
				expect(
					await cont.gatewayFees(gateway.address, ethers.constants.AddressZero)
				).to.eq(0)
			})
		})
	})
})
