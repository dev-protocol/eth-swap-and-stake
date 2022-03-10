pragma solidity 0.8.7;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import {ILockup} from "@devprotocol/protocol/contracts/interface/ILockup.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import "hardhat/console.sol";

contract UniswapExample {
	address internal constant UNISWAP_ROUTER_ADDRESS =
		0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;
	address public devAddress = 0x5cAf454Ba92e6F2c929DF14667Ee360eD9fD5b26;
	address public lockupAddress = 0xBD2a75e11De78Af8D58595FB16181d505777804F;
	IUniswapV2Router02 public uniswapRouter;

	constructor() {
		uniswapRouter = IUniswapV2Router02(UNISWAP_ROUTER_ADDRESS);
	}

	function stakeEthforDev(uint256 devAmountMin, address property)
		public
		payable
	{
		// solhint-disable-next-line not-rely-on-time
		uint256 deadline = block.timestamp + 15; // using 'now' for convenience, for mainnet pass deadline from frontend!
		uint256[] memory amounts = uniswapRouter.swapExactETHForTokens{
			value: msg.value
		}(devAmountMin, getPathForETHtoDEV(), address(this), deadline);
		IERC20(devAddress).approve(lockupAddress, amounts[1]);
		console.log(property);
		// ILockup(lockupAddress).depositToProperty(property, amounts[1]);
	}

	function getEstimatedDEVforETH(uint256 ethAmount)
		public
		view
		returns (uint256[] memory)
	{
		return uniswapRouter.getAmountsOut(ethAmount, getPathForETHtoDEV());
	}

	function getPathForETHtoDEV() private view returns (address[] memory) {
		address[] memory path = new address[](2);
		path[0] = uniswapRouter.WETH();
		path[1] = devAddress;

		return path;
	}
}
