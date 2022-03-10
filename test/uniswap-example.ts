import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { deploy } from './utils'
import { UniswapExample } from '../typechain'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract } from 'ethers'
import * as dotenv from 'dotenv'

dotenv.config()

const alchemyApiKey =
	typeof process.env.ALCHEMY_KEY === 'undefined' ? '' : process.env.ALCHEMY_KEY

use(solidity)

describe('UniswapExample', () => {
	let swap: UniswapExample
	let account1: SignerWithAddress
	let devTokenContract: Contract

	const devAddress = '0x5cAf454Ba92e6F2c929DF14667Ee360eD9fD5b26'
	const propertyAddress = '0xac1AC9d00314aE7B4a7d6DbEE4860bECedF92309'

	beforeEach(async () => {
		await ethers.provider.send('hardhat_reset', [
			{
				forking: {
					jsonRpcUrl: 'https://eth-mainnet.alchemyapi.io/v2/' + alchemyApiKey,
					blockNumber: 14350029,
				},
			},
		])

		const accounts = await ethers.getSigners()

		account1 = accounts[0]

		swap = await deploy<UniswapExample>('UniswapExample')

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

			await swap.stakeEthforDev(1, propertyAddress, {
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
		it('should not swap eth for dev', async () => {
			// Fails if devAmountMin exceeds the uniswap reserve
			await expect(
				swap.stakeEthforDev(
					ethers.utils.parseEther('1000000'),
					propertyAddress,
					{
						value: ethers.utils.parseEther('1'),
					}
				)
			).to.be.revertedWith('UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT')
		})
	})
})
