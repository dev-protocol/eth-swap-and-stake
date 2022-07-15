import { ethers } from 'hardhat'
import { SwapAndStakeV2Polygon } from '../typechain'

async function main() {
	const uniswapRouterAddress = '0x8954AfA98594b838bda56FE4C12a09D7739D179b'
	const devAddress = '0xcbc698ed514dF6e54932a22515d6D0C27E4DA091'
	const lockupAddress = '0xfDC5FF1F07871A247eafE14eEB134eeFcbCf1ceA'
	const sTokensManagerAddress = '0xe0af15141ABd0B31Fb15e250971936Fe8837230a'
	const wethAddress = '0xA6FA4fB5f76172d178d61B04b0ecd319C5d1C0aa'

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
