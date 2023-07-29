import { ethers } from 'hardhat'
import { type SwapAndStakeV3 } from '../typechain'

async function main() {
	const wethAddress = '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1'
	const devAddress = '0x91F5dC90979b058eBA3be6B7B7e523df7e84e137'
	const lockupAddress = '0x1A2B49e10013C40AAC9b6f9e785837bfd329e5e0'
	const sTokensManagerAddress = '0x40d999931f7055F670511860e24624939e71a96a'

	const factory = await ethers.getContractFactory('SwapAndStakeV3')
	const swapAndStakeContract = (await factory.deploy(
		wethAddress,
		devAddress,
		lockupAddress,
		sTokensManagerAddress
	)) as SwapAndStakeV3
	await swapAndStakeContract.deployed()

	console.log('Swap address:', swapAndStakeContract.address)
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})
