import { UniswapExample } from '../typechain'
import { ethers } from 'hardhat'

async function deploySwap() {
	const Swap = await ethers.getContractFactory('UniswapExample')
	console.log('starting deploying UniswapExample...')
	const swap = (await Swap.deploy()) as UniswapExample
	console.log('UniswapExample` deployed with address: ' + swap.address)
	console.log('wait of deploying...')
	await swap.deployed()
}

deploySwap()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})
