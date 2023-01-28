import { expect, use } from 'chai'
import { solidity } from 'ethereum-waffle'
import { ethers } from 'hardhat'
import { SwapAndStakeV2Polygon } from '../typechain'
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
	let gateway: SignerWithAddress
	let swapAndStakeContract: SwapAndStakeV2Polygon
	let lockupContract: Contract
	let sTokensManagerContract: Contract

	// Polygon
	const uniswapRouterAddress = '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff'
	const devAddress = '0xA5577D1cec2583058A6Bd6d5DEAC44797c205701'
	const lockupAddress = '0x42767B12d3f07bE0D951a64eE6573B40Ff165C4e'
	const propertyAddress = '0x8c6ee1548F687A7a6fda2e233733B7e3d3CF7856'
	const sTokensManagerAddress = '0x89904De861CDEd2567695271A511B3556659FfA2'
	const wethAddress = '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'
	let wethContract: Contract
	let router: Contract

	beforeEach(async () => {
		await ethers.provider.send('hardhat_reset', [
			{
				forking: {
					jsonRpcUrl:
						'https://polygon-mainnet.g.alchemy.com/v2/' + alchemyKeyPolygon,
					blockNumber: 30632152,
				},
			},
		])

		const accounts = await ethers.getSigners()

		account1 = accounts[0]
		gateway = accounts[1]

		const factory = await ethers.getContractFactory('SwapAndStakeV2Polygon')
		swapAndStakeContract = (await factory.deploy(
			uniswapRouterAddress,
			devAddress,
			lockupAddress,
			sTokensManagerAddress,
			wethAddress
		)) as SwapAndStakeV2Polygon
		await swapAndStakeContract.deployed()

		lockupContract = await ethers.getContractAt(
			'contracts/interfaces/ILockup.sol:ILockup',
			lockupAddress
		)
		sTokensManagerContract = await ethers.getContractAt(
			'ISTokensManager',
			sTokensManagerAddress
		)

		wethContract = new ethers.Contract(
			wethAddress,
			[
				'function balanceOf(address owner) view returns (uint256)',
				'function approve(address spender, uint256 amount) public returns (bool)',
			],
			account1
		)

		router = new Contract(
			uniswapRouterAddress,
			[
				'function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)',
			],
			account1
		)
	})
	describe('swap eth for dev', () => {
		it('should stake eth for dev', async () => {
			const ethAmount = ethers.utils.parseEther('1')

			// Get some WETH
			let block = await account1.provider?.getBlock('latest')
			let deadline = block!.timestamp + 300

			// Exchange MATIC for WETH
			await router.swapExactETHForTokens(
				1,
				[
					'0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270', // WMATIC
					'0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', // WETH
				],
				account1.address,
				deadline,
				{
					value: ethers.utils.parseEther('5000'),
				}
			)

			const balance = await wethContract.balanceOf(account1.address)

			// Sanity check to ensure account1 has enough weth
			expect(Number(balance)).to.be.greaterThanOrEqual(Number(ethAmount))

			await wethContract.approve(swapAndStakeContract.address, ethAmount)

			block = await account1.provider?.getBlock('latest')
			deadline = block!.timestamp + 300

			const amountsOut = await swapAndStakeContract.getEstimatedDevForEth(
				ethAmount
			)

			/**
			 * Using amountsOut[2] since we're doing WETH -> WMATIC -> DEV
			 */
			const amountsIn = await swapAndStakeContract.getEstimatedEthForDev(
				amountsOut[2]
			)
			expect(amountsIn[0]).to.equal(amountsOut[0])

			// STokenId = currentIndex + 1 will be minted.
			let sTokenId: BigNumber = await sTokensManagerContract.currentIndex()
			sTokenId = sTokenId.add(1)
			await expect(
				// This is passed since due to function override of swapEthAndStakeDev
				swapAndStakeContract[
					'swapEthAndStakeDev(address,uint256,uint256,bytes32)'
				](propertyAddress, ethAmount, deadline, ethers.constants.HashZero)
			)
				.to.emit(lockupContract, 'Lockedup')
				.withArgs(
					swapAndStakeContract.address,
					propertyAddress,
					amountsOut[2],
					sTokenId
				)

			const sTokenOwner = await sTokensManagerContract.ownerOf(sTokenId)
			const sTokenPosition: number[] = await sTokensManagerContract.positions(
				sTokenId
			)
			expect(sTokenOwner).to.equal(account1.address)
			expect(sTokenPosition[1]).to.equal(amountsOut[2])
		})
		it('should swap and stake with gateway fee', async () => {
			let block = await account1.provider?.getBlock('latest')
			let deadline = block!.timestamp + 300
			const depositAmount = BigNumber.from('1000000000000053927')

			// Exchange MATIC for WETH
			await router.swapExactETHForTokens(
				1,
				[
					'0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270', // WMATIC
					'0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', // WETH
				],
				account1.address,
				deadline,
				{
					value: ethers.utils.parseEther('5000'),
				}
			)

			const balance = await wethContract.balanceOf(account1.address)

			// Sanity check to ensure account1 has enough weth
			expect(Number(balance)).to.be.greaterThanOrEqual(Number(depositAmount))

			await wethContract.approve(swapAndStakeContract.address, depositAmount)

			const gatewayFeeBasisPoints = 333 // In basis points, so 3.33%
			const feeAmount = depositAmount.mul(gatewayFeeBasisPoints).div(10000)

			const amountsOut = await swapAndStakeContract.getEstimatedDevForEth(
				depositAmount.sub(feeAmount)
			)
			const amountsIn = await swapAndStakeContract.getEstimatedEthForDev(
				amountsOut[2]
			)
			expect(amountsIn[0]).to.equal(amountsOut[0])

			let sTokenId: BigNumber = await sTokensManagerContract.currentIndex()

			block = await account1.provider?.getBlock('latest')
			deadline = block!.timestamp + 300

			sTokenId = sTokenId.add(1)
			await expect(
				swapAndStakeContract[
					'swapEthAndStakeDev(address,uint256,uint256,bytes32,address,uint256)'
				](
					propertyAddress,
					depositAmount,
					deadline,
					ethers.constants.HashZero,
					gateway.address,
					gatewayFeeBasisPoints
				)
			)
				.to.emit(lockupContract, 'Lockedup')
				.withArgs(
					swapAndStakeContract.address,
					propertyAddress,
					amountsOut[2],
					sTokenId
				)

			const sTokenOwner = await sTokensManagerContract.ownerOf(sTokenId)
			const sTokenPosition: number[] = await sTokensManagerContract.positions(
				sTokenId
			)

			expect(sTokenOwner).to.equal(account1.address)
			expect(sTokenPosition[1]).to.equal(amountsOut[2])

			// Check gateway has been credited
			expect(
				await swapAndStakeContract.gatewayFees(gateway.address, wethAddress)
			).to.eq(feeAmount)

			// Withdraw credit
			await expect(swapAndStakeContract.connect(gateway).claim(wethAddress))
				.to.emit(swapAndStakeContract, 'Withdrawn')
				.withArgs(gateway.address, wethAddress, feeAmount)

			// Check gateway credit has been deducted
			expect(
				await swapAndStakeContract.gatewayFees(gateway.address, wethAddress)
			).to.eq(0)
		})
	})
})
