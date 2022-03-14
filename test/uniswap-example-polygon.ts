import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { ethers } from 'hardhat'
import { UniswapExample } from '../typechain'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract } from 'ethers'
import * as dotenv from 'dotenv'

dotenv.config()

const alchemyKeyPolygon =
	typeof process.env.ALCHEMY_KEY_POLYGON === 'undefined'
		? ''
		: process.env.ALCHEMY_KEY_POLYGON

use(solidity)

describe('UniswapExample Quickswap', () => {
	let account1: SignerWithAddress
	let swap: UniswapExample
	let devTokenContract: Contract

	// Polygon
	// const wethAddress = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
	const uniswapRouterAddress = '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff'
	const devAddress = '0xA5577D1cec2583058A6Bd6d5DEAC44797c205701'
	const lockupAddress = '0x42767B12d3f07bE0D951a64eE6573B40Ff165C4e'
	const propertyAddress = '0x234C1C344796A68f6913F5126B726DF94de186A9'

	beforeEach(async () => {
		await ethers.provider.send('hardhat_reset', [
			{
				forking: {
					jsonRpcUrl:
						'https://polygon-mainnet.g.alchemy.com/v2/' + alchemyKeyPolygon,
					blockNumber: 25811386,
				},
			},
		])

		const accounts = await ethers.getSigners()

		account1 = accounts[0]

		const factory = await ethers.getContractFactory('UniswapExample')
		swap = (await factory.deploy(
			uniswapRouterAddress,
			devAddress,
			lockupAddress
		)) as UniswapExample
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
