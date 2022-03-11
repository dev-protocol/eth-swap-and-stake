// SPDX-License-Identifier: MIT
pragma solidity =0.8.7;
pragma abicoder v2;

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/interfaces/IQuoter.sol";

import "hardhat/console.sol";

contract Uniswap3 {
	// solhint-disable-next-line const-name-snakecase
	ISwapRouter public constant uniswapRouter =
		ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
	// solhint-disable-next-line const-name-snakecase
	IQuoter public constant quoter =
		IQuoter(0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6);

	address public wethAddress;
	address public devAddress;
	address public lockupAddress;

	constructor(
		address _wethAddress,
		address _devAddress,
		address _lockupAddress
	) {
		wethAddress = _wethAddress;
		devAddress = _devAddress;
		lockupAddress = _lockupAddress;
	}

	function stakeEthforDev() external payable {
		require(msg.value > 0, "Must pass non 0 ETH amount");

		// solhint-disable-next-line not-rely-on-time
		uint256 deadline = block.timestamp + 15; // using 'now' for convenience, for mainnet pass deadline from frontend!
		address tokenIn = wethAddress;
		address tokenOut = devAddress;
		uint24 fee = 3000;
		address recipient = address(this);
		uint256 amountIn = msg.value;
		uint256 amountOutMinimum = 1;
		uint160 sqrtPriceLimitX96 = 0;

		ISwapRouter.ExactInputSingleParams memory params = ISwapRouter
			.ExactInputSingleParams(
				tokenIn,
				tokenOut,
				fee,
				recipient,
				deadline,
				amountIn,
				amountOutMinimum,
				sqrtPriceLimitX96
			);

		uniswapRouter.exactInputSingle{value: msg.value}(params);
	}

	// do not used on-chain, gas inefficient!
	function getEstimatedDEVforETH(uint256 ethAmount)
		external
		payable
		returns (uint256)
	{
		address tokenIn = wethAddress;
		address tokenOut = devAddress;
		uint24 fee = 3000;
		uint160 sqrtPriceLimitX96 = 0;

		return
			quoter.quoteExactInputSingle(
				tokenIn,
				tokenOut,
				fee,
				ethAmount,
				sqrtPriceLimitX96
			);
	}
}
