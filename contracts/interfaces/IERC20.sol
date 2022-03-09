// SPDX-License-Identifier: MIT
pragma solidity 0.8.7;

interface IERC20 {
	function deposit() external payable;

	function transfer(address to, uint256 value) external returns (bool);

	function balanceOf(address owner) external view returns (uint256);

	function withdraw(uint256) external;

	function approve(address to, uint256 value) external returns (bool);
}
