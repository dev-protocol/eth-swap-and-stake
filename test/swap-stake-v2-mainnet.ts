import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { ethers } from 'hardhat'
import { SwapStakeV2 } from '../typechain'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract, BigNumber } from 'ethers'
import * as dotenv from 'dotenv'

dotenv.config()

const alchemyKeyMainnet =
	typeof process.env.ALCHEMY_KEY_MAINNET === 'undefined'
		? ''
		: process.env.ALCHEMY_KEY_MAINNET

use(solidity)

describe('SwapStakeV2 Mainnet', () => {
	let account1: SignerWithAddress
	let swapStakeContract: SwapStakeV2
	let lockupContract: Contract
	let sTokensManagerContract: Contract

	const uniswapRouterAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'
	const devAddress = '0x5cAf454Ba92e6F2c929DF14667Ee360eD9fD5b26'
	const lockupAddress = '0x71A25Bb05C68037B867E165c229D0c30e73f07Ad'
	const propertyAddress = '0xac1AC9d00314aE7B4a7d6DbEE4860bECedF92309'
	const sTokensManagerAddress = '0x50489Ff5f879A44C87bBA85287729D663b18CeD5'

	beforeEach(async () => {
		await ethers.provider.send('hardhat_reset', [
			{
				forking: {
					jsonRpcUrl:
						'https://eth-mainnet.alchemyapi.io/v2/' + alchemyKeyMainnet,
					blockNumber: 9389486,
				},
			},
		])

		const accounts = await ethers.getSigners()

		account1 = accounts[0]

		const factory = await ethers.getContractFactory('SwapStakeV2')
		swapStakeContract = (await factory.deploy(
			uniswapRouterAddress,
			devAddress,
			lockupAddress,
			sTokensManagerAddress
		)) as SwapStakeV2
		await swapStakeContract.deployed()

		lockupContract = await ethers.getContractAt(
			'@devprotocol/protocol/contracts/interface/ILockup.sol:ILockup',
			lockupAddress
		)
	})
	describe('swap eth for dev', () => {
		it('should stake eth for dev', async () => {
			const amounts = await swapStakeContract.getEstimatedDEVforETH(
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
					amounts[1],
					sTokenId
				)

			const sTokenOwner = await sTokensManagerContract.ownerOf(sTokenId)
			const sTokenPosition: number[] = await sTokensManagerContract.positions(
				sTokenId
			)
			expect(sTokenOwner).to.equal(account1.address)
			expect(sTokenPosition[1]).to.equal(amounts[1])
		})
	})
})
