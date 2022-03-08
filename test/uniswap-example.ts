/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { expect, use } from 'chai'
import { BigNumber } from 'ethers'
import { solidity } from 'ethereum-waffle'
import { deploy, toBigNumber } from './utils'
import { UniswapExample, IWAVAX } from '../typechain'
import { ethers, run } from 'hardhat'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

require('dotenv').config()

use(solidity)

describe('UniswapExample', () => {
	let swap: UniswapExample;
	let account1: SignerWithAddress;

	beforeEach(async function () {
		await ethers.provider.send(
			"hardhat_reset",
			[
				{
					forking: {
						jsonRpcUrl: "https://eth-mainnet.alchemyapi.io/v2/" + process.env.ALCHEMY_KEY,
						blockNumber: 12057273,
					},
				},
			],
		);

		let accounts = await ethers.getSigners()

		// @ts-ignore
		account1 = accounts[0]

		swap = await deploy<UniswapExample>('UniswapExample')
	});
	describe('value', () => {
		it('should swap eth for dev', async () => {
			const amounts = await swap.getEstimatedETHforDAI(1000000, "0x5cAf454Ba92e6F2c929DF14667Ee360eD9fD5b26")
			console.log('amounts', amounts)
			const daiTokenContract = await ethers.getContractAt("IWAVAX", "0x5cAf454Ba92e6F2c929DF14667Ee360eD9fD5b26")
			const ethBalanceBefore = await ethers.provider.getBalance(account1.address)
			const daiBalanceBefore = await daiTokenContract.balanceOf(account1.address)
			console.log('before balance', ethBalanceBefore, daiBalanceBefore)
			await swap.convertEthToDai(1000000, "0x5cAf454Ba92e6F2c929DF14667Ee360eD9fD5b26", { value: ethers.utils.parseEther("1") })
			const ethBalanceAfter = await ethers.provider.getBalance(account1.address)
			const daiBalanceAfter = await daiTokenContract.balanceOf(account1.address)
			console.log('after balance', ethBalanceAfter, daiBalanceAfter)
			expect(ethBalanceAfter).lt(ethBalanceBefore);
			expect(daiBalanceAfter).gt(daiBalanceBefore);
		})
		it('should not swap eth for dev', async () => {
			const amounts = await swap.getEstimatedETHforDAI(1000000, "0x5cAf454Ba92e6F2c929DF14667Ee360eD9fD5b26")
			console.log('amounts', amounts)
			const daiTokenContract = await ethers.getContractAt("IWAVAX", "0x5cAf454Ba92e6F2c929DF14667Ee360eD9fD5b26")
			const ethBalanceBefore = await ethers.provider.getBalance(account1.address)
			const daiBalanceBefore = await daiTokenContract.balanceOf(account1.address)
			console.log('before balance', ethBalanceBefore, daiBalanceBefore)
			await expect(
				swap.convertEthToDai(1000000, "0x5cAf454Ba92e6F2c929DF14667Ee360eD9fD5b26", { value: ethers.utils.parseUnits("1000", 0) })
			).to.be.revertedWith('UniswapV2Router: EXCESSIVE_INPUT_AMOUNT')
		})
	})

})
