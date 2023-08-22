// SPDX-License-Identifier: MIT
pragma solidity =0.8.7;

/**
 * @dev Interface for {TransparentUpgradeableProxy}. In order to implement transparency, {TransparentUpgradeableProxy}
 * does not implement this interface directly, and some of its functions are implemented by an internal dispatch
 * mechanism. The compiler is unaware that these functions are implemented by {TransparentUpgradeableProxy} and will not
 * include them in the ABI so this interface must be used to interact with it.
 */
interface ITransparentUpgradeableProxy {
	function admin() external view returns (address);

	function implementation() external view returns (address);

	function changeAdmin(address) external;

	function upgradeTo(address) external;

	function upgradeToAndCall(address, bytes memory) external payable;
}
