import '@nomiclabs/hardhat-waffle'
import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-ethers'
import '@typechain/hardhat'
import 'solidity-coverage'
import * as dotenv from 'dotenv'

dotenv.config()

const chainIds: Record<string, number> = {
	ganache: 1337,
	goerli: 5,
	hardhat: 31337,
	kovan: 42,
	mainnet: 1,
	rinkeby: 4,
	ropsten: 3,
	'polygon-mumbai': 80001,
	'polygon-mainnet': 137,
}

const mnemonic =
	typeof process.env.MNEMONIC === 'undefined' ? '' : process.env.MNEMONIC

const infuraApiKey =
	typeof process.env.INFURA_KEY === 'undefined' ? '' : process.env.INFURA_KEY

// Const alchemyKeyMainnet =
// 	typeof process.env.ALCHEMY_KEY_MAINNET === 'undefined'
// 		? ''
// 		: process.env.ALCHEMY_KEY_MAINNET
// Const alchemyKeyArbitrum =
// 	typeof process.env.ALCHEMY_KEY_ARBITRUM === 'undefined' ? '' : process.env.ALCHEMY_KEY_ARBITRUM

function createNetworkConfig(network: string) {
	const url = 'https://' + network + '.infura.io/v3/' + infuraApiKey
	return {
		accounts: {
			count: 10,
			initialIndex: 0,
			mnemonic,
			path: "m/44'/60'/0'/0",
		},
		chainId: chainIds[network],
		url,
		gas: 6700000, // Gas sent with each transaction (default: ~6700000)
		gasPrice: 35000000000, // 7 gwei (in wei) (default: 100 gwei)
	}
}

module.exports = {
	defaultNetwork: 'hardhat',
	etherscan: {
		apiKey: {
			polygon: process.env.POLYGONSCAN_KEY,
			polygonMumbai: process.env.POLYGONSCAN_KEY,
			arbitrumOne: process.env.ARBISCAN_KEY,
			arbitrumTestnet: process.env.ARBISCAN_KEY,
			rinkeby: process.env.ETHERSCAN_KEY,
			ropsten: process.env.ETHERSCAN_KEY,
		},
	},
	networks: {
		hardhat: {
			accounts: {
				mnemonic,
			},
			// ChainId: chainIds.hardhat,
			// forking: {
			// 	url: 'https://eth-mainnet.alchemyapi.io/v2/' + alchemyKeyMainnet,
			// 	blockNumber: 12057273,
			// Url: 'https://arb-mainnet.g.alchemy.com/v2/' + alchemyKeyArbitrum,
			// blockNumber: 7683813,
			// },
		},
		mainnet: createNetworkConfig('mainnet'),
		goerli: createNetworkConfig('goerli'),
		kovan: createNetworkConfig('kovan'),
		rinkeby: createNetworkConfig('rinkeby'),
		ropsten: createNetworkConfig('ropsten'),
		polygon: createNetworkConfig('polygon-mainnet'),
		polygonMumbai: createNetworkConfig('polygon-mumbai'),
		arbitrumRinkeby: createNetworkConfig('arbitrum-rinkeby'),
		arbitrumMainnet: createNetworkConfig('arbitrum-mainnet'),
		bsc_testnet: {
			url: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
			chainId: 97,
			gasPrice: 'auto',
			// GasLimit: 10000000,
			accounts: { mnemonic },
		},
		bsc: {
			url: 'https://bsc-dataseed.binance.org/',
			chainId: 56,
			gasPrice: 'auto',
			// GasLimit: 10000000,
			accounts: { mnemonic },
		},
	},
	paths: {
		artifacts: './artifacts',
		cache: './cache',
		sources: './contracts',
		tests: './test',
	},
	solidity: {
		compilers: [
			{
				version: '0.8.7',
				settings: {
					optimizer: {
						enabled: true,
						runs: 200,
					},
				},
			},
		],
	},
	docgen: {
		path: './docs',
		clear: true,
		runOnCompile: true,
	},
}
