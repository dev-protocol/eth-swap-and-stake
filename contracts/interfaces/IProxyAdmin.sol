// SPDX-License-Identifier: MIT
pragma solidity =0.8.7;

import "./ITransparentUpgradeableProxy.sol";

/**
 * @dev This is an auxiliary contract meant to be assigned as the admin of a {TransparentUpgradeableProxy}. For an
 * explanation of why you would want to use this see the documentation for {TransparentUpgradeableProxy}.
 */
interface IProxyAdmin {
	/**
	 * @dev Returns the current admin of `proxy`.
	 *
	 * Requirements:
	 *
	 * - This contract must be the admin of `proxy`.
	 */
	function getProxyAdmin(
		ITransparentUpgradeableProxy proxy
	) external view returns (address);

	/**
	 * @dev Returns the address of the current owner.
	 */
	function owner() external view returns (address);
}
