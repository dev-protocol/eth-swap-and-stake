import { ethers } from 'hardhat'
import { SwapTokensAndStakeDev__factory } from '../typechain'

async function main() {
	const devAddress = '0xcbc698ed514dF6e54932a22515d6D0C27E4DA091'
	const lockupAddress = '0xfDC5FF1F07871A247eafE14eEB134eeFcbCf1ceA'
	const sTokensManagerAddress = '0xe0af15141ABd0B31Fb15e250971936Fe8837230a'

	const factory = (await ethers.getContractFactory(
		'SwapTokensAndStakeDev'
	)) as SwapTokensAndStakeDev__factory
	const swapAndStakeContract = await factory.deploy(
		devAddress,
		lockupAddress,
		sTokensManagerAddress
	)
	await swapAndStakeContract.deployed()

	console.log('Swap address:', swapAndStakeContract.address)
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})
