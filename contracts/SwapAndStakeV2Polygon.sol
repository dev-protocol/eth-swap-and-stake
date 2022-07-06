// SPDX-License-Identifier: MPL-2.0
pragma solidity 0.8.7;

import {IUniswapV2Router02} from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

import {SwapAndStakeV2} from "./SwapAndStakeV2.sol";
import {ILockup} from "@devprotocol/protocol/contracts/interface/ILockup.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "hardhat/console.sol";

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

	function swapEthAndStakeDev(address property, uint256 _amount)
		external
		virtual
	{
		// solhint-disable-next-line not-rely-on-time
		uint256 deadline = block.timestamp + 300; // using 'now' for convenience, for mainnet pass deadline from frontend!

		uint256[] memory amount = uniswapRouter.swapExactTokensForTokens(
			_amount,
			1,
			_getPathForEthToDev(),
			address(this),
			deadline
		);

		IERC20(devAddress).approve(lockupAddress, amount[2]);
		uint256 tokenId = ILockup(lockupAddress).depositToProperty(
			property,
			amount[2]
		);
		IERC721(sTokensAddress).safeTransferFrom(
			address(this),
			msg.sender,
			tokenId
		);
	}

	function _getPathForEthToDev()
		internal
		view
		override
		returns (address[] memory)
	{
		address[] memory path = new address[](3);
		path[0] = wethAddress;
		path[1] = uniswapRouter.WETH(); // on Polygon this is WMATIC
		path[2] = devAddress;

		return path;
	}
}
