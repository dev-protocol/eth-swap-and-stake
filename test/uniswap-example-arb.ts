import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { ethers } from 'hardhat'
import { UniswapExample } from '../typechain'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract } from 'ethers'
import * as dotenv from 'dotenv'

dotenv.config()

const alchemyApiKey =
	typeof process.env.ALCHEMY_KEY === 'undefined' ? '' : process.env.ALCHEMY_KEY

use(solidity)

describe('UniswapExample', () => {
	let account1: SignerWithAddress
	let swap: UniswapExample
	let devTokenContract: Contract

	// Arbitrum
	// const wethAddress = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
	const devAddress = '0x91F5dC90979b058eBA3be6B7B7e523df7e84e137'
	const lockupAddress = '0x1A2B49e10013C40AAC9b6f9e785837bfd329e5e0'
	const propertyAddress = '0x7645306DfB9e14C0B849bb71eeC7BB4D1Cde8251'

	beforeEach(async () => {
		await ethers.provider.send('hardhat_reset', [
			{
				forking: {
					jsonRpcUrl: 'https://arb-mainnet.g.alchemy.com/v2/' + alchemyApiKey,
					blockNumber: 7683813,
				},
			},
		])

		const accounts = await ethers.getSigners()

		account1 = accounts[0]

		const factory = await ethers.getContractFactory('UniswapExample')
		swap = (await factory.deploy(devAddress, lockupAddress)) as UniswapExample
		await swap.deployed()

		devTokenContract = await ethers.getContractAt('IERC20', devAddress)
	})
	describe('swap eth for dev', () => {
		it('should stake eth for dev', async () => {
			const amounts = await swap.getEstimatedDEVforETH(
				ethers.utils.parseEther('1')
			)
			const ethBalanceBefore = await ethers.provider.getBalance(
				account1.address
			)
			const devBalanceBefore = await devTokenContract.balanceOf(swap.address)

			await swap.stakeEthforDev(propertyAddress, {
				value: ethers.utils.parseEther('1'),
			})
			const ethBalanceAfter = await ethers.provider.getBalance(account1.address)
			const devBalanceAfter = await devTokenContract.balanceOf(swap.address)
			// EthBalance reduces
			expect(ethBalanceAfter).lt(ethBalanceBefore)
			// EthBalance delta is 1 eth + gas
			expect(ethBalanceBefore.sub(ethBalanceAfter)).gt(
				ethers.utils.parseEther('1')
			)
			// DevBalance increases
			expect(devBalanceAfter).gt(devBalanceBefore)
			// DevBalance is the estimated amount
			expect(devBalanceAfter).to.equal(amounts[1])
		})
	})
})
