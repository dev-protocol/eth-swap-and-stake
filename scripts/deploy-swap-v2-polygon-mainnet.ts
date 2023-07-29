import { ethers } from 'hardhat'
import { type SwapAndStakeV2Polygon } from '../typechain'

async function main() {
	const uniswapRouterAddress = '0xa5E0829CaCEd8fFDD4De3c43696c57F7D7A678ff'
	const devAddress = '0xA5577D1cec2583058A6Bd6d5DEAC44797c205701'
	const lockupAddress = '0x42767B12d3f07bE0D951a64eE6573B40Ff165C4e'
	const sTokensManagerAddress = '0x89904De861CDEd2567695271A511B3556659FfA2'
	const wethAddress = '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619'

	const factory = await ethers.getContractFactory('SwapAndStakeV2Polygon')
	const swapAndStakeContract = (await factory.deploy(
		uniswapRouterAddress,
		devAddress,
		lockupAddress,
		sTokensManagerAddress,
		wethAddress
	)) as SwapAndStakeV2Polygon
	await swapAndStakeContract.deployed()

	console.log('Swap address:', swapAndStakeContract.address)
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})
