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
        uint256 amount = 1_000;
        uint256 startDate = block.timestamp + 1 days;
        uint256 endDate = startDate + 3 days;
        bool revocable = false;

        _fundAndApprove(payer, amount);

        uint256 agreementId = _createAgreement(
            payer,
            beneficiary,
            amount,
            startDate,
            endDate,
            revocable
        );

        (
            address agreementPayer,
            address agreementBeneficiary,
            IERC20 agreementToken,
            uint256 agreementAmount,
            uint256 agreementStartDate,
            uint256 agreementEndDate,
            bool agreementRevocable
        ) = vesting.agreements(agreementId);

        assertEq(agreementPayer, payer);
        assertEq(agreementBeneficiary, beneficiary);
        assertEq(address(agreementToken), address(token));
        assertEq(agreementAmount, amount);
        assertEq(agreementStartDate, startDate);
        assertEq(agreementEndDate, endDate);
        assertEq(agreementRevocable, revocable);
    }

    function test_createAgreement_whenArgumentsAreValid_witholdsAmountFromPayer()
        public
    {
        address payer = makeAddr("alice");
        address beneficiary = makeAddr("bob");
        uint256 amount = 1_000;
        uint256 startDate = block.timestamp + 1 days;
        uint256 endDate = startDate + 3 days;
        bool revocable = false;

        _fundAndApprove(payer, amount);

        uint256 payerBalanceBefore = token.balanceOf(payer);
        uint256 vestingBalanceBefore = token.balanceOf(address(vesting));

        _createAgreement(
            payer,
            beneficiary,
            amount,
            startDate,
            endDate,
            revocable
        );

        assertEq(token.balanceOf(payer), payerBalanceBefore - amount);
        assertEq(
            token.balanceOf(address(vesting)),
            vestingBalanceBefore + amount
        );
    }

    function test_createAgreement_whenArgumentsAreValid_emitsEventWithAgreementId()
        public
    {
        address payer = makeAddr("alice");
        address beneficiary = makeAddr("bob");
        uint256 amount = 1_000;
        uint256 startDate = block.timestamp + 1 days;
        uint256 endDate = startDate + 3 days;
        bool revocable = false;

        _fundAndApprove(payer, amount);

        vm.expectEmit();
        emit Vesting.AgreementCreated(0);

        _createAgreement(
            payer,
            beneficiary,
            amount,
            startDate,
            endDate,
            revocable
        );
    }

    function testFuzz_createMultipleAgreements_returnsDifferentIds(
        uint8 count,
        uint64 amount
    ) public {
        count = uint8(bound(count, 1, 255));
        amount = uint64(bound(amount, 1, type(uint64).max));
        address payer = makeAddr("alice");
        address beneficiary = makeAddr("bob");
        uint256 startDate = block.timestamp + 1 days;
        uint256 endDate = startDate + 3 days;

        uint256 total = uint256(count) * uint256(amount);
        _fundAndApprove(payer, total);

        uint256[] memory ids = new uint256[](count);

        for (uint8 i; i < count; ++i) {
            uint256 id = _createAgreement(
                payer,
                beneficiary,
                amount,
                startDate,
                endDate,
                false
            );

            for (uint256 j; j < i; ++j) {
                assertNotEq(id, ids[j], "duplicate agreement ID");
            }

            ids[i] = id;
        }
    }

    function test_createAgreement_whenBeneficiaryIsAddress0_Reverts() public {
        address payer = makeAddr("alice");
        address beneficiary = address(0);
        uint256 amount = 1_000;
        uint256 startDate = block.timestamp + 1 days;
        uint256 endDate = startDate + 3 days;
        bool revocable = false;

        _fundAndApprove(payer, amount);

        vm.expectRevert();
        _createAgreement(
            payer,
            beneficiary,
            amount,
            startDate,
            endDate,
            revocable
        );
    }

    function test_createAgreement_whenAmountIs0_Reverts() public {
        address payer = makeAddr("alice");
        address beneficiary = makeAddr("bob");
        uint256 amount = 0;
        uint256 startDate = block.timestamp + 1 days;
        uint256 endDate = startDate + 3 days;
        bool revocable = false;

        _fundAndApprove(payer, amount);

        vm.expectRevert();
        _createAgreement(
            payer,
            beneficiary,
            amount,
            startDate,
            endDate,
            revocable
        );
    }

    function test_createAgreement_whenStartDateIsBeforeEndDate_Reverts()
        public
    {
        address payer = makeAddr("alice");
        address beneficiary = makeAddr("bob");
        uint256 amount = 1_000;
        uint256 startDate = block.timestamp + 2 days;
        uint256 endDate = startDate - 1 days;
        bool revocable = false;

        _fundAndApprove(payer, amount);

        vm.expectRevert();
        _createAgreement(
            payer,
            beneficiary,
            amount,
            startDate,
            endDate,
            revocable
        );
    }

    function _fundAndApprove(address payer, uint256 amount) internal {
        token.mint(payer, amount);

        vm.prank(payer);
        token.approve(address(vesting), amount);
    }

    function _createAgreement(
        address payer,
        address beneficiary,
        uint256 amount,
        uint256 startDate,
        uint256 endDate,
        bool revocable
    ) internal returns (uint256) {
        vm.prank(payer);
        return
            vesting.createAgreement(
                beneficiary,
                IERC20(address(token)),
                amount,
                startDate,
                endDate,
                revocable
            );
    }
}
