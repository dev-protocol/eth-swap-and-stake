import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { deploy } from './utils'
import { UniswapExample } from '../typechain'
import { ethers } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import * as dotenv from 'dotenv'

dotenv.config()

const alchemyApiKey =
	typeof process.env.ALCHEMY_KEY === 'undefined' ? '' : process.env.ALCHEMY_KEY

use(solidity)

describe('UniswapExample', () => {
	let swap: UniswapExample
	let account1: SignerWithAddress

	beforeEach(async () => {
		await ethers.provider.send('hardhat_reset', [
			{
				forking: {
					jsonRpcUrl: 'https://eth-mainnet.alchemyapi.io/v2/' + alchemyApiKey,
					blockNumber: 12057273,
				},
			},
		])

		const accounts = await ethers.getSigners()

		account1 = accounts[0]

		swap = await deploy<UniswapExample>('UniswapExample')
	})
	describe('swap eth for dev', () => {
		it('should swap eth for dev', async () => {
			const amounts = await swap.getEstimatedDAIforETH(
				ethers.utils.parseEther('1'),
				'0x5cAf454Ba92e6F2c929DF14667Ee360eD9fD5b26'
			)
			console.log('amounts', amounts)
			const daiTokenContract = await ethers.getContractAt(
				'IWAVAX',
				'0x5cAf454Ba92e6F2c929DF14667Ee360eD9fD5b26'
			)
			const ethBalanceBefore = await ethers.provider.getBalance(
				account1.address
			)
			const daiBalanceBefore = await daiTokenContract.balanceOf(
				account1.address
			)
			console.log('before balance', ethBalanceBefore, daiBalanceBefore)
			await swap.convertEthToDai(
				1,
				'0x5cAf454Ba92e6F2c929DF14667Ee360eD9fD5b26',
				{ value: ethers.utils.parseEther('1') }
			)
			const ethBalanceAfter = await ethers.provider.getBalance(account1.address)
			const daiBalanceAfter = await daiTokenContract.balanceOf(account1.address)
			console.log('after balance', ethBalanceAfter, daiBalanceAfter)
			// ethBalance reduces
			expect(ethBalanceAfter).lt(ethBalanceBefore)
			// ethBalance delta is 1 eth + gas
			expect(ethBalanceBefore.sub(ethBalanceAfter)).gt(ethers.utils.parseEther('1'))
			// daiBalance increases
			expect(daiBalanceAfter).gt(daiBalanceBefore)
			// daiBalance is the estimated amount
			expect(daiBalanceAfter).to.equal(amounts[1])
		})
		it('should not swap eth for dev', async () => {
			const amounts = await swap.getEstimatedDAIforETH(
				ethers.utils.parseEther('1'),
				'0x5cAf454Ba92e6F2c929DF14667Ee360eD9fD5b26'
			)
			console.log('amounts', amounts)
			const daiTokenContract = await ethers.getContractAt(
				'IWAVAX',
				'0x5cAf454Ba92e6F2c929DF14667Ee360eD9fD5b26'
			)
			const ethBalanceBefore = await ethers.provider.getBalance(
				account1.address
			)
			const daiBalanceBefore = await daiTokenContract.balanceOf(
				account1.address
			)
			console.log('before balance', ethBalanceBefore, daiBalanceBefore)
			await expect(
				swap.convertEthToDai(
					ethers.utils.parseEther('1000'),
					'0x5cAf454Ba92e6F2c929DF14667Ee360eD9fD5b26',
					{ value: ethers.utils.parseEther('1') }
				)
			).to.be.revertedWith('UniswapV2Router: INSUFFICIENT_OUTPUT_AMOUNT')
		})
	})
})
