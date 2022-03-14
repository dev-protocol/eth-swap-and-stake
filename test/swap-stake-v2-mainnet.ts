import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { ethers } from 'hardhat'
import { SwapStakeV2 } from '../typechain'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract } from 'ethers'
import * as dotenv from 'dotenv'

dotenv.config()

const alchemyKeyMainnet =
	typeof process.env.ALCHEMY_KEY_MAINNET === 'undefined'
		? ''
		: process.env.ALCHEMY_KEY_MAINNET

use(solidity)

describe('SwapStakeV2 Mainnet', () => {
	let account1: SignerWithAddress
	let swap: SwapStakeV2
	let devTokenContract: Contract

	const uniswapRouterAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'
	const devAddress = '0x5cAf454Ba92e6F2c929DF14667Ee360eD9fD5b26'
	const lockupAddress = '0xBD2a75e11De78Af8D58595FB16181d505777804F'
	const propertyAddress = '0xac1AC9d00314aE7B4a7d6DbEE4860bECedF92309'

	beforeEach(async () => {
		await ethers.provider.send('hardhat_reset', [
			{
				forking: {
					jsonRpcUrl:
						'https://eth-mainnet.alchemyapi.io/v2/' + alchemyKeyMainnet,
					blockNumber: 14350029,
				},
			},
		])

		const accounts = await ethers.getSigners()

		account1 = accounts[0]

		const factory = await ethers.getContractFactory('SwapStakeV2')
		swap = (await factory.deploy(
			uniswapRouterAddress,
			devAddress,
			lockupAddress
		)) as SwapStakeV2
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
