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

    uint256 constant today = 1_792_977_722;
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
            Vesting.AgreementConfiguration memory agreement,
            Vesting.AgreementState agreementState
        ) = vesting.agreements(agreementId);

        assertEq(agreementPayer, validPayer);
        assertEq(agreement.beneficiary, validBeneficiary);
        assertEq(address(agreement.token), address(token));
        assertEq(agreement.totalAmount, validAmount);
        assertEq(agreement.startDate, validStartDate);
        assertEq(agreement.endDate, validEndDate);
        assertEq(agreement.revocable, revocable);
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

    function test_vestedAmountOf_whenAgreementExistsAndDateIsBeforeStart_returns0()
        public
    {
        vm.warp(today);

        uint256 amount = 1_000;
        uint256 startDate = today + 1 days;
        uint256 endDate = startDate + 2 days;

        uint256 agreementId = _fundAndCreateAgreement(
            amount,
            startDate,
            endDate
        );

        uint256 vested = vesting.vestedAmountOf(agreementId);

        assertEq(vested, 0);
    }

    function test_vestedAmountOf_whenAgreementExistsAndDateIsAfterEnd_returnsTotalAmount()
        public
    {
        vm.warp(today);

        uint256 amount = 1_000;
        uint256 startDate = today + 1 days;
        uint256 endDate = startDate + 2 days;

        uint256 agreementId = _fundAndCreateAgreement(
            amount,
            startDate,
            endDate
        );

        vm.warp(endDate + 1 days);
        uint256 vested = vesting.vestedAmountOf(agreementId);

        assertEq(vested, amount);
    }

    function test_vestedAmountOf_whenAgreementExists_returnsVestedAmount()
        public
    {
        vm.warp(today);

        uint256 amount = 1_000;
        uint256 startDate = today + 1 days;
        uint256 endDate = startDate + 2 days;

        uint256 agreementId = _fundAndCreateAgreement(
            amount,
            startDate,
            endDate
        );

        uint256[5] memory checkpoints = [
            startDate,
            startDate + 1 hours,
            startDate + 12 hours,
            startDate + 1 days,
            endDate
        ];

        uint256[5] memory expected = [
            0,
            (amount * 1 hours) / 2 days,
            (amount * 12 hours) / 2 days,
            amount / 2,
            amount
        ];

        uint256[] memory actual = new uint256[](expected.length);

        for (uint256 i; i < checkpoints.length; i++) {
            vm.warp(checkpoints[i]);
            actual[i] = vesting.vestedAmountOf(agreementId);
        }

        for (uint256 i; i < checkpoints.length; i++) {
            assertEq(actual[i], expected[i]);
        }
    }

    function testFuzz_vestedAmountOf_whenAgreementExists_roundsDownCorrectly(
        uint256 amount,
        uint32 elapsed
    ) public {
        vm.warp(today);
        amount = bound(amount, 1, 1e30);
        uint256 startDate = today;
        uint256 duration = 2 days;
        elapsed = uint32(bound(elapsed, 0, duration));

        uint256 agreementId = _fundAndCreateAgreement(
            amount,
            startDate,
            startDate + duration
        );

        vm.warp(startDate + elapsed);

        uint256 vested = vesting.vestedAmountOf(agreementId);
        uint256 expected = (amount * elapsed) / duration;

        assertEq(vested, expected);
        assertLe(vested, amount);

        if (elapsed < duration) {
            assertLt(vested, amount);
        }
    }

    function _fundAndApprove(address payer, uint256 amount) internal {
        token.mint(payer, amount);

        vm.prank(payer);
        token.approve(address(vesting), amount);
    }

    function _fundAndCreateAgreement(
        uint256 amount,
        uint256 startDate,
        uint256 endDate
    ) internal returns (uint256) {
        _fundAndApprove(validPayer, amount);
        uint256 id = _createAgreement(
            validPayer,
            validBeneficiary,
            amount,
            startDate,
            endDate,
            false
        );
        return id;
    }

    function _createAgreement(
        address payer,
        address beneficiary,
        uint256 amount,
        uint256 startDate,
        uint256 endDate,
        bool revocable
    ) internal returns (uint256) {
        Vesting.AgreementConfiguration memory configuration = Vesting
            .AgreementConfiguration({
                beneficiary: beneficiary,
                token: IERC20(address(token)),
                totalAmount: amount,
                startDate: startDate,
                endDate: endDate,
                revocable: revocable
            });
        vm.prank(payer);
        return vesting.createAgreement(configuration);
    }
}
