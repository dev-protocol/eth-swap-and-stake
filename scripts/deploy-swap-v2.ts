import { ethers } from 'hardhat'
import { deployProxy } from './utils'
import { SwapAndStakeV2 } from '../typechain'

async function main() {
  const uniswapRouterAddress = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'
  const devAddress = '0x4c0af2506Cf270D1902EBF2caE2d765042391e8a'
  const lockupAddress = '0xfDC5FF1F07871A247eafE14eEB134eeFcbCf1ceA'
  const sTokensManagerAddress = '0xe0af15141ABd0B31Fb15e250971936Fe8837230a'

  const factory = await ethers.getContractFactory('SwapAndStakeV2')
  const swapAndStakeContract = (await factory.deploy(
    uniswapRouterAddress,
    devAddress,
    lockupAddress,
    sTokensManagerAddress
  )) as SwapAndStakeV2
  await swapAndStakeContract.deployed()

  const adminAddress = '0xa978eA3735B7508E6144F0a007F4f6B4f332DA65'

  const upgradeableProxy = await deployProxy(
    swapAndStakeContract.address,
    adminAddress,
    ethers.utils.arrayify('0x')
  )

  console.log('Swap address:', swapAndStakeContract.address)
  console.log('Admin address:', adminAddress)
  console.log('UpgradeableProxy address:', upgradeableProxy.address)
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })