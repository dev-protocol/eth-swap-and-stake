// SPDX-License-Identifier: MPL-2.0
pragma solidity 0.8.7;

import {IUniswapV2Router02} from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

import {SwapAndStakeV2} from "./SwapAndStakeV2.sol";
import {ILockup} from "./interfaces/ILockup.sol";
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
	/// @param payload allows for additional data when minting SToken
	function swapEthAndStakeDev(
		address property,
		uint256 amount,
		uint256 deadline,
		bytes32 payload
	) external {
		// Transfer the amount from the user to the contract
		IERC20(wethAddress).transferFrom(msg.sender, address(this), amount);

		gatewayOf[address(0)] = Amounts(amount, 0);

		_swapEthAndStakeDev(amount, property, deadline, payload);

		delete gatewayOf[address(0)];
	}

	/// @notice Swap weth -> wmatic -> dev and stake
	/// @param property the property to stake after swap
	/// @param amount the amount in weth
	/// @param deadline refer to https://docs.uniswap.org/protocol/V1/guides/trade-tokens#deadlines
	/// @param gatewayAddress is the address to which the liquidity provider fee will be directed
	/// @param gatewayFee is the basis points to pass. For example 10000 is 100%
	/// @param payload allows for additional data when minting SToken
	function swapEthAndStakeDev(
		address property,
		uint256 amount,
		uint256 deadline,
		bytes32 payload,
		address payable gatewayAddress,
		uint256 gatewayFee
	) external {
		// Transfer the amount from the user to the contract
		IERC20(wethAddress).transferFrom(msg.sender, address(this), amount);

		// send fee to gateway
		uint256 feeAmount = (amount * gatewayFee) / 10000;
		_deposit(gatewayAddress, feeAmount, wethAddress);

		gatewayOf[gatewayAddress] = Amounts(amount, feeAmount);

		_swapEthAndStakeDev((amount - feeAmount), property, deadline, payload);

		delete gatewayOf[gatewayAddress];
	}

	/// @notice get estimated DEV output from ETH input
	/// @param ethAmount in ETH
	/// @return outputs UniSwap Router Outputs
	function getEstimatedDevForEth(uint256 ethAmount)
		external
		view
		returns (uint256[] memory)
	{
		return _getEstimatedDevForEth(ethAmount, _getPathForEthToDev);
	}

	/// @notice get estimated ETH output from DEV input
	/// @param devAmount in ETH
	/// @return outputs UniSwap Router Outputs
	function getEstimatedEthForDev(uint256 devAmount)
		external
		view
		returns (uint256[] memory)
	{
		return _getEstimatedEthForDev(devAmount, _getPathForEthToDev);
	}

	//=================================== INTERNAL ==============================================
	/// @notice Path from ETH -> DEV for uniswap router
	/// @return Path address array
	function _getPathForEthToDev() internal view returns (address[] memory) {
		address[] memory path = new address[](3);
		path[0] = wethAddress;
		path[1] = uniswapRouter.WETH(); // on Polygon this is WMATIC, NOT WETH
		path[2] = devAddress;

		return path;
	}

	/// @notice Swap weth -> wmatic -> dev and stake
	/// @param amount the amount in weth
	/// @param property the property to stake after swap
	/// @param deadline refer to https://docs.uniswap.org/protocol/V1/guides/trade-tokens#deadlines
	/// @param payload allows for additional data when minting SToken
	function _swapEthAndStakeDev(
		uint256 amount,
		address property,
		uint256 deadline,
		bytes32 payload
	) internal {
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

		// approve contract
		IERC20(devAddress).approve(lockupAddress, outputs[2]);

		// deposit to property
		uint256 tokenId = ILockup(lockupAddress).depositToProperty(
			property,
			outputs[2],
			payload
		);

		// transfer the sToken to the user
		IERC721(sTokensAddress).safeTransferFrom(
			address(this),
			msg.sender,
			tokenId
		);
	}
}
