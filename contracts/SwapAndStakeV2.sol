// SPDX-License-Identifier: MPL-2.0
pragma solidity 0.8.7;

import {IUniswapV2Router02} from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import {ILockup} from "@devprotocol/protocol/contracts/interface/ILockup.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "./Escrow.sol";

contract SwapAndStakeV2 is Escrow {
	address public devAddress;
	address public lockupAddress;
	address public sTokensAddress;
	IUniswapV2Router02 public uniswapRouter;

	constructor(
		address _uniswapRouterAddress,
		address _devAddress,
		address _lockupAddress,
		address _sTokensAddress
	) {
		uniswapRouter = IUniswapV2Router02(_uniswapRouterAddress);
		devAddress = _devAddress;
		lockupAddress = _lockupAddress;
		sTokensAddress = _sTokensAddress;
	}

	/// @notice Swap eth -> dev and stake
	/// @param property the property to stake after swap
	/// @param deadline refer to https://docs.uniswap.org/protocol/V1/guides/trade-tokens#deadlines
	function swapEthAndStakeDev(address property, uint256 deadline)
		external
		payable
	{
		_swapEthAndStakeDev(msg.value, property, deadline);
	}

	/// @notice Swap eth -> dev and stake with GATEWAY FEE paid in ETH
	/// @param property the property to stake after swap
	/// @param deadline refer to https://docs.uniswap.org/protocol/V1/guides/trade-tokens#deadlines
	/// @param gatewayAddress is the address to which the liquidity provider fee will be directed
	/// @param gatewayFee is the basis points to pass. For example 10000 is 100%
	function swapEthAndStakeDev(
		address property,
		uint256 deadline,
		address payable gatewayAddress,
		uint256 gatewayFee
	) external payable {
		require(gatewayFee <= 10000, "must be below 10000");

		// handle fee
		uint256 feeAmount = (msg.value * gatewayFee) / 10000;
		_deposit(gatewayAddress, feeAmount, address(0));

		_swapEthAndStakeDev((msg.value - feeAmount), property, deadline);
	}

	/// @notice Swap eth -> dev handles transfer and stake
	/// @param amount in ETH
	/// @param property the property to stake after swap
	/// @param deadline refer to https://docs.uniswap.org/protocol/V1/guides/trade-tokens#deadlines
	function _swapEthAndStakeDev(
		uint256 amount,
		address property,
		uint256 deadline
	) internal virtual {
		uint256[] memory amounts = uniswapRouter.swapExactETHForTokens{
			value: amount
		}(1, _getPathForEthToDev(), address(this), deadline);
		IERC20(devAddress).approve(lockupAddress, amounts[1]);
		uint256 tokenId = ILockup(lockupAddress).depositToProperty(
			property,
			amounts[1]
		);
		IERC721(sTokensAddress).safeTransferFrom(
			address(this),
			msg.sender,
			tokenId
		);
	}

	function getEstimatedDevForEth(uint256 ethAmount)
		public
		view
		returns (uint256[] memory)
	{
		return uniswapRouter.getAmountsOut(ethAmount, _getPathForEthToDev());
	}

	function getEstimatedEthForDev(uint256 devAmount)
		public
		view
		returns (uint256[] memory)
	{
		return uniswapRouter.getAmountsIn(devAmount, _getPathForEthToDev());
	}

	function _getPathForEthToDev()
		internal
		view
		virtual
		returns (address[] memory)
	{
		address[] memory path = new address[](2);
		path[0] = uniswapRouter.WETH();
		path[1] = devAddress;

		return path;
	}
}
