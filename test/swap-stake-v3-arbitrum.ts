import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { ethers, waffle } from 'hardhat'
import { SwapAndStakeV3 } from '../typechain'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract, BigNumber } from 'ethers'
import * as dotenv from 'dotenv'

dotenv.config()

const alchemyKeyArbitrum =
	typeof process.env.ALCHEMY_KEY_ARBITRUM === 'undefined'
		? ''
		: process.env.ALCHEMY_KEY_ARBITRUM

use(solidity)

describe('SwapAndStakeV3 Arbitrum', () => {
	let account1: SignerWithAddress
	let gateway: SignerWithAddress
	let swapAndStakeContract: SwapAndStakeV3
	let lockupContract: Contract
	let sTokensManagerContract: Contract

	// Arbitrum
	const wethAddress = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
	const devAddress = '0x91F5dC90979b058eBA3be6B7B7e523df7e84e137'
	const lockupAddress = '0x1A2B49e10013C40AAC9b6f9e785837bfd329e5e0'
	const propertyAddress = '0x7645306DfB9e14C0B849bb71eeC7BB4D1Cde8251'
	const sTokensManagerAddress = '0x40d999931f7055F670511860e24624939e71a96a'

	beforeEach(async () => {
		await ethers.provider.send('hardhat_reset', [
			{
				forking: {
					jsonRpcUrl:
						'https://arb-mainnet.g.alchemy.com/v2/' + alchemyKeyArbitrum,
					blockNumber: 17999611,
				},
			},
		])

		const accounts = await ethers.getSigners()

		account1 = accounts[0]
		gateway = accounts[1]

		const factory = await ethers.getContractFactory('SwapAndStakeV3')
		swapAndStakeContract = (await factory.deploy(
			wethAddress,
			devAddress,
			lockupAddress,
			sTokensManagerAddress
		)) as SwapAndStakeV3
		await swapAndStakeContract.deployed()

		lockupContract = await ethers.getContractAt(
			'@devprotocol/protocol-v2/contracts/interface/ILockup.sol:ILockup',
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
					ethers.utils.parseEther('1')
				)
			const amountIn =
				await swapAndStakeContract.callStatic.getEstimatedEthForDev(amountOut)
			expect(amountIn).to.equal(ethers.utils.parseEther('1'))

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
						value: ethers.utils.parseEther('1'),
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
			const depositAmount = BigNumber.from('1000000000000053927')
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
