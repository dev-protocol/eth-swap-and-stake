import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { ethers } from 'hardhat'
import { SwapAndStakeV2L1 } from '../typechain'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract, BigNumber } from 'ethers'
import * as dotenv from 'dotenv'

dotenv.config()

const alchemyKeyMainnet =
	typeof process.env.ALCHEMY_KEY_MAINNET === 'undefined'
		? ''
		: process.env.ALCHEMY_KEY_MAINNET

use(solidity)

describe('SwapAndStakeV2 Mainnet', () => {
	let account1: SignerWithAddress
	let gateway: SignerWithAddress
	let swapAndStakeContract: SwapAndStakeV2L1
	let lockupContract: Contract
	let sTokensManagerContract: Contract

	const uniswapRouterAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'
	const devAddress = '0x5cAf454Ba92e6F2c929DF14667Ee360eD9fD5b26'
	const lockupAddress = '0x093ec4e2f80f8860a635ca6b4768a9d81911805e'
	const propertyAddress = '0xac1AC9d00314aE7B4a7d6DbEE4860bECedF92309'
	const sTokensManagerAddress = '0x50489Ff5f879A44C87bBA85287729D663b18CeD5'

	beforeEach(async () => {
		await ethers.provider.send('hardhat_reset', [
			{
				forking: {
					jsonRpcUrl:
						'https://eth-mainnet.alchemyapi.io/v2/' + alchemyKeyMainnet,
					blockNumber: 15126211,
				},
			},
		])

		const accounts = await ethers.getSigners()

		account1 = accounts[0]
		gateway = accounts[1]

		const factory = await ethers.getContractFactory('SwapAndStakeV2L1')
		swapAndStakeContract = (await factory.deploy(
			uniswapRouterAddress,
			devAddress,
			lockupAddress,
			sTokensManagerAddress
		)) as SwapAndStakeV2L1
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
		it('should stake eth for dev without gateway fee', async () => {
			const amountsOut = await swapAndStakeContract.getEstimatedDevForEth(
				ethers.utils.parseEther('1')
			)
			const amountsIn = await swapAndStakeContract.getEstimatedEthForDev(
				amountsOut[1]
			)
			expect(amountsIn[0]).to.equal(amountsOut[0])

			const block = await account1.provider?.getBlock('latest')
			const deadline = block!.timestamp + 300

			// STokenId = currentIndex + 1 will be minted.
			let sTokenId: BigNumber = await sTokensManagerContract.currentIndex()
			sTokenId = sTokenId.add(1)
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
				.withArgs(swapAndStakeContract.address, propertyAddress, amountsOut[1])

			const sTokenOwner = await sTokensManagerContract.ownerOf(sTokenId)
			const sTokenPosition: number[] = await sTokensManagerContract.positions(
				sTokenId
			)
			expect(sTokenOwner).to.equal(account1.address)
			expect(sTokenPosition[1]).to.equal(amountsOut[1])
		})

		it('should stake eth for dev and deduct gateway fee', async () => {
			const gatewayFeeBasisPoints = 333 // In basis points, so 3.33%
			const depositAmount = BigNumber.from('1000000000000053927')
			const feeAmount = depositAmount.mul(gatewayFeeBasisPoints).div(10000)

			const amountsOut = await swapAndStakeContract.getEstimatedDevForEth(
				depositAmount.sub(feeAmount)
			)
			const amountsIn = await swapAndStakeContract.getEstimatedEthForDev(
				amountsOut[1]
			)
			expect(amountsIn[0]).to.equal(amountsOut[0])

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
				.withArgs(swapAndStakeContract.address, propertyAddress, amountsOut[1])

			const sTokenOwner = await sTokensManagerContract.ownerOf(sTokenId)
			const sTokenPosition: number[] = await sTokensManagerContract.positions(
				sTokenId
			)
			expect(sTokenOwner).to.equal(account1.address)
			expect(sTokenPosition[1]).to.equal(amountsOut[1])

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

		it('should not stake eth for dev', async () => {
			const block = await account1.provider?.getBlock('latest')
			const deadline = block!.timestamp + 300
			await expect(
				swapAndStakeContract['swapEthAndStakeDev(address,uint256,bytes32)'](
					propertyAddress,
					deadline,
					ethers.constants.HashZero,
					{
						value: ethers.utils.parseEther('0'),
					}
				)
			).to.revertedWith('UniswapV2Library: INSUFFICIENT_INPUT_AMOUNT')
		})
	})
})
