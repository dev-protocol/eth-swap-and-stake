import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { ethers } from 'hardhat'
import { Uniswap3 } from '../typechain'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract } from 'ethers'
import * as dotenv from 'dotenv'

dotenv.config()

// const alchemyKeyMainnet =
// 	typeof process.env.ALCHEMY_KEY_MAINNET === 'undefined' ? '' : process.env.ALCHEMY_KEY_MAINNET
const alchemyKeyArbitrum =
	typeof process.env.ALCHEMY_KEY_ARBITRUM === 'undefined'
		? ''
		: process.env.ALCHEMY_KEY_ARBITRUM

use(solidity)

describe('UniswapExample', () => {
	let account1: SignerWithAddress
	let swap: Uniswap3
	let devTokenContract: Contract

	// Arbitrum
	const wethAddress = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
	const devAddress = '0x91F5dC90979b058eBA3be6B7B7e523df7e84e137'
	const lockupAddress = '0x1A2B49e10013C40AAC9b6f9e785837bfd329e5e0'
	// Const propertyAddress = '0x7645306DfB9e14C0B849bb71eeC7BB4D1Cde8251'
	// Mainnet
	// const wethAddress = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'
	// const devAddress = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' //usdc
	// const lockupAddress = '0x1A2B49e10013C40AAC9b6f9e785837bfd329e5e0'
	// Const propertyAddress = '0x7645306DfB9e14C0B849bb71eeC7BB4D1Cde8251'

	beforeEach(async () => {
		await ethers.provider.send('hardhat_reset', [
			{
				forking: {
					jsonRpcUrl:
						'https://arb-mainnet.g.alchemy.com/v2/' + alchemyKeyArbitrum,
					blockNumber: 7727395,
				},
			},
		])

		console.log('alchemyKey', alchemyKeyArbitrum)
		const accounts = await ethers.getSigners()

		account1 = accounts[0]

		const factory = await ethers.getContractFactory('Uniswap3')
		swap = (await factory.deploy(
			wethAddress,
			devAddress,
			lockupAddress
		)) as Uniswap3
		await swap.deployed()

		devTokenContract = await ethers.getContractAt('IERC20', devAddress)
	})
	describe('swap eth for dev', () => {
		it('should stake eth for dev', async () => {
			// Use callStaic to execute offchain
			const amountOut = await swap.callStatic.getEstimatedDEVforETH(
				ethers.utils.parseEther('1')
			)
			const ethBalanceBefore = await ethers.provider.getBalance(
				account1.address
			)
			const devBalanceBefore = await devTokenContract.balanceOf(swap.address)

			await swap.stakeEthforDev({
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
			expect(devBalanceAfter).to.equal(amountOut)
		})
	})
})
