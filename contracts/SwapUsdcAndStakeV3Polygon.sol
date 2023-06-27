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

contract SwapUsdcAndStakeV3Polygon is Escrow {
	// solhint-disable-next-line const-name-snakecase
	ISwapRouter public constant uniswapRouter =
		ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
	// solhint-disable-next-line const-name-snakecase
	IQuoter public constant quoter =
		IQuoter(0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6);

	address public usdcAddress;
	address public wethAddress;
	address public devAddress;
	address public lockupAddress;
	address public sTokensAddress;
	struct Amounts {
		uint256 input;
		uint256 fee;
	}
	mapping(address => Amounts) public gatewayOf;

	constructor(
		address _usdcAddress,
		address _wethAddress,
		address _devAddress,
		address _lockupAddress,
		address _sTokensAddress
	) {
		usdcAddress = _usdcAddress;
		wethAddress = _wethAddress;
		devAddress = _devAddress;
		lockupAddress = _lockupAddress;
		sTokensAddress = _sTokensAddress;
	}

	/// @notice Swap eth -> dev and stake
	/// @param property the property to stake after swap
	/// @param deadline refer to https://docs.uniswap.org/protocol/V1/guides/trade-tokens#deadlines
	/// @param payload allows for additional data when minting SToken
	function swapUsdcAndStakeDev(
		address property,
		uint256 amount,
		uint256 _amountOut,
		uint256 deadline,
		bytes32 payload
	) external {
		require(
			IERC20(usdcAddress).allowance(msg.sender, address(this)) >= amount,
			"insufficient allowance"
		);
		// Transfer the amount from the user to the contract
		IERC20(usdcAddress).transferFrom(msg.sender, address(this), amount);

		gatewayOf[address(0)] = Amounts(amount, 0);

		_swapUsdcAndStakeDev(amount, _amountOut, property, deadline, payload);

		delete gatewayOf[address(0)];
	}

	/// @notice Swap eth -> dev and stake with GATEWAY FEE (paid in ETH) and payload
	/// @param property the property to stake after swap
	/// @param deadline refer to https://docs.uniswap.org/protocol/V1/guides/trade-tokens#deadlines
	/// @param payload allows for additional data when minting SToken
	/// @param gatewayAddress is the address to which the liquidity provider fee will be directed
	/// @param gatewayFee is the basis points to pass. For example 10000 is 100%
	function swapUsdcAndStakeDev(
		address property,
		uint256 amount,
		uint256 _amountOut,
		uint256 deadline,
		bytes32 payload,
		address payable gatewayAddress,
		uint256 gatewayFee
	) external {
		require(gatewayFee <= 10000, "must be below 10000");
		// Transfer the amount from the user to the contract
		IERC20(usdcAddress).transferFrom(msg.sender, address(this), amount);
		// handle fee
		uint256 feeAmount = (amount * gatewayFee) / 10000;
		_deposit(gatewayAddress, feeAmount, usdcAddress);

		gatewayOf[gatewayAddress] = Amounts(amount, feeAmount);

		_swapUsdcAndStakeDev(
			(amount - feeAmount),
			_amountOut,
			property,
			deadline,
			payload
		);

		delete gatewayOf[gatewayAddress];
	}

	// do not used on-chain, gas inefficient!
	function getEstimatedDevForUsdc(uint256 usdcAmount)
		external
		returns (uint256)
	{
		// V3 ETH-DEV pair fee is 1%
		uint24 fee = 10000;
		uint24 fee2 = 500;

		// using checking from multi path USDC -> WETH -> DEV
		return
			quoter.quoteExactInput(
				abi.encodePacked(
					usdcAddress,
					fee2,
					wethAddress,
					fee,
					devAddress
				),
				usdcAmount
			);
	}

	// do not used on-chain, gas inefficient!
	function getEstimatedUsdcForDev(uint256 devAmount)
		external
		returns (uint256)
	{
		// V3 ETH-DEV pair fee is 1%
		uint24 fee = 10000;
		uint24 fee2 = 500;
		// using checking from multi path DEV -> WETH -> USDC
		return
			quoter.quoteExactInput(
				abi.encodePacked(
					devAddress,
					fee,
					wethAddress,
					fee2,
					usdcAddress
				),
				devAmount
			);
	}

	//=================================== PRIVATE ==============================================
	/// @notice Swap eth -> dev handles transfer and stake with payload
	/// @param amount in ETH
	/// @param property the property to stake after swap
	/// @param deadline refer to https://docs.uniswap.org/protocol/V1/guides/trade-tokens#deadlines
	/// @param payload allows for additional data when minting SToken
	function _swapUsdcAndStakeDev(
		uint256 amount,
		uint256 _amountOut,
		address property,
		uint256 deadline,
		bytes32 payload
	) private {
		// V3 ETH-DEV pair fee is 1%
		uint24 fee = 10000;
		uint24 fee2 = 500;
		address recipient = address(this);
		uint256 amountIn = amount;

		// Approve the router to spend the WETH amount
		TransferHelper.safeApprove(
			usdcAddress,
			address(uniswapRouter),
			amountIn
		);

		// Multiple pool swaps are encoded through bytes called a `path`. A path is a sequence of token addresses and poolFees that define the pools used in the swaps.
		// The format for pool encoding is (tokenIn, fee, tokenOut/tokenIn, fee, tokenOut) where tokenIn/tokenOut parameter is the shared token across the pools.
		ISwapRouter.ExactInputParams memory params = ISwapRouter
			.ExactInputParams({
				path: abi.encodePacked(
					usdcAddress,
					fee2,
					wethAddress,
					fee,
					devAddress
				),
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
}
