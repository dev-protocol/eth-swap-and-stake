import { ethers } from 'hardhat'
import { type Contract, BigNumber } from 'ethers'
import {
	type UpgradeableProxy,
	type UpgradeableProxy__factory,
	type ProxyAdmin,
} from '../typechain'

export const deploy = async <C extends Contract>(name: string): Promise<C> => {
	const factory = await ethers.getContractFactory(name)
	const contract = await factory.deploy()
	await contract.deployed()
	return contract as C
}

export const deployProxy = async (
	logic: string,
	admin: string,
	data: Readonly<Uint8Array>
): Promise<UpgradeableProxy> => {
	const factory = (await ethers.getContractFactory(
		'UpgradeableProxy'
	)) as UpgradeableProxy__factory
	const contract = await factory.deploy(logic, admin, data)
	await contract.deployed()
	return contract
}

export const deployWithProxy = async <C extends Contract>(
	name: string
): Promise<[C, string, ProxyAdmin]> => {
	const factory = await ethers.getContractFactory(name)
	const adminFactory = await ethers.getContractFactory('Admin')
	const adminDeployed = await (await adminFactory.deploy()).deployed()
	const deployedContract = await (await factory.deploy()).deployed()
	const proxy = await deployProxy(
		deployedContract.address,
		adminDeployed.address,
		new Uint8Array()
	)
	const admin = await adminDeployed.attach(adminDeployed.address).owner()
	return [
		deployedContract.attach(proxy.address) as C,
		admin,
		adminDeployed as ProxyAdmin,
	]
}

export const toBigNumber = (v: string | number | BigNumber): BigNumber =>
	BigNumber.from(v)
