// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {Vesting} from "./Vesting.sol";
import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Errors} from "@openzeppelin/contracts/interfaces/draft-IERC6093.sol";

contract MockToken is ERC20 {
    constructor() ERC20("Mock Token", "MOCK") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

abstract contract VestingTestBase is Test {
    uint256 internal constant TODAY = 1_792_977_722;
    uint256 internal constant AMOUNT = 1_000;
    uint256 internal constant START_DATE = TODAY + 1 days;
    uint256 internal constant DURATION = 2 days;
    uint256 internal constant END_DATE = START_DATE + DURATION;
    uint256 internal constant MIDPOINT = START_DATE + 1 days;
    uint256 internal constant UNKNOWN_AGREEMENT_ID = 1_234;

    Vesting internal vesting;
    MockToken internal token;
    address internal payer;
    address internal beneficiary;
    address internal outsider;
    Vesting.AgreementConfiguration internal configuration;

    function setUp() public virtual {
        vm.warp(TODAY);
        vesting = new Vesting();
        token = new MockToken();
        payer = makeAddr("payer");
        beneficiary = makeAddr("beneficiary");
        outsider = makeAddr("outsider");
        configuration = Vesting.AgreementConfiguration({
            beneficiary: beneficiary,
            token: IERC20(address(token)),
            totalAmount: AMOUNT,
            startDate: START_DATE,
            endDate: END_DATE,
            revocable: false
        });
    }

    function _fundAndApprove(uint256 amount) internal {
        token.mint(payer, amount);
        vm.prank(payer);
        token.approve(address(vesting), amount);
    }

    function _createAgreement() internal returns (uint256) {
        vm.prank(payer);
        return vesting.createAgreement(configuration);
    }

    function _givenAgreement() internal returns (uint256) {
        _fundAndApprove(configuration.totalAmount);
        return _createAgreement();
    }

    function _cancelAsPayer(uint256 agreementId) internal {
        vm.prank(payer);
        vesting.cancelAgreement(agreementId);
    }

    function _claimAsBeneficiary(uint256 agreementId, uint256 amount) internal {
        vm.prank(beneficiary);
        vesting.claimAmountFrom(agreementId, amount);
    }

    function _givenAgreementCancelledAtMidpoint() internal returns (uint256) {
        configuration.revocable = true;
        uint256 agreementId = _givenAgreement();
        vm.warp(MIDPOINT);
        _cancelAsPayer(agreementId);
        return agreementId;
    }
}

contract CreateAgreementTest is VestingTestBase {
    function setUp() public override {
        super.setUp();
        _fundAndApprove(AMOUNT);
    }

    function test_createAgreement_whenConfigurationIsValid_storesConfiguration()
        public
    {
        uint256 agreementId = _createAgreement();

        (, Vesting.AgreementConfiguration memory stored, , , ) = vesting
            .agreements(agreementId);
        assertEq(stored.beneficiary, beneficiary);
        assertEq(address(stored.token), address(token));
        assertEq(stored.totalAmount, AMOUNT);
        assertEq(stored.startDate, START_DATE);
        assertEq(stored.endDate, END_DATE);
        assertFalse(stored.revocable);
    }

    function test_createAgreement_whenConfigurationIsValid_initializesActiveAgreement()
        public
    {
        uint256 agreementId = _createAgreement();

        (
            address storedPayer,
            ,
            Vesting.AgreementState state,
            uint256 vestedAtCancellation,
            uint256 withdrawn
        ) = vesting.agreements(agreementId);
        assertEq(storedPayer, payer);
        assertEq(uint256(state), uint256(Vesting.AgreementState.Active));
        assertEq(vestedAtCancellation, 0);
        assertEq(withdrawn, 0);
    }

    function test_createAgreement_whenConfigurationIsValid_transfersTokensFromPayer()
        public
    {
        _createAgreement();

        assertEq(token.balanceOf(payer), 0);
        assertEq(token.balanceOf(address(vesting)), AMOUNT);
    }

    function test_createAgreement_whenConfigurationIsValid_emitsAgreementDetails()
        public
    {
        vm.expectEmit(address(vesting));
        emit Vesting.AgreementCreated(
            0,
            payer,
            beneficiary,
            address(token),
            AMOUNT,
            START_DATE,
            END_DATE,
            false
        );

        _createAgreement();
    }

    function test_createAgreement_whenRevocableAgreementFollowsAnother_emitsItsOwnDetails()
        public
    {
        _createAgreement();
        configuration.beneficiary = outsider;
        configuration.totalAmount = 2_000;
        configuration.startDate = END_DATE;
        configuration.endDate = END_DATE + 1 days;
        configuration.revocable = true;
        _fundAndApprove(2_000);
        vm.expectEmit(address(vesting));
        emit Vesting.AgreementCreated(
            1,
            payer,
            outsider,
            address(token),
            2_000,
            END_DATE,
            END_DATE + 1 days,
            true
        );

        _createAgreement();
    }

    function testFuzz_createAgreement_whenCreatingMultipleAgreements_returnsUniqueIds(
        uint8 count,
        uint64 amount
    ) public {
        count = uint8(bound(count, 1, 255));
        configuration.totalAmount = bound(amount, 1, type(uint64).max);
        _fundAndApprove(uint256(count) * configuration.totalAmount);

        uint256[] memory ids = _createAgreements(count);

        _assertUniqueIds(ids);
    }

    function test_createAgreement_whenAllowanceIsInsufficient_revertsWithInsufficientAllowance()
        public
    {
        vm.prank(payer);
        token.approve(address(vesting), 500);
        vm.expectRevert(
            abi.encodeWithSelector(
                IERC20Errors.ERC20InsufficientAllowance.selector,
                address(vesting),
                500,
                AMOUNT
            )
        );

        _createAgreement();
    }

    function test_createAgreement_whenBeneficiaryIsZeroAddress_reverts()
        public
    {
        configuration.beneficiary = address(0);
        vm.expectRevert(Vesting.InvalidBeneficiary.selector);

        _createAgreement();
    }

    function test_createAgreement_whenAmountIsZero_reverts() public {
        configuration.totalAmount = 0;
        vm.expectRevert(Vesting.InvalidAmount.selector);

        _createAgreement();
    }

    function test_createAgreement_whenStartDateIsAfterEndDate_reverts() public {
        configuration.startDate = END_DATE + 1 days;
        vm.expectRevert(Vesting.InvalidDateRange.selector);

        _createAgreement();
    }

    function _createAgreements(
        uint256 count
    ) private returns (uint256[] memory ids) {
        ids = new uint256[](count);
        for (uint256 i; i < count; ++i) {
            ids[i] = _createAgreement();
        }
    }

    function _assertUniqueIds(uint256[] memory ids) private pure {
        for (uint256 i; i < ids.length; ++i) {
            for (uint256 j; j < i; ++j) {
                assertNotEq(ids[i], ids[j], "duplicate agreement ID");
            }
        }
    }
}

contract VestedAmountTest is VestingTestBase {
    function test_vestedAmountOf_whenBeforeStart_returnsZero() public {
        uint256 agreementId = _givenAgreement();

        uint256 vested = vesting.vestedAmountOf(agreementId);

        assertEq(vested, 0);
    }

    function test_vestedAmountOf_whenAtStart_returnsZero() public {
        uint256 agreementId = _givenAgreement();
        vm.warp(START_DATE);

        uint256 vested = vesting.vestedAmountOf(agreementId);

        assertEq(vested, 0);
    }

    function test_vestedAmountOf_whenOneHourHasElapsed_returnsTwentyTokens()
        public
    {
        uint256 agreementId = _givenAgreement();
        vm.warp(START_DATE + 1 hours);

        uint256 vested = vesting.vestedAmountOf(agreementId);

        // 1,000 tokens over 48 hours: one hour vests 20 whole tokens.
        assertEq(vested, 20);
    }

    function test_vestedAmountOf_whenTwelveHoursHaveElapsed_returnsQuarterOfAmount()
        public
    {
        uint256 agreementId = _givenAgreement();
        vm.warp(START_DATE + 12 hours);

        uint256 vested = vesting.vestedAmountOf(agreementId);

        assertEq(vested, 250);
    }

    function test_vestedAmountOf_whenAtMidpoint_returnsHalfOfAmount() public {
        uint256 agreementId = _givenAgreement();
        vm.warp(MIDPOINT);

        uint256 vested = vesting.vestedAmountOf(agreementId);

        assertEq(vested, 500);
    }

    function test_vestedAmountOf_whenAtEnd_returnsTotalAmount() public {
        uint256 agreementId = _givenAgreement();
        vm.warp(END_DATE);

        uint256 vested = vesting.vestedAmountOf(agreementId);

        assertEq(vested, AMOUNT);
    }

    function test_vestedAmountOf_whenAfterEnd_returnsTotalAmount() public {
        uint256 agreementId = _givenAgreement();
        vm.warp(END_DATE + 1 days);

        uint256 vested = vesting.vestedAmountOf(agreementId);

        assertEq(vested, AMOUNT);
    }

    function testFuzz_vestedAmountOf_whenDuringVesting_roundsDownToNearestWholeToken(
        uint256 amount,
        uint32 elapsed
    ) public {
        configuration.totalAmount = bound(amount, 1, 1e30);
        elapsed = uint32(bound(elapsed, 0, DURATION));
        uint256 agreementId = _givenAgreement();
        vm.warp(START_DATE + elapsed);
        uint256 proportionalAmount = configuration.totalAmount * elapsed;

        uint256 vested = vesting.vestedAmountOf(agreementId);

        // The exact entitlement lies between vested and the next whole token.
        assertLe(vested * DURATION, proportionalAmount);
        assertLt(proportionalAmount, (vested + 1) * DURATION);
        assertLe(vested, configuration.totalAmount);
    }

    function test_vestedAmountOf_whenAgreementDoesNotExist_reverts() public {
        vm.expectRevert(Vesting.AgreementNotFound.selector);

        vesting.vestedAmountOf(UNKNOWN_AGREEMENT_ID);
    }

    function test_vestedAmountOf_whenCancelledAtMidpoint_stopsAccruingTokens()
        public
    {
        uint256 agreementId = _givenAgreementCancelledAtMidpoint();
        vm.warp(END_DATE);

        uint256 vested = vesting.vestedAmountOf(agreementId);

        assertEq(vested, 500);
    }
}

contract CancelAgreementTest is VestingTestBase {
    function setUp() public override {
        super.setUp();
        configuration.revocable = true;
    }

    function test_cancelAgreement_whenAgreementIsRevocable_marksAgreementCancelled()
        public
    {
        uint256 agreementId = _givenAgreement();
        vm.warp(START_DATE);

        _cancelAsPayer(agreementId);

        (, , Vesting.AgreementState state, , ) = vesting.agreements(
            agreementId
        );
        assertEq(uint256(state), uint256(Vesting.AgreementState.Cancelled));
    }

    function test_cancelAgreement_whenAgreementIsIrrevocable_reverts() public {
        configuration.revocable = false;
        uint256 agreementId = _givenAgreement();
        vm.warp(START_DATE);
        vm.expectRevert(Vesting.AgreementNotRevocable.selector);

        _cancelAsPayer(agreementId);
    }

    function test_cancelAgreement_whenAgreementDoesNotExist_revertsWithAgreementNotFound()
        public
    {
        vm.expectRevert(Vesting.AgreementNotFound.selector);

        _cancelAsPayer(UNKNOWN_AGREEMENT_ID);
    }

    function test_cancelAgreement_whenCallerIsNotPayer_reverts() public {
        uint256 agreementId = _givenAgreement();
        vm.warp(START_DATE);
        vm.prank(outsider);
        vm.expectRevert(Vesting.UnauthorizedPayer.selector);

        vesting.cancelAgreement(agreementId);
    }

    function test_cancelAgreement_whenAfterEnd_reverts() public {
        uint256 agreementId = _givenAgreement();
        vm.warp(END_DATE + 1 days);
        vm.expectRevert(Vesting.AgreementEnded.selector);

        _cancelAsPayer(agreementId);
    }

    function test_cancelAgreement_whenAtMidpoint_recordsHalfOfAmountAsVested()
        public
    {
        uint256 agreementId = _givenAgreement();
        vm.warp(MIDPOINT);

        _cancelAsPayer(agreementId);

        (, , , uint256 vestedAtCancellation, ) = vesting.agreements(
            agreementId
        );
        assertEq(vestedAtCancellation, 500);
    }

    function testFuzz_cancelAgreement_whenDuringVesting_preservesAccruedEntitlement(
        uint256 amount,
        uint32 startDate,
        uint32 elapsedSeed,
        uint32 durationSeed
    ) public {
        uint256 elapsed = _arrangeFuzzedSchedule(
            amount,
            startDate,
            elapsedSeed,
            durationSeed
        );
        uint256 agreementId = _givenAgreement();
        vm.warp(configuration.startDate + elapsed);
        uint256 vestedBeforeCancellation = vesting.vestedAmountOf(agreementId);

        _cancelAsPayer(agreementId);

        (, , , uint256 vestedAtCancellation, ) = vesting.agreements(
            agreementId
        );
        assertEq(vestedAtCancellation, vestedBeforeCancellation);
    }

    function test_cancelAgreement_whenBeforeStart_returnsEntireAmountToPayer()
        public
    {
        uint256 agreementId = _givenAgreement();

        _cancelAsPayer(agreementId);

        assertEq(token.balanceOf(payer), AMOUNT);
        assertEq(token.balanceOf(address(vesting)), 0);
    }

    function test_cancelAgreement_whenAtMidpoint_returnsUnvestedHalfToPayer()
        public
    {
        uint256 agreementId = _givenAgreement();
        vm.warp(MIDPOINT);

        _cancelAsPayer(agreementId);

        assertEq(token.balanceOf(payer), 500);
        assertEq(token.balanceOf(address(vesting)), 500);
    }

    function testFuzz_cancelAgreement_whenBeforeEnd_refundsOnlyUnvestedTokens(
        uint256 amount,
        uint32 durationSeed,
        uint32 elapsedSeed
    ) public {
        uint256 elapsed = _arrangeFuzzedSchedule(
            amount,
            uint32(START_DATE),
            elapsedSeed,
            durationSeed
        );
        uint256 agreementId = _givenAgreement();
        vm.warp(configuration.startDate + elapsed);
        uint256 vestedBeforeCancellation = vesting.vestedAmountOf(agreementId);

        _cancelAsPayer(agreementId);

        assertEq(token.balanceOf(address(vesting)), vestedBeforeCancellation);
        assertEq(
            token.balanceOf(payer) + vestedBeforeCancellation,
            configuration.totalAmount
        );
    }

    function _arrangeFuzzedSchedule(
        uint256 amount,
        uint32 startDate,
        uint32 elapsedSeed,
        uint32 durationSeed
    ) private returns (uint256 elapsed) {
        configuration.totalAmount = bound(amount, 1, 1e30);
        configuration.startDate = startDate;
        uint256 duration = bound(durationSeed, 1, type(uint32).max);
        configuration.endDate = uint256(startDate) + duration;
        return bound(elapsedSeed, 0, duration - 1);
    }
}

contract ClaimAmountTest is VestingTestBase {
    function test_claimAmountFrom_whenAgreementDoesNotExist_revertsWithAgreementNotFound()
        public
    {
        vm.expectRevert(Vesting.AgreementNotFound.selector);

        _claimAsBeneficiary(UNKNOWN_AGREEMENT_ID, 1);
    }

    function test_claimAmountFrom_whenCallerIsNotBeneficiary_reverts() public {
        uint256 agreementId = _givenAgreement();
        vm.warp(MIDPOINT);
        vm.prank(outsider);
        vm.expectRevert(Vesting.UnauthorizedBeneficiary.selector);

        vesting.claimAmountFrom(agreementId, 1);
    }

    function test_claimAmountFrom_whenFullyVested_transfersTotalAmount()
        public
    {
        uint256 agreementId = _givenAgreement();
        vm.warp(END_DATE);

        _claimAsBeneficiary(agreementId, AMOUNT);

        assertEq(token.balanceOf(beneficiary), AMOUNT);
        assertEq(token.balanceOf(address(vesting)), 0);
    }

    function test_claimAmountFrom_whenRequestingPartialAmount_transfersRequestedAmount()
        public
    {
        uint256 agreementId = _givenAgreement();
        vm.warp(END_DATE);

        _claimAsBeneficiary(agreementId, 200);

        assertEq(token.balanceOf(beneficiary), 200);
        assertEq(token.balanceOf(address(vesting)), 800);
    }

    function test_claimAmountFrom_whenAmountExceedsVestedEntitlement_reverts()
        public
    {
        uint256 agreementId = _givenAgreement();
        vm.warp(MIDPOINT);
        vm.expectRevert(Vesting.InsufficientVestedAmount.selector);

        _claimAsBeneficiary(agreementId, 501);
    }

    function test_claimAmountFrom_whenCancelledAtMidpoint_transfersFrozenEntitlement()
        public
    {
        uint256 agreementId = _givenAgreementCancelledAtMidpoint();
        vm.warp(END_DATE + 1 days);

        _claimAsBeneficiary(agreementId, 500);

        assertEq(token.balanceOf(beneficiary), 500);
        assertEq(token.balanceOf(address(vesting)), 0);
    }

    function test_claimAmountFrom_whenCancelledEntitlementIsExhausted_reverts()
        public
    {
        uint256 agreementId = _givenAgreementCancelledAtMidpoint();
        vm.warp(END_DATE + 1 days);
        _claimAsBeneficiary(agreementId, 500);
        vm.expectRevert(Vesting.InsufficientVestedAmount.selector);

        _claimAsBeneficiary(agreementId, 1);
    }

    function test_claimAmountFrom_whenNothingHasVested_reverts() public {
        uint256 agreementId = _givenAgreement();
        vm.warp(START_DATE);
        vm.expectRevert(Vesting.InsufficientVestedAmount.selector);

        _claimAsBeneficiary(agreementId, 1);
    }

    function test_claimAmountFrom_whenWithdrawalSucceeds_emitsWithdrawalDetails()
        public
    {
        uint256 agreementId = _givenAgreement();
        vm.warp(END_DATE);
        vm.expectEmit(address(vesting));
        emit Vesting.AgreementWithdrawal(agreementId, beneficiary, AMOUNT);

        _claimAsBeneficiary(agreementId, AMOUNT);
    }

    function test_claimAmountFrom_whenTotalAmountWasAlreadyClaimed_reverts()
        public
    {
        uint256 agreementId = _givenAgreement();
        vm.warp(END_DATE);
        _claimAsBeneficiary(agreementId, AMOUNT);
        vm.expectRevert(Vesting.InsufficientVestedAmount.selector);

        _claimAsBeneficiary(agreementId, 1);
    }
}
