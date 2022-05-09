import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { ethers } from 'hardhat'
import { SwapAndStakeV2 } from '../typechain'
import * as dotenv from 'dotenv'

dotenv.config()

use(solidity)

describe('SwapAndStakeV2 Mainnet', () => {
	let swapAndStakeContract: SwapAndStakeV2

	const uniswapRouterAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'
	const devAddress = '0x5cAf454Ba92e6F2c929DF14667Ee360eD9fD5b26'
	const lockupAddress = '0x71A25Bb05C68037B867E165c229D0c30e73f07Ad'
	const propertyAddress = '0xac1AC9d00314aE7B4a7d6DbEE4860bECedF92309'
	const sTokensManagerAddress = '0x50489Ff5f879A44C87bBA85287729D663b18CeD5'

	beforeEach(async () => {
		const factory = await ethers.getContractFactory('SwapAndStakeV2')
		swapAndStakeContract = (await factory.deploy(
			uniswapRouterAddress,
			devAddress,
			lockupAddress,
			sTokensManagerAddress
		)) as SwapAndStakeV2
		await swapAndStakeContract.deployed()
	})
	describe('swap eth for dev', () => {
		it('should stake eth for dev', async () => {
			await expect(
				swapAndStakeContract.swapEthAndStakeDev(propertyAddress, {
					value: ethers.utils.parseEther('1'),
				})
			).to.revertedWith('UniswapV2Library: INSUFFICIENT_INPUT_AMOUNT')
		})
	})
})
