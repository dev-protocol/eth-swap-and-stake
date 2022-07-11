// SPDX-License-Identifier: MPL-2.0
pragma solidity 0.8.7;

import {IUniswapV2Router02} from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

import {SwapAndStakeV2} from "./SwapAndStakeV2.sol";
import {ILockup} from "@devprotocol/protocol/contracts/interface/ILockup.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/// @title Swap ETH to DEV and stake on Polygon
contract SwapAndStakeV2Polygon is SwapAndStakeV2 {
	address public wethAddress;

	constructor(
		address _uniswapRouterAddress,
		address _devAddress,
		address _lockupAddress,
		address _sTokensAddress,
		address _wethAddress
	)
		SwapAndStakeV2(
			_uniswapRouterAddress,
			_devAddress,
			_lockupAddress,
			_sTokensAddress
		)
	{
		wethAddress = _wethAddress;
	}

	/// @notice Swap weth -> wmatic -> dev and stake
	/// @param property the property to stake after swap
	/// @param amount the amount in weth
	/// @param deadline refer to https://docs.uniswap.org/protocol/V1/guides/trade-tokens#deadlines
	function swapEthAndStakeDev(
		address property,
		uint256 amount,
		uint256 deadline
	) external {
		// Transfer the amount from the user to the contract
		IERC20(wethAddress).transferFrom(msg.sender, address(this), amount);
		_swapEthAndStakeDev(amount, property, deadline);
	}

	/// @notice Swap weth -> wmatic -> dev and stake
	/// @param property the property to stake after swap
	/// @param amount the amount in weth
	/// @param deadline refer to https://docs.uniswap.org/protocol/V1/guides/trade-tokens#deadlines
	/// @param gatewayAddress is the address to which the liquidity provider fee will be directed
	/// @param gatewayFee is the basis points to pass. For example 10000 is 100%
	function swapEthAndStakeDev(
		address property,
		uint256 amount,
		uint256 deadline,
		address payable gatewayAddress,
		uint256 gatewayFee
	) external {
		// Transfer the amount from the user to the contract
		IERC20(wethAddress).transferFrom(msg.sender, address(this), amount);

		// send fee to gateway
		uint256 feeAmount = (amount * gatewayFee) / 10000;
		_deposit(gatewayAddress, feeAmount, wethAddress);

		_swapEthAndStakeDev((amount - feeAmount), property, deadline);
	}

	/// @notice Swap weth -> wmatic -> dev and stake
	/// @param amount the amount in weth
	/// @param property the property to stake after swap
	/// @param deadline refer to https://docs.uniswap.org/protocol/V1/guides/trade-tokens#deadlines
	function _swapEthAndStakeDev(
		uint256 amount,
		address property,
		uint256 deadline
	) internal override {
		// Approve weth to be sent to Uniswap Router
		IERC20(wethAddress).approve(address(uniswapRouter), amount);

		// Execute swap
		uint256[] memory outputs = uniswapRouter.swapExactTokensForTokens(
			amount,
			1,
			_getPathForEthToDev(),
			address(this),
			deadline
		);

		IERC20(devAddress).approve(lockupAddress, outputs[2]);
		uint256 tokenId = ILockup(lockupAddress).depositToProperty(
			property,
			outputs[2]
		);
		IERC721(sTokensAddress).safeTransferFrom(
			address(this),
			msg.sender,
			tokenId
		);
	}

	/// @notice Get path for weth -> wmatic -> dev
	/// @return address[]
	function _getPathForEthToDev()
		internal
		view
		override
		returns (address[] memory)
	{
		address[] memory path = new address[](3);
		path[0] = wethAddress;
		path[1] = uniswapRouter.WETH(); // on Polygon this is WMATIC, NOT WETH
		path[2] = devAddress;

		return path;
	}
}
