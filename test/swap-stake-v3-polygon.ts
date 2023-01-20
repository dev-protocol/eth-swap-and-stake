import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { ethers, waffle } from 'hardhat'
import { SwapAndStakeV3 } from '../typechain'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract, BigNumber } from 'ethers'
import * as dotenv from 'dotenv'

dotenv.config()

const alchemyKeyPolygon =
	typeof process.env.ALCHEMY_KEY_POLYGON === 'undefined'
		? ''
		: process.env.ALCHEMY_KEY_POLYGON

use(solidity)

describe('SwapAndStakeV3 Polygon', () => {
	let account1: SignerWithAddress
	let gateway: SignerWithAddress
	let swapAndStakeContract: SwapAndStakeV3
	let lockupContract: Contract
	let sTokensManagerContract: Contract

	// Polygon
	const wethAddress = '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'
	const devAddress = '0xA5577D1cec2583058A6Bd6d5DEAC44797c205701'
	const lockupAddress = '0x42767B12d3f07bE0D951a64eE6573B40Ff165C4e'
	const propertyAddress = '0x803854e0676cd5892f6100eb452551D22e9c38ec'
	const sTokensManagerAddress = '0x89904De861CDEd2567695271A511B3556659FfA2'

	beforeEach(async () => {
		await ethers.provider.send('hardhat_reset', [
			{
				forking: {
					jsonRpcUrl:
						'https://arb-mainnet.g.alchemy.com/v2/' + alchemyKeyPolygon,
					blockNumber: 38312540,
				},
			},
		])

		const accounts = await ethers.getSigners()

		// WETH Maxi
		// const impersonatedSigner1 = await ethers.getImpersonatedSigner("0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619");

		account1 = accounts[0]
		gateway = accounts[1]

		const factory = await ethers.getContractFactory('SwapAndStakeV3Polygon')
		swapAndStakeContract = (await factory.deploy(
			wethAddress,
			devAddress,
			lockupAddress,
			sTokensManagerAddress
		)) as SwapAndStakeV3
		await swapAndStakeContract.deployed()

		lockupContract = await ethers.getContractAt(
			'contracts/interfaces/ILockup.sol:ILockup',
			lockupAddress
		)
		sTokensManagerContract = await ethers.getContractAt(
			'ISTokensManager',
			sTokensManagerAddress
		)
	})
	describe('swap eth for dev', () => {
		it('should stake eth for dev', async () => {
			// Use callStaic to execute getEstimatedDevForEth as a read method
			const amountOut =
				await swapAndStakeContract.callStatic.getEstimatedDevForEth(
					ethers.utils.parseUnits('1000', 'gwei')
				)
			const amountIn =
				await swapAndStakeContract.callStatic.getEstimatedEthForDev(amountOut)
			expect(amountIn).to.equal(ethers.utils.parseUnits('1000', 'gwei'))

			console.log('amount Out', amountOut)

			// STokenId = currentIndex + 1 will be minted.
			let sTokenId: BigNumber = await sTokensManagerContract.currentIndex()
			sTokenId = sTokenId.add(1)

			const block = await waffle.provider.getBlock('latest')
			const deadline = block.timestamp + 300

			await expect(
				swapAndStakeContract['swapEthAndStakeDev(address,uint256,bytes32)'](
					propertyAddress,
					deadline,
					ethers.constants.HashZero,
					{
						value: ethers.utils.parseEther('0.00001'),
					}
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
			const gatewayFeeBasisPoints = 333 // In basis points, so 3.33%
			const depositAmount = BigNumber.from('400000000000000')
			const feeAmount = depositAmount.mul(gatewayFeeBasisPoints).div(10000)
			const amountOut =
				await swapAndStakeContract.callStatic.getEstimatedDevForEth(
					depositAmount.sub(feeAmount)
				)
			const amountIn =
				await swapAndStakeContract.callStatic.getEstimatedEthForDev(amountOut)
			expect(amountIn).to.equal(depositAmount.sub(feeAmount))

			let sTokenId: BigNumber = await sTokensManagerContract.currentIndex()

			const block = await account1.provider?.getBlock('latest')
			const deadline = block!.timestamp + 300

			sTokenId = sTokenId.add(1)
			await expect(
				swapAndStakeContract[
					'swapEthAndStakeDev(address,uint256,bytes32,address,uint256)'
				](
					propertyAddress,
					deadline,
					ethers.constants.HashZero,
					gateway.address,
					gatewayFeeBasisPoints,
					{
						value: depositAmount,
					}
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
				await swapAndStakeContract.gatewayFees(
					gateway.address,
					ethers.constants.AddressZero
				)
			).to.eq(feeAmount)

			// Withdraw credit
			await expect(
				swapAndStakeContract
					.connect(gateway)
					.claim(ethers.constants.AddressZero)
			)
				.to.emit(swapAndStakeContract, 'Withdrawn')
				.withArgs(gateway.address, ethers.constants.AddressZero, feeAmount)

			// Check gateway credit has been deducted
			expect(
				await swapAndStakeContract.gatewayFees(
					gateway.address,
					ethers.constants.AddressZero
				)
			).to.eq(0)
		})
	})
})
