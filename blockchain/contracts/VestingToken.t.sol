// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {Test} from "forge-std/Test.sol";
import {VestingToken} from "./VestingToken.sol";

contract VestingTokenTest is Test {
    VestingToken internal token;
    address internal holder;

    function setUp() public {
        token = new VestingToken();
        holder = makeAddr("holder");
    }

    function test_constructor_setsMetadataAndStartsWithNoSupply() public view {
        assertEq(token.name(), "Vesting Token");
        assertEq(token.symbol(), "VDT");
        assertEq(token.decimals(), 18);
        assertEq(token.totalSupply(), 0);
        assertEq(token.balanceOf(holder), 0);
    }

    function testFuzz_mint_tracksBalanceAndSupply(
        address to,
        uint128 firstAmount,
        uint128 secondAmount
    ) public {
        vm.assume(to != address(0));

        token.mint(to, firstAmount);
        token.mint(to, secondAmount);

        uint256 total = uint256(firstAmount) + uint256(secondAmount);
        assertEq(token.balanceOf(to), total);
        assertEq(token.totalSupply(), total);
    }
}
