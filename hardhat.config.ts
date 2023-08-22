import '@typechain/hardhat'
import '@nomiclabs/hardhat-ethers'
import '@nomiclabs/hardhat-waffle'
import '@nomiclabs/hardhat-etherscan'
import '@openzeppelin/hardhat-upgrades'
import 'solidity-coverage'
import { utils } from 'ethers'
import type { HardhatUserConfig } from 'hardhat/config'
import * as dotenv from 'dotenv'

dotenv.config()

const mnemnoc =
	typeof process.env.MNEMONIC === 'undefined' ? '' : process.env.MNEMONIC

const config: HardhatUserConfig = {
	solidity: {
		compilers: [
			{
				version: '0.8.7',
				settings: {
					optimizer: {
						enabled: true,
						runs: 1000,
					},
				},
			},
		],
	},
	networks: {
		hardhat: {
			accounts: {
				mnemonic: mnemnoc,
			},
		},
		mainnet: {
			url: `https://mainnet.infura.io/v3/${process.env.INFURA_KEY!}`,
			accounts: {
				mnemonic: mnemnoc,
			},
		},
		arbitrumOne: {
			url: `https://arbitrum-mainnet.infura.io/v3/${process.env.INFURA_KEY!}`,
			accounts: {
				mnemonic: mnemnoc,
			},
		},
		arbitrumRinkeby: {
			url: `https://arbitrum-rinkeby.infura.io/v3/${process.env.INFURA_KEY!}`,
			accounts: {
				mnemonic: mnemnoc,
			},
		},
		polygonMainnet: {
			url: `https://polygon-mainnet.infura.io/v3/${process.env.INFURA_KEY!}`,
			accounts: {
				mnemonic: mnemnoc,
			},
			gas: 3000000,
			gasPrice: utils.parseUnits('82', 'gwei').toNumber(),
		},
		polygonMumbai: {
			url: `https://polygon-mumbai.infura.io/v3/${process.env.INFURA_KEY!}`,
			accounts: {
				mnemonic: mnemnoc,
			},
		},
	},
	etherscan: {
		apiKey: {
			...((k) => (k ? { mainnet: k } : undefined))(process.env.ETHERSCAN_KEY),
			...((k) => (k ? { arbitrumOne: k, arbitrumTestnet: k } : undefined))(
				process.env.ARBISCAN_KEY
			),
			...((k) => (k ? { polygon: k, polygonMumbai: k } : undefined))(
				process.env.POLYGONSCAN_KEY
			),
		},
	},
}

export default config
