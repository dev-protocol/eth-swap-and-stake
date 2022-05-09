import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { ethers } from 'hardhat'
import { SwapAndStakeV2 } from '../typechain'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract, BigNumber } from 'ethers'
import * as dotenv from 'dotenv'

dotenv.config()

const alchemyKeyPolygon =
	typeof process.env.ALCHEMY_KEY_POLYGON === 'undefined'
		? ''
		: process.env.ALCHEMY_KEY_POLYGON

use(solidity)

describe('SwapAndStakeV2 Quickswap', () => {
	let account1: SignerWithAddress
	let swapAndStakeContract: SwapAndStakeV2
	let lockupContract: Contract
	let sTokensManagerContract: Contract

	// Polygon
	const uniswapRouterAddress = '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff'
	const devAddress = '0xA5577D1cec2583058A6Bd6d5DEAC44797c205701'
	const lockupAddress = '0x42767B12d3f07bE0D951a64eE6573B40Ff165C4e'
	const propertyAddress = '0x8c6ee1548F687A7a6fda2e233733B7e3d3CF7856'
	const sTokensManagerAddress = '0x89904De861CDEd2567695271A511B3556659FfA2'

	beforeEach(async () => {
		await ethers.provider.send('hardhat_reset', [
			{
				forking: {
					jsonRpcUrl:
						'https://polygon-mainnet.g.alchemy.com/v2/' + alchemyKeyPolygon,
					blockNumber: 27390338,
				},
			},
		])

		const accounts = await ethers.getSigners()

		account1 = accounts[0]

		const factory = await ethers.getContractFactory('SwapAndStakeV2')
		swapAndStakeContract = (await factory.deploy(
			uniswapRouterAddress,
			devAddress,
			lockupAddress,
			sTokensManagerAddress
		)) as SwapAndStakeV2
		await swapAndStakeContract.deployed()

		lockupContract = await ethers.getContractAt(
			'@devprotocol/protocol-v2/contracts/interface/ILockup.sol:ILockup',
			lockupAddress
		)
		sTokensManagerContract = await ethers.getContractAt(
			'ISTokensManager',
			sTokensManagerAddress
		)
	})
	describe('swap eth for dev', () => {
		it('should stake eth for dev', async () => {
			const amounts = await swapAndStakeContract.getEstimatedDevForEth(
				ethers.utils.parseEther('1')
			)

			// STokenId = currentIndex + 1 will be minted.
			let sTokenId: BigNumber = await sTokensManagerContract.currentIndex()
			sTokenId = sTokenId.add(1)
			await expect(
				swapAndStakeContract.swapEthAndStakeDev(propertyAddress, {
					value: ethers.utils.parseEther('1'),
				})
			)
				.to.emit(lockupContract, 'Lockedup')
				.withArgs(
					swapAndStakeContract.address,
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
