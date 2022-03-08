import '@nomiclabs/hardhat-waffle'
import '@nomiclabs/hardhat-etherscan'
import '@nomiclabs/hardhat-ethers'
// import '@nomiclabs/hardhat-web3'
import '@typechain/hardhat'
import 'solidity-coverage'
// import 'hardhat-docgen'
// import '@openzeppelin/hardhat-upgrades'
import "@nomiclabs/hardhat-etherscan"

require('dotenv').config()
// require('./tasks')

const chainIds: { [key: string]: number } = {
  ganache: 1337,
  goerli: 5,
  hardhat: 31337,
  kovan: 42,
  mainnet: 1,
  rinkeby: 4,
  ropsten: 3
}

// Ensure that we have all the environment variables we need.
let mnemonic: string
if (!process.env.MNEMONIC) {
  throw new Error('Please set your MNEMONIC in a .env file')
} else {
  mnemonic = process.env.MNEMONIC
}

let infuraApiKey: string
if (!process.env.INFURA_KEY) {
  throw new Error('Please set your INFURA_KEY in a .env file')
} else {
  infuraApiKey = process.env.INFURA_KEY
}

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
    // gas: 'auto',
    // gasPrice: 1000000000
    gas: 4712388,
    gasPrice: 50000000000,
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
      ropsten: process.env.ETHERSCAN_KEY
    },
  },
  networks: {
    hardhat: {
      accounts: {
        mnemonic,
      },
      // chainId: chainIds.hardhat,
      forking: {
        url: "https://eth-mainnet.alchemyapi.io/v2/" + process.env.ALCHEMY_KEY,
        // url: "https://eth-ropsten.alchemyapi.io/v2/" + process.env.ALCHEMY_KEY,
        blockNumber: 12057273
      }
    },
    mainnet: createNetworkConfig('mainnet'),
    goerli: createNetworkConfig('goerli'),
    kovan: createNetworkConfig('kovan'),
    rinkeby: createNetworkConfig('rinkeby'),
    ropsten: createNetworkConfig('ropsten'),
    polygonMumbai: createNetworkConfig('polygon-mumbai'),
    arbitrumRinkeby: createNetworkConfig('arbitrum-rinkeby'),
    bsc_testnet: {
      url: 'https://data-seed-prebsc-1-s1.binance.org:8545/',
      chainId: 97,
      gasPrice: 'auto',
      // gasLimit: 10000000,
      accounts: { mnemonic: mnemonic },
    },
    bsc: {
      url: 'https://bsc-dataseed.binance.org/',
      chainId: 56,
      gasPrice: 'auto',
      // gasLimit: 10000000,
      accounts: { mnemonic: mnemonic },
    }
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
  }
}
