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

    address validPayer;
    address validBeneficiary;
    uint256 constant validAmount = 1_000;
    uint256 validStartDate;
    uint256 validEndDate;

    function setUp() public {
        vesting = new Vesting();
        token = new MockToken();

        validPayer = makeAddr("alice");
        validBeneficiary = makeAddr("bob");
        validStartDate = block.timestamp + 1 days;
        validEndDate = validStartDate + 3 days;
    }

    function test_createAgreement_whenArgumentsAreValid_createsAgreement()
        public
    {
        bool revocable = false;

        _fundAndApprove(validPayer, validAmount);

        uint256 agreementId = _createAgreement(
            validPayer,
            validBeneficiary,
            validAmount,
            validStartDate,
            validEndDate,
            revocable
        );

        (
            address agreementPayer,
            address agreementBeneficiary,
            IERC20 agreementToken,
            uint256 agreementAmount,
            uint256 agreementStartDate,
            uint256 agreementEndDate,
            bool agreementRevocable,
            Vesting.AgreementState agreementState
        ) = vesting.agreements(agreementId);

        assertEq(agreementPayer, validPayer);
        assertEq(agreementBeneficiary, validBeneficiary);
        assertEq(address(agreementToken), address(token));
        assertEq(agreementAmount, validAmount);
        assertEq(agreementStartDate, validStartDate);
        assertEq(agreementEndDate, validEndDate);
        assertEq(agreementRevocable, revocable);
        assertEq(uint(agreementState), uint(Vesting.AgreementState.Active));
    }

    function test_createAgreement_whenArgumentsAreValid_witholdsAmountFromPayer()
        public
    {
        bool revocable = false;

        _fundAndApprove(validPayer, validAmount);

        uint256 payerBalanceBefore = token.balanceOf(validPayer);
        uint256 vestingBalanceBefore = token.balanceOf(address(vesting));

        _createAgreement(
            validPayer,
            validBeneficiary,
            validAmount,
            validStartDate,
            validEndDate,
            revocable
        );

        assertEq(token.balanceOf(validPayer), payerBalanceBefore - validAmount);
        assertEq(
            token.balanceOf(address(vesting)),
            vestingBalanceBefore + validAmount
        );
    }

    function test_createAgreement_whenArgumentsAreValid_emitsEventWithAgreementId()
        public
    {
        bool revocable = false;

        _fundAndApprove(validPayer, validAmount);

        vm.expectEmit();
        emit Vesting.AgreementCreated(0);

        _createAgreement(
            validPayer,
            validBeneficiary,
            validAmount,
            validStartDate,
            validEndDate,
            revocable
        );
    }

    function testFuzz_createMultipleAgreements_returnsDifferentIds(
        uint8 count,
        uint64 amount
    ) public {
        count = uint8(bound(count, 1, 255));
        amount = uint64(bound(amount, 1, type(uint64).max));

        uint256 total = uint256(count) * uint256(amount);
        _fundAndApprove(validPayer, total);

        uint256[] memory ids = new uint256[](count);

        for (uint8 i; i < count; ++i) {
            uint256 id = _createAgreement(
                validPayer,
                validBeneficiary,
                amount,
                validStartDate,
                validEndDate,
                false
            );

            for (uint256 j; j < i; ++j) {
                assertNotEq(id, ids[j], "duplicate agreement ID");
            }

            ids[i] = id;
        }
    }

    function test_createAgreement_whenPayerDoesNotApproveEnoughTokens_Reverts()
        public
    {
        uint256 amount = 1_000;
        uint256 insufficientAmount = 500;
        bool revocable = false;

        _fundAndApprove(validPayer, insufficientAmount);

        vm.expectRevert();
        _createAgreement(
            validPayer,
            validBeneficiary,
            amount,
            validStartDate,
            validEndDate,
            revocable
        );
    }

    function test_createAgreement_whenBeneficiaryIsAddress0_Reverts() public {
        address beneficiary = address(0);
        bool revocable = false;

        _fundAndApprove(validPayer, validAmount);

        vm.expectRevert();
        _createAgreement(
            validPayer,
            beneficiary,
            validAmount,
            validStartDate,
            validEndDate,
            revocable
        );
    }

    function test_createAgreement_whenAmountIs0_Reverts() public {
        uint256 amount = 0;
        bool revocable = false;

        _fundAndApprove(validPayer, validAmount);

        vm.expectRevert();
        _createAgreement(
            validPayer,
            validBeneficiary,
            amount,
            validStartDate,
            validEndDate,
            revocable
        );
    }

    function test_createAgreement_whenStartDateIsBeforeEndDate_Reverts()
        public
    {
        uint256 startDate = block.timestamp + 2 days;
        uint256 endDate = startDate - 1 days;
        bool revocable = false;

        _fundAndApprove(validPayer, validAmount);

        vm.expectRevert();
        _createAgreement(
            validPayer,
            validBeneficiary,
            validAmount,
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
