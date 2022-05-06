pragma solidity 0.8.7;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";
import {ILockup} from "@devprotocol/protocol/contracts/interface/ILockup.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

import "hardhat/console.sol";

contract SwapStakeV2 {
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

	function swapEthAndStakeDev(address property) public payable {
		// solhint-disable-next-line not-rely-on-time
		uint256 deadline = block.timestamp + 15; // using 'now' for convenience, for mainnet pass deadline from frontend!
		uint256[] memory amounts = uniswapRouter.swapExactETHForTokens{
			value: msg.value
		}(1, getPathForEthToDev(), address(this), deadline);
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
		return uniswapRouter.getAmountsOut(ethAmount, getPathForEthToDev());
	}

	function getPathForEthToDev() private view returns (address[] memory) {
		address[] memory path = new address[](2);
		path[0] = uniswapRouter.WETH();
		path[1] = devAddress;

		return path;
	}
}
