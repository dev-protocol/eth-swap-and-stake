import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { ethers, waffle } from 'hardhat'
import { SwapAndStakeV3 } from '../typechain'
import * as dotenv from 'dotenv'

dotenv.config()

use(solidity)

describe('SwapAndStakeV3 Arbitrum', () => {
	let swapAndStakeContract: SwapAndStakeV3

	// Arbitrum
	const wethAddress = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
	const devAddress = '0x91F5dC90979b058eBA3be6B7B7e523df7e84e137'
	const lockupAddress = '0x1A2B49e10013C40AAC9b6f9e785837bfd329e5e0'
	const propertyAddress = '0x7645306DfB9e14C0B849bb71eeC7BB4D1Cde8251'
	const sTokensManagerAddress = '0x40d999931f7055F670511860e24624939e71a96a'

	beforeEach(async () => {
		const factory = await ethers.getContractFactory('SwapAndStakeV3')
		swapAndStakeContract = (await factory.deploy(
			wethAddress,
			devAddress,
			lockupAddress,
			sTokensManagerAddress
		)) as SwapAndStakeV3
		await swapAndStakeContract.deployed()
	})
	describe('swap eth for dev', () => {
		it('should revert when sending 0 ETH', async () => {
			const block = await waffle.provider.getBlock('latest')
			const deadline = block.timestamp + 300

			await expect(
				swapAndStakeContract['swapEthAndStakeDev(address,uint256,bytes32)'](
					propertyAddress,
					deadline,
					ethers.constants.HashZero,
					{
						value: ethers.utils.parseEther('0'),
					}
				)
			).to.revertedWith('Must pass non 0 ETH amount')
		})
	})
})
