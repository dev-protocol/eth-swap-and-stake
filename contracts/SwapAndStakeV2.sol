// SPDX-License-Identifier: MPL-2.0
pragma solidity 0.8.7;

import {IUniswapV2Router02} from "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import {ILockup} from "@devprotocol/protocol/contracts/interface/ILockup.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "hardhat/console.sol";

contract SwapAndStakeV2 {
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

	function swapEthAndStakeDev(address property) external payable {
		// solhint-disable-next-line not-rely-on-time
		uint256 deadline = block.timestamp + 15; // using 'now' for convenience, for mainnet pass deadline from frontend!
		uint256[] memory amounts = uniswapRouter.swapExactETHForTokens{
			value: msg.value
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
		uint256[] memory outs = uniswapRouter.getAmountsOut(
			ethAmount,
			_getPathForEthToDev()
		);
		console.log("outs[0]", outs[0]);
		console.log("outs[1]", outs[1]);
		console.log("outs[2]", outs[2]);
		return uniswapRouter.getAmountsOut(ethAmount, _getPathForEthToDev());
	}

	function getEstimatedEthForDev(uint256 devAmount)
		public
		view
		returns (uint256[] memory)
	{
		uint256[] memory ins = uniswapRouter.getAmountsIn(
			devAmount,
			_getPathForEthToDev()
		);
		console.log("ins[0]", ins[0]);
		console.log("ins[1]", ins[1]);
		console.log("ins[2]", ins[2]);
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
