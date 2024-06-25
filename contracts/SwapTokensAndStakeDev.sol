// SPDX-License-Identifier: MPL-2.0
pragma solidity =0.8.7;
pragma abicoder v2;

import "@uniswap/v3-periphery/contracts/interfaces/ISwapRouter.sol";
import "@uniswap/v3-periphery/contracts/interfaces/IQuoter.sol";
import "@uniswap/v3-periphery/contracts/libraries/TransferHelper.sol";
import {ILockup} from "./interfaces/ILockup.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {EnumerableSetUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";
import {IProxyAdmin} from "./interfaces/IProxyAdmin.sol";
import {ITransparentUpgradeableProxy} from "./interfaces/ITransparentUpgradeableProxy.sol";
import "./Escrow.sol";

contract SwapTokensAndStakeDev is Escrow, Initializable {
	using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

	// solhint-disable-next-line const-name-snakecase
	ISwapRouter public constant uniswapRouter =
		ISwapRouter(0xE592427A0AEce92De3Edee1F18E0157C05861564);
	// solhint-disable-next-line const-name-snakecase
	IQuoter public constant quoter =
		IQuoter(0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6);

	address public devAddress;
	address public lockupAddress;
	address public sTokensAddress;

	struct Amounts {
		address token;
		uint256 input;
		uint256 fee;
	}
	mapping(address => Amounts) public gatewayOf;
	mapping(bytes32 => EnumerableSetUpgradeable.AddressSet) private _roles;
	address public owner;
	uint256 public ecosystemFee;
	uint256 public ecosystemFeeThreshold;

	function initialize(
		address _devAddress,
		address _lockupAddress,
		address _sTokensAddress
	) public initializer {
		devAddress = _devAddress;
		lockupAddress = _lockupAddress;
		sTokensAddress = _sTokensAddress;
	}

	modifier onlyRole(bytes32 _role) {
		_checkRole(_role, msg.sender);
		_;
	}

	modifier onlyOwner() {
		require(owner == msg.sender, "Not an owner");
		_;
	}

	function _checkRole(bytes32 _role, address _account) internal view {
		if (!hasRole(_role, _account)) {
			revert("Missing role");
		}
	}

	function hasRole(
		bytes32 _role,
		address _account
	) public view returns (bool) {
		return _account == owner ? true : _roles[_role].contains(_account);
	}

	function grantRole(bytes32 _role, address _account) public onlyOwner {
		_roles[_role].add(_account);
	}

	function revokeRole(bytes32 _role, address _account) public onlyOwner {
		_roles[_role].remove(_account);
	}

	function CALL_MINTFOR_ROLE() public pure returns (bytes32) {
		return keccak256("ROLE.CALL_MINTFOR");
	}

	function updateEcosystemFee(uint256 _ecosystemFee) public onlyOwner {
		ecosystemFee = _ecosystemFee;
	}

	function updateEcosystemFeeThreshold(
		uint256 _ecosystemFeeThreshold
	) public onlyOwner {
		ecosystemFeeThreshold = _ecosystemFeeThreshold;
	}

	/// @notice Protection for path should be made at front-end such that dev is final output token
	// External function for native token
	/// @notice Swap native token -> dev and stake
	/// @param _path the path to swap
	/// @param _property the property to stake after swap
	/// @param _deadline refer to https://docs.uniswap.org/protocol/V1/guides/trade-tokens#deadlines
	/// @param _payload allows for additional data when minting SToken
	function swapTokensAndStakeDev(
		address _to,
		bytes memory _path,
		address _property,
		uint256 _amountOut,
		uint256 _deadline,
		bytes32 _payload
	) external payable {
		require(msg.value > 0, "Must pass non-zero amount");

		gatewayOf[address(0)] = Amounts(address(0), msg.value, 0);

		_swapTokensAndStakeDev(
			_to,
			_path,
			_property,
			msg.value,
			_amountOut,
			_deadline,
			_payload
		);

		delete gatewayOf[address(0)];
	}

	/// @notice Protection for path should be made at front-end such that dev is final output token
	// External function for native token
	/// @notice Swap native token -> dev and stake
	/// @param _path the path to swap
	/// @param _property the property to stake after swap
	/// @param _amountOut the min amount of dev to stake to prevent slippage
	/// @param _deadline refer to https://docs.uniswap.org/protocol/V1/guides/trade-tokens#deadlines
	/// @param _payload allows for additional data when minting SToken
	/// @param _gatewayAddress is the address to which the liquidity provider fee will be directed
	/// @param _gatewayFee is the basis points to pass. For example 10000 is 100%
	function swapTokensAndStakeDev(
		address _to,
		bytes memory _path,
		address _property,
		uint256 _amountOut,
		uint256 _deadline,
		bytes32 _payload,
		address payable _gatewayAddress,
		uint256 _gatewayFee
	) external payable {
		require(msg.value > 0, "Must pass non-zero amount");
		require(_gatewayFee <= 10000, "must be below or equal 10000");
		// handle fee
		uint256 ecosystemFeeAmount = _gatewayFee >= ecosystemFeeThreshold
			? (msg.value * ecosystemFee) / 10000
			: 0;

		uint256 feeAmount = (msg.value * _gatewayFee) / 10000;

		uint256 acutualFeeAmount = ((msg.value - ecosystemFeeAmount) *
			_gatewayFee) / 10000;

		_deposit(owner, ecosystemFeeAmount, address(0));
		_deposit(_gatewayAddress, acutualFeeAmount, address(0));

		gatewayOf[_gatewayAddress] = Amounts(address(0), msg.value, feeAmount);

		_swapTokensAndStakeDev(
			_to,
			_path,
			_property,
			(msg.value - ecosystemFeeAmount - acutualFeeAmount),
			_amountOut,
			_deadline,
			_payload
		);
		delete gatewayOf[_gatewayAddress];
	}

	/// @notice Protection for path should be made at front-end such that dev is final output token
	// External Function For ERC20
	/// @notice Swap token -> dev and stake
	/// @param _token the initial token to swap by user
	/// @param _path the path to swap
	/// @param _property the property to stake after swap
	/// @param _amountOut the min amount of dev to stake to prevent slippage
	/// @param _deadline refer to https://docs.uniswap.org/protocol/V1/guides/trade-tokens#deadlines
	/// @param _payload allows for additional data when minting SToken
	function swapTokensAndStakeDev(
		address _to,
		IERC20 _token,
		bytes memory _path,
		address _property,
		uint256 _amount,
		uint256 _amountOut,
		uint256 _deadline,
		bytes32 _payload
	) external {
		require(
			_token.allowance(msg.sender, address(this)) >= _amount,
			"insufficient allowance"
		);
		require(
			_token.balanceOf(msg.sender) >= _amount,
			"insufficient balance"
		);
		// Transfer the amount from the user to the contract
		TransferHelper.safeTransferFrom(
			address(_token),
			msg.sender,
			address(this),
			_amount
		);

		gatewayOf[address(0)] = Amounts(address(_token), _amount, 0);

		_swapTokensAndStakeDev(
			_to,
			_token,
			_path,
			_property,
			_amount,
			_amountOut,
			_deadline,
			_payload
		);

		delete gatewayOf[address(0)];
	}

	/// @notice Protection for path should be made at front-end such that dev is final output token
	// External Function For ERC20
	/// @notice Swap token -> dev and stake
	/// @param _token the initial token to swap by user
	/// @param _path the path to swap
	/// @param _property the property to stake after swap
	/// @param _amountOut the min amount of dev to stake to prevent slippage
	/// @param _deadline refer to https://docs.uniswap.org/protocol/V1/guides/trade-tokens#deadlines
	/// @param _payload allows for additional data when minting SToken
	/// @param _gatewayAddress is the address to which the liquidity provider fee will be directed
	/// @param _gatewayFee is the basis points to pass. For example 10000 is 100%
	function swapTokensAndStakeDev(
		address _to,
		IERC20 _token,
		bytes memory _path,
		address _property,
		uint256 _amount,
		uint256 _amountOut,
		uint256 _deadline,
		bytes32 _payload,
		address payable _gatewayAddress,
		uint256 _gatewayFee
	) external {
		require(_gatewayFee <= 10000, "must be below or equal 10000");
		require(
			_token.allowance(msg.sender, address(this)) >= _amount,
			"insufficient allowance"
		);
		require(
			_token.balanceOf(msg.sender) >= _amount,
			"insufficient balance"
		);
		// Transfer the amount from the user to the contract
		TransferHelper.safeTransferFrom(
			address(_token),
			msg.sender,
			address(this),
			_amount
		);

		uint256 ecosystemFeeAmount = _gatewayFee >= ecosystemFeeThreshold
			? (_amount * ecosystemFee) / 10000
			: 0;

		// handle fee
		uint256 feeAmount = (_amount * _gatewayFee) / 10000;
		// handle acutual gateway fee
		uint256 acutualFeeAmount = ((_amount - ecosystemFeeAmount) *
			_gatewayFee) / 10000;

		_deposit(owner, ecosystemFeeAmount, address(_token));
		_deposit(_gatewayAddress, acutualFeeAmount, address(_token));

		gatewayOf[_gatewayAddress] = Amounts(
			address(_token),
			_amount,
			feeAmount
		);

		_swapTokensAndStakeDev(
			_to,
			_token,
			_path,
			_property,
			(_amount - ecosystemFeeAmount - acutualFeeAmount),
			_amountOut,
			_deadline,
			_payload
		);
		delete gatewayOf[_gatewayAddress];
	}

	/// @dev Create a staking position with expected Amounts for pre-qualified users, such as by off-chain payments.
	/// @param _to the destination user's address
	/// @param _property the property to stake after swap
	/// @param _payload allows for additional data when minting SToken
	/// @param _gatewayAddress is the address to which the liquidity provider fee will be directed
	/// @param _amounts is the basis points to pass. For example 10000 is 100%
	function mintFor(
		address _to,
		address _property,
		bytes32 _payload,
		address _gatewayAddress,
		Amounts memory _amounts
	) external onlyRole(CALL_MINTFOR_ROLE()) {
		gatewayOf[_gatewayAddress] = _amounts;

		uint256 tokenId = ILockup(lockupAddress).depositToProperty(
			_property,
			0,
			_payload
		);
		IERC721(sTokensAddress).safeTransferFrom(address(this), _to, tokenId);

		delete gatewayOf[_gatewayAddress];
	}

	// do not use on-chain, gas inefficient!
	function getEstimatedTokensForDev(
		bytes memory path,
		uint256 devAmount
	) external returns (uint256) {
		return quoter.quoteExactInput(path, devAmount);
	}

	// do not use on-chain, gas inefficient!
	function getEstimatedDevForTokens(
		bytes memory path,
		uint256 tokenAmount
	) external returns (uint256) {
		return quoter.quoteExactInput(path, tokenAmount);
	}

	// Internal function for erc20 token
	function _swapTokensAndStakeDev(
		address _to,
		IERC20 _token,
		bytes memory _path,
		address _property,
		uint256 _amount,
		uint256 _amountOut,
		uint256 _deadline,
		bytes32 _payload
	) private {
		address recipient = address(this);
		uint256 amountIn = _amount;

		// 	Approve the router to spend the token amount
		TransferHelper.safeApprove(
			address(_token),
			address(uniswapRouter),
			_amount
		);

		// Multiple pool swaps are encoded through bytes called a `path`. A path is a sequence of token addresses and poolFees that define the pools used in the swaps.
		// The format for pool encoding is (tokenIn, fee, tokenOut/tokenIn, fee, tokenOut) where tokenIn/tokenOut parameter is the shared token across the pools.
		ISwapRouter.ExactInputParams memory params = ISwapRouter
			.ExactInputParams({
				path: _path,
				recipient: recipient,
				deadline: _deadline,
				amountIn: amountIn,
				amountOutMinimum: _amountOut
			});
		uint256 amountOut = uniswapRouter.exactInput(params);
		IERC20(devAddress).approve(lockupAddress, amountOut);
		uint256 tokenId = ILockup(lockupAddress).depositToProperty(
			_property,
			amountOut,
			_payload
		);
		IERC721(sTokensAddress).safeTransferFrom(address(this), _to, tokenId);
	}

	// Internal function for native token
	function _swapTokensAndStakeDev(
		address _to,
		bytes memory _path,
		address _property,
		uint256 _amount,
		uint256 _amountOut,
		uint256 _deadline,
		bytes32 _payload
	) private {
		address recipient = address(this);
		uint256 amountIn = _amount;

		// Multiple pool swaps are encoded through bytes called a `path`. A path is a sequence of token addresses and poolFees that define the pools used in the swaps.
		// The format for pool encoding is (tokenIn, fee, tokenOut/tokenIn, fee, tokenOut) where tokenIn/tokenOut parameter is the shared token across the pools.
		ISwapRouter.ExactInputParams memory params = ISwapRouter
			.ExactInputParams({
				path: _path,
				recipient: recipient,
				deadline: _deadline,
				amountIn: amountIn,
				amountOutMinimum: _amountOut
			});
		uint256 amountOut = uniswapRouter.exactInput{value: _amount}(params);

		IERC20(devAddress).approve(lockupAddress, amountOut);
		uint256 tokenId = ILockup(lockupAddress).depositToProperty(
			_property,
			amountOut,
			_payload
		);
		IERC721(sTokensAddress).safeTransferFrom(address(this), _to, tokenId);
	}

	function updateOwner(address _proxyAdmin) public {
		IProxyAdmin givenProxyAdmin = IProxyAdmin(_proxyAdmin);
		address proxyAdmin;
		try
			givenProxyAdmin.getProxyAdmin(
				ITransparentUpgradeableProxy(address(this))
			)
		returns (address _admin) {
			proxyAdmin = _admin;
		} catch {}
		require(
			proxyAdmin == address(givenProxyAdmin),
			"Not admin of this proxy"
		);
		owner = givenProxyAdmin.owner();
	}
}
