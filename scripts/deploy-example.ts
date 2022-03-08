import {UniswapExample} from '../typechain'
import {ethers, run} from 'hardhat'
import {delay} from '../utils'
const dotenv = require('dotenv')
const fs = require('fs')

async function deploySwap() {
	const Swap = await ethers.getContractFactory('UniswapExample')
	console.log('starting deploying UniswapExample...')
	const swap = await Swap.deploy() as UniswapExample
	console.log('UniswapExample` deployed with address: ' + swap.address)
	console.log('wait of deploying...')
	await swap.deployed()
	console.log('wait of delay...')
	await delay(25000)
	console.log('starting verify swap...')
	try {
		await run('verify:verify', {
			address: swap!.address,
			contract: 'contracts/UniswapExample.sol:UniswapExample',
		});
		console.log('verify success')
	} catch (e: any) {
		console.log(e.message)
	}

}

deploySwap()
.then(() => process.exit(0))
.catch(error => {
	console.error(error)
	process.exit(1)
})