// SPDX-License-Identifier: MIT
pragma solidity =0.8.7;
pragma abicoder v2;

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/interfaces/IQuoter.sol";

interface IUniswapRouter is ISwapRouter {
	function refundETH() external payable;
}

contract Uniswap3 {
	// solhint-disable-next-line const-name-snakecase
	IUniswapRouter public constant uniswapRouter =
		IUniswapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
	// solhint-disable-next-line const-name-snakecase
	IQuoter public constant quoter =
		IQuoter(0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6);

	function convertExactEthToDai(address weth9, address multiDaiKovan)
		external
		payable
	{
		require(msg.value > 0, "Must pass non 0 ETH amount");

		// solhint-disable-next-line not-rely-on-time
		uint256 deadline = block.timestamp + 15; // using 'now' for convenience, for mainnet pass deadline from frontend!
		address tokenIn = weth9;
		address tokenOut = multiDaiKovan;
		uint24 fee = 3000;
		address recipient = msg.sender;
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
		uniswapRouter.refundETH();

		// refund leftover ETH to user
		// solhint-disable-next-line avoid-low-level-calls
		(bool success, ) = msg.sender.call{value: address(this).balance}("");
		require(success, "refund failed");
	}

	function convertEthToExactDai(
		address weth9,
		uint256 daiAmount,
		address multiDaiKovan
	) external payable {
		require(daiAmount > 0, "Must pass non 0 DAI amount");
		require(msg.value > 0, "Must pass non 0 ETH amount");

		// solhint-disable-next-line not-rely-on-time
		uint256 deadline = block.timestamp + 15; // using 'now' for convenience, for mainnet pass deadline from frontend!
		address tokenIn = weth9;
		address tokenOut = multiDaiKovan;
		uint24 fee = 3000;
		address recipient = msg.sender;
		uint256 amountOut = daiAmount;
		uint256 amountInMaximum = msg.value;
		uint160 sqrtPriceLimitX96 = 0;

		ISwapRouter.ExactOutputSingleParams memory params = ISwapRouter
			.ExactOutputSingleParams(
				tokenIn,
				tokenOut,
				fee,
				recipient,
				deadline,
				amountOut,
				amountInMaximum,
				sqrtPriceLimitX96
			);

		uniswapRouter.exactOutputSingle{value: msg.value}(params);
		uniswapRouter.refundETH();

		// refund leftover ETH to user
		// solhint-disable-next-line avoid-low-level-calls
		(bool success, ) = msg.sender.call{value: address(this).balance}("");
		require(success, "refund failed");
	}

	// do not used on-chain, gas inefficient!
	function getEstimatedETHforDAI(
		address weth9,
		uint256 daiAmount,
		address multiDaiKovan
	) external payable returns (uint256) {
		address tokenIn = weth9;
		address tokenOut = multiDaiKovan;
		uint24 fee = 3000;
		uint160 sqrtPriceLimitX96 = 0;

		return
			quoter.quoteExactOutputSingle(
				tokenIn,
				tokenOut,
				fee,
				daiAmount,
				sqrtPriceLimitX96
			);
	}

	// important to receive ETH
	receive() external payable {}
}
