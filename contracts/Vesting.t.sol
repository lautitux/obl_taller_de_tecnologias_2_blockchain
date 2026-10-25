// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {Vesting} from "./Vesting.sol";
import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MockToken is ERC20 {
    constructor() ERC20("Mock Token", "MOCK") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract VestingTest is Test {
    Vesting vesting;
    MockToken token;

    function setUp() public {
        vesting = new Vesting();
        token = new MockToken();
    }

    function test_createAgreement_whenArgumentsAreValid_createsAgreement()
        public
    {
        address payer = makeAddr("alice");
        address beneficiary = makeAddr("bob");
        uint256 totalAmount = 1000;
        uint256 startDate = block.timestamp + 1 days;
        uint256 endDate = block.timestamp + 4 days;
        bool revocable = false;

        token.mint(payer, totalAmount);

        vm.prank(payer);
        token.approve(address(vesting), totalAmount);

        vm.prank(payer);
        uint256 agreementId = vesting.createAgreement(
            beneficiary,
            IERC20(address(token)),
            totalAmount,
            startDate,
            endDate,
            revocable
        );

        (
            address agreementPayer,
            address agreementBeneficiary,
            IERC20 agreementToken,
            uint256 agreementTotalAmount,
            uint256 agreementStartDate,
            uint256 agreementEndDate,
            bool agreementRevocable
        ) = vesting.agreements(agreementId);

        assertEq(agreementPayer, payer);
        assertEq(agreementBeneficiary, beneficiary);
        assertEq(address(agreementToken), address(token));
        assertEq(agreementTotalAmount, totalAmount);
        assertEq(agreementStartDate, startDate);
        assertEq(agreementEndDate, endDate);
        assertEq(agreementRevocable, revocable);
    }
}
