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
	mapping(bytes32 => bool) public isExecuting;
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

	/// @notice get estimated Dev output from ETH input
	/// @param ethAmount input amount in ETH
	/// @param getPathForEthToDev passes in function that fetches path for Uniswap Router
	/// @return outputs UniSwap Router Outputs
	function _getEstimatedDevForEth(
		uint256 ethAmount,
		function() internal view returns (address[] memory) getPathForEthToDev
	) internal view returns (uint256[] memory) {
		return uniswapRouter.getAmountsOut(ethAmount, getPathForEthToDev());
	}

	/// @notice get estimated ETH output from DEV input
	/// @param devAmount input amount in DEV
	/// @param getPathForEthToDev passes in function that fetches path for Uniswap Router
	/// @return outputs UniSwap Router Outputs
	function _getEstimatedEthForDev(
		uint256 devAmount,
		function() internal view returns (address[] memory) getPathForEthToDev
	) internal view returns (uint256[] memory) {
		return uniswapRouter.getAmountsIn(devAmount, getPathForEthToDev());
	}
}
