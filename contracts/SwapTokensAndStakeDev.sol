// SPDX-License-Identifier: MPL-2.0
pragma solidity =0.8.7;
pragma abicoder v2;

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/interfaces/IQuoter.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import {ILockup} from "./interfaces/ILockup.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./Escrow.sol";
import "hardhat/console.sol";

contract SwapTokensAndStakeDev is Escrow {
	// solhint-disable-next-line const-name-snakecase
	ISwapRouter public constant uniswapRouter =
		ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
	// solhint-disable-next-line const-name-snakecase
	IQuoter public constant quoter =
		IQuoter(0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6);

	address public devAddress;
	address public lockupAddress;
	address public sTokensAddress;

	struct Amounts {
		uint256 input;
		uint256 fee;
	}
	mapping(address => Amounts) public gatewayOf;

	constructor(
		address _devAddress,
		address _lockupAddress,
		address _sTokensAddress
	) {
		devAddress = _devAddress;
		lockupAddress = _lockupAddress;
		sTokensAddress = _sTokensAddress;
	}

	// For native token
	function swapTokensAndStakeDev(
		bytes memory path,
		address property,
		uint256 _amountOut,
		uint256 deadline,
		bytes32 payload,
		address payable gatewayAddress,
		uint256 gatewayFee
	) external payable {
		require(msg.value > 0, "Must pass non-zero amount");
		require(gatewayFee < 10000, "must be below 10000");
		// handle fee
		uint256 feeAmount = (msg.value * gatewayFee) / 10000;
		_deposit(gatewayAddress, feeAmount, address(0));

		gatewayOf[gatewayAddress] = Amounts(msg.value, feeAmount);

		_swapTokensAndStakeDev(
			path,
			property,
			(msg.value - feeAmount),
			_amountOut,
			deadline,
			payload
		);
		delete gatewayOf[gatewayAddress];
	}

	// For ERC20
	function swapTokensAndStakeDev(
		IERC20 token,
		bytes memory path,
		address property,
		uint256 amount,
		uint256 _amountOut,
		uint256 deadline,
		bytes32 payload,
		address payable gatewayAddress,
		uint256 gatewayFee
	) external {
		require(gatewayFee < 10000, "must be below 10000");
		require(
			token.allowance(msg.sender, address(this)) >= amount,
			"insufficient allowance"
		);
		require(token.balanceOf(msg.sender) >= amount, "insufficient balance");
		// Transfer the amount from the user to the contract
		TransferHelper.safeTransferFrom(
			address(token),
			msg.sender,
			address(this),
			amount
		);
		// handle fee
		uint256 feeAmount = (amount * gatewayFee) / 10000;
		_deposit(gatewayAddress, feeAmount, address(token));

		gatewayOf[gatewayAddress] = Amounts(amount, feeAmount);

		_swapTokensAndStakeDev(
			token,
			path,
			property,
			(amount - feeAmount),
			_amountOut,
			deadline,
			payload
		);
		delete gatewayOf[gatewayAddress];
	}

	// do not use on-chain, gas inefficient!
	function getEstimatedTokensForDev(uint256 devAmount, bytes memory path)
		external
		returns (uint256)
	{
		return quoter.quoteExactInput(path, devAmount);
	}

	// do not use on-chain, gas inefficient!
	function getEstimatedDevForTokens(uint256 tokenAmount, bytes memory path)
		external
		returns (uint256)
	{
		return quoter.quoteExactInput(path, tokenAmount);
	}

	// erc20
	function _swapTokensAndStakeDev(
		IERC20 token,
		bytes memory _path,
		address property,
		uint256 amount,
		uint256 _amountOut,
		uint256 deadline,
		bytes32 payload
	) private {
		address recipient = address(this);
		uint256 amountIn = amount;

		// 	Approve the router to spend the token amount
		TransferHelper.safeApprove(
			address(token),
			address(uniswapRouter),
			amount
		);

		// Multiple pool swaps are encoded through bytes called a `path`. A path is a sequence of token addresses and poolFees that define the pools used in the swaps.
		// The format for pool encoding is (tokenIn, fee, tokenOut/tokenIn, fee, tokenOut) where tokenIn/tokenOut parameter is the shared token across the pools.
		ISwapRouter.ExactInputParams memory params = ISwapRouter
			.ExactInputParams({
				path: _path,
				recipient: recipient,
				deadline: deadline,
				amountIn: amountIn,
				amountOutMinimum: _amountOut
			});
		uint256 amountOut = uniswapRouter.exactInput(params);
		IERC20(devAddress).approve(lockupAddress, amountOut);
		uint256 tokenId = ILockup(lockupAddress).depositToProperty(
			property,
			amountOut,
			payload
		);
		IERC721(sTokensAddress).safeTransferFrom(
			address(this),
			msg.sender,
			tokenId
		);
	}

	// native token
	function _swapTokensAndStakeDev(
		bytes memory _path,
		address property,
		uint256 amount,
		uint256 _amountOut,
		uint256 deadline,
		bytes32 payload
	) private {
		address recipient = address(this);
		uint256 amountIn = amount;

		// Multiple pool swaps are encoded through bytes called a `path`. A path is a sequence of token addresses and poolFees that define the pools used in the swaps.
		// The format for pool encoding is (tokenIn, fee, tokenOut/tokenIn, fee, tokenOut) where tokenIn/tokenOut parameter is the shared token across the pools.
		ISwapRouter.ExactInputParams memory params = ISwapRouter
			.ExactInputParams({
				path: _path,
				recipient: recipient,
				deadline: deadline,
				amountIn: amountIn,
				amountOutMinimum: _amountOut
			});
		uint256 amountOut = uniswapRouter.exactInput{value: amount}(params);

		IERC20(devAddress).approve(lockupAddress, amountOut);
		uint256 tokenId = ILockup(lockupAddress).depositToProperty(
			property,
			amountOut,
			payload
		);
		IERC721(sTokensAddress).safeTransferFrom(
			address(this),
			msg.sender,
			tokenId
		);
	}
}
