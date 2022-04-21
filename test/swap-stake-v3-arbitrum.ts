import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { ethers } from 'hardhat'
import { SwapStakeV3 } from '../typechain'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract, BigNumber } from 'ethers'
import * as dotenv from 'dotenv'

dotenv.config()

const alchemyKeyArbitrum =
	typeof process.env.ALCHEMY_KEY_ARBITRUM === 'undefined'
		? ''
		: process.env.ALCHEMY_KEY_ARBITRUM

use(solidity)

describe('SwapStakeV3 Arbitrum', () => {
	let account1: SignerWithAddress
	let swapStakeContract: SwapStakeV3
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
					blockNumber: 10243775,
				},
			},
		])

		const accounts = await ethers.getSigners()

		account1 = accounts[0]

		const factory = await ethers.getContractFactory('SwapStakeV3')
		swapStakeContract = (await factory.deploy(
			wethAddress,
			devAddress,
			lockupAddress,
			sTokensManagerAddress
		)) as SwapStakeV3
		await swapStakeContract.deployed()

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
			// Use callStaic to execute getEstimatedDEVforETH as a read method
			const amountOut =
				await swapStakeContract.callStatic.getEstimatedDEVforETH(
					ethers.utils.parseEther('1')
				)
			// STokenId = currentIndex + 1 will be minted.
			let sTokenId: BigNumber = await sTokensManagerContract.currentIndex()
			sTokenId = sTokenId.add(1)
			await expect(
				swapStakeContract.stakeEthforDev(propertyAddress, {
					value: ethers.utils.parseEther('1'),
				})
			)
				.to.emit(lockupContract, 'Lockedup')
				.withArgs(
					swapStakeContract.address,
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
	})
})
