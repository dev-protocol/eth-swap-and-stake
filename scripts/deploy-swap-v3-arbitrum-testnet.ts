import { ethers } from 'hardhat'
import { SwapAndStakeV3 } from '../typechain'

async function main() {
	const wethAddress = '0xB47e6A5f8b33b3F17603C83a0535A9dcD7E32681'
	const devAddress = '0xc28BBE3B5ec1b06FDe258864f12c1577DaDFadDC'
	const lockupAddress = '0x4944CA0423f42DF7c77ad8Cd53F30f31A097F4fa'
	const sTokensManagerAddress = '0xe45d65c6d6aA3e2a4c8aAcc0C8153778663fe794'

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
