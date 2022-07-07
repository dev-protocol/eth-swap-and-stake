// SPDX-License-Identifier: MPL-2.0
pragma solidity 0.8.7;

import {IUniswapV2Router02} from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

import {SwapAndStakeV2} from "./SwapAndStakeV2.sol";
import {ILockup} from "@devprotocol/protocol/contracts/interface/ILockup.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "hardhat/console.sol";

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
	/// @param _property the property to stake after swap
	/// @param _amount the amount in weth
	/// @param _deadline refer to https://docs.uniswap.org/protocol/V1/guides/trade-tokens#deadlines
	function swapEthAndStakeDev(
		address _property,
		uint256 _amount,
		uint256 _deadline
	) external virtual {
		IERC20(wethAddress).transferFrom(msg.sender, address(this), _amount);

		IERC20(wethAddress).approve(address(uniswapRouter), _amount);

		uint256[] memory amount = uniswapRouter.swapExactTokensForTokens(
			_amount,
			1,
			_getPathForEthToDev(),
			address(this),
			_deadline
		);

		console.log("amount[0]: ", amount[0]);
		console.log("amount[1]: ", amount[1]);
		console.log("amount[2]: ", amount[2]);

		IERC20(devAddress).approve(lockupAddress, amount[2]);
		uint256 tokenId = ILockup(lockupAddress).depositToProperty(
			_property,
			amount[2]
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
