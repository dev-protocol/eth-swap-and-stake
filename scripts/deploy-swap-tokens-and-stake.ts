import { ethers, upgrades } from 'hardhat'
import type { SwapTokensAndStakeDev__factory } from '../typechain'

const devAddress = '0xcbc698ed514dF6e54932a22515d6D0C27E4DA091'
const lockupAddress = '0xfDC5FF1F07871A247eafE14eEB134eeFcbCf1ceA'
const sTokensManagerAddress = '0xe0af15141ABd0B31Fb15e250971936Fe8837230a'

async function main() {
	const contract = (await ethers.getContractFactory(
		'SwapTokensAndStakeDev'
	)) as SwapTokensAndStakeDev__factory

	const impl = await upgrades.deployImplementation(contract)
	const admin = await upgrades.deployProxyAdmin()
	const deployedContract = await upgrades.deployProxy(
		contract,
		[devAddress, lockupAddress, sTokensManagerAddress],
		{
			initializer: 'initialize',
		}
	)

	console.log('Implementation address:', impl)
	console.log('Admin address:', admin)
	console.log('UpgradeableProxy address:', deployedContract.address)
}

main()
	.then(() => process.exit(0))
	.catch((error) => {
		console.error(error)
		process.exit(1)
	})
