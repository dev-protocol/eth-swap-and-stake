import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { ethers } from 'hardhat'
import { SwapAndStakePolygonV2 } from '../typechain'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import { Contract, BigNumber } from 'ethers'
import * as dotenv from 'dotenv'

dotenv.config()

const alchemyKeyPolygon =
	typeof process.env.ALCHEMY_KEY_POLYGON === 'undefined'
		? ''
		: process.env.ALCHEMY_KEY_POLYGON

use(solidity)

describe('SwapAndStakePolygonV2 Quickswap', () => {
	let account1: SignerWithAddress
	let swapAndStakeContract: SwapAndStakePolygonV2
	let lockupContract: Contract
	let sTokensManagerContract: Contract
	// Let erc20Contract: Contract

	// Polygon Mainnet
	const uniswapRouterAddress = '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff'
	const wethAddress = '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619'
	const devAddress = '0xA5577D1cec2583058A6Bd6d5DEAC44797c205701'
	const lockupAddress = '0x42767B12d3f07bE0D951a64eE6573B40Ff165C4e'
	const sTokensManagerAddress = '0x89904De861CDEd2567695271A511B3556659FfA2'

	const propertyAddress = '0x8c6ee1548F687A7a6fda2e233733B7e3d3CF7856'

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

		const factory = await ethers.getContractFactory('SwapAndStakePolygonV2')
		swapAndStakeContract = (await factory.deploy(
			uniswapRouterAddress,
			wethAddress,
			devAddress,
			lockupAddress,
			sTokensManagerAddress
		)) as SwapAndStakePolygonV2
		await swapAndStakeContract.deployed()

		lockupContract = await ethers.getContractAt(
			'@devprotocol/protocol-v2/contracts/interface/ILockup.sol:ILockup',
			lockupAddress
		)
		sTokensManagerContract = await ethers.getContractAt(
			'ISTokensManager',
			sTokensManagerAddress
		)
		// Erc20Contract = await ethers.getContractAt(
		// 	'@openzeppelin/contracts/token/ERC20/IERC20.sol:IERC20',
		// 	wethAddress

		// )
		// erc20Contract.approve(uniswapRouterAddress, ethers.utils.parseEther('10'))
	})
	describe('swap eth for dev', () => {
		it('should stake eth for dev', async () => {
			const amountsOut = await swapAndStakeContract.getEstimatedDevForEth(
				ethers.utils.parseEther('1')
			)
			const amountsIn = await swapAndStakeContract.getEstimatedEthForDev(
				amountsOut[2]
			)
			expect(amountsIn[0]).to.equal(amountsOut[0])

			// STokenId = currentIndex + 1 will be minted.
			let sTokenId: BigNumber = await sTokensManagerContract.currentIndex()
			sTokenId = sTokenId.add(1)
			await expect(
				swapAndStakeContract.swapEthAndStakeDev(
					ethers.utils.parseEther('1'),
					propertyAddress
				)
			)
				.to.emit(lockupContract, 'Lockedup')
				.withArgs(
					swapAndStakeContract.address,
					propertyAddress,
					amountsOut[1],
					sTokenId
				)

			const sTokenOwner = await sTokensManagerContract.ownerOf(sTokenId)
			const sTokenPosition: number[] = await sTokensManagerContract.positions(
				sTokenId
			)
			expect(sTokenOwner).to.equal(account1.address)
			expect(sTokenPosition[1]).to.equal(amountsOut[1])
		})
	})
})
