import { ethers, upgrades } from 'hardhat'
import type { SwapTokensAndStakeDev__factory } from '../typechain'

const DEPLOYED_ADDRESS = '0x927B51D9Edd43BFDE3586E99BfaCBE08135374AA' // Polygon Mumbai
// const DEPLOYED_ADDRESS = '0xad7CaC908DfF8Dcd1D0d8d0FE3edD25bf339EB57' // Polygon Mainnet

async function main() {
	const contract = (await ethers.getContractFactory(
		'SwapTokensAndStakeDev'
	)) as SwapTokensAndStakeDev__factory
	await upgrades
		.validateUpgrade(DEPLOYED_ADDRESS, contract)
		.then(() => {
			console.log('New implementation is valid')
		})
		.catch((error) => {
			console.error(error)
			process.exit(1)
		})

	// Await upgrades.upgradeProxy(DEPLOYED_ADDRESS, contract)

	// console.log(
	// 	'new implementation is:',
	// 	await upgrades.erc1967.getImplementationAddress(DEPLOYED_ADDRESS)
	// )
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})
