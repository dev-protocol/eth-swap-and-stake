pragma solidity 0.8.7;

import "@uniswap/v2-periphery/contracts/interfaces/IUniswapV2Router02.sol";

contract UniswapExample {
	address internal constant UNISWAP_ROUTER_ADDRESS =
		0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D;

	IUniswapV2Router02 public uniswapRouter;

	// address private multiDaiKovan = 0x4DBCdF9B62e891a7cec5A2568C3F4FAF9E8Abe2b;

	constructor() {
		uniswapRouter = IUniswapV2Router02(UNISWAP_ROUTER_ADDRESS);
	}

	function convertEthToDai(uint256 daiAmountMin, address multiDaiKovan)
		public
		payable
		returns (uint[] memory amounts)
	{
		// solhint-disable-next-line not-rely-on-time
		uint256 deadline = block.timestamp + 15; // using 'now' for convenience, for mainnet pass deadline from frontend!
		uniswapRouter.swapExactETHForTokens{
			value: msg.value
		}(daiAmountMin, getPathForETHtoDAI(multiDaiKovan), msg.sender, deadline);
	}

	function getEstimatedDAIforETH(uint256 ethAmount, address multiDaiKovan)
		public
		view
		returns (uint256[] memory)
	{
		return
			uniswapRouter.getAmountsOut(
				ethAmount,
				getPathForETHtoDAI(multiDaiKovan)
			);
	}

	function getPathForETHtoDAI(address multiDaiKovan)
		private
		view
		returns (address[] memory)
	{
		address[] memory path = new address[](2);
		path[0] = uniswapRouter.WETH();
		path[1] = multiDaiKovan;

		return path;
	}
}
