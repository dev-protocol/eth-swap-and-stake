import { ethers } from 'hardhat'
import { type SwapAndStakeV2L1 } from '../typechain'

async function main() {
	const uniswapRouterAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'
	const devAddress = '0x5caf454ba92e6f2c929df14667ee360ed9fd5b26'
	const lockupAddress = '' // What should this be?
	const sTokensManagerAddress = '0x50489Ff5f879A44C87bBA85287729D663b18CeD5'

	const factory = await ethers.getContractFactory('SwapAndStakeV2L1')
	const swapAndStakeContract = (await factory.deploy(
		uniswapRouterAddress,
		devAddress,
		lockupAddress,
		sTokensManagerAddress
	)) as SwapAndStakeV2L1
	await swapAndStakeContract.deployed()

	console.log('Swap address:', swapAndStakeContract.address)
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})
