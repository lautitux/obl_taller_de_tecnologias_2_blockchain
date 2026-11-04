// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {Vesting} from "./Vesting.sol";
import {MockToken, VestingTestBase} from "./Vesting.t.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ReentrantToken is ERC20 {
    error ForcedTransferFailure();

    Vesting internal vesting;
    bytes internal reentrantCall;
    bool internal duringTransferFrom;
    bool internal beforeTransfer;
    uint256 internal remainingReentries;
    bool internal failTransfer;
    bool internal failTransferFrom;

    uint256 public reentrancyAttempts;
    uint256 public successfulReentries;
    bool public lastReentrySucceeded;
    bytes public lastReentryReturnData;

    constructor(Vesting vestingContract) ERC20("Reentrant Token", "REENT") {
        vesting = vestingContract;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function prepareReentrantCall(
        bool onTransferFrom,
        bool beforeTokenMovement,
        uint256 repetitions,
        bytes calldata callData
    ) external {
        duringTransferFrom = onTransferFrom;
        beforeTransfer = beforeTokenMovement;
        remainingReentries = repetitions;
        reentrantCall = callData;
        reentrancyAttempts = 0;
        successfulReentries = 0;
        lastReentrySucceeded = false;
        delete lastReentryReturnData;
    }

    function setTransferFailure(bool onTransferFrom, bool enabled) external {
        if (onTransferFrom) {
            failTransferFrom = enabled;
        } else {
            failTransfer = enabled;
        }
    }
    function transfer(
        address to,
        uint256 amount
    ) public override returns (bool) {
        if (!duringTransferFrom && beforeTransfer) {
            _attemptReentry();
        }

        bool success = super.transfer(to, amount);

        if (!duringTransferFrom && !beforeTransfer) {
            _attemptReentry();
        }

        require(!failTransfer, ForcedTransferFailure());
        return success;
    }

    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public override returns (bool) {
        if (duringTransferFrom && beforeTransfer) {
            _attemptReentry();
        }

        bool success = super.transferFrom(from, to, amount);

        if (duringTransferFrom && !beforeTransfer) {
            _attemptReentry();
        }

        require(!failTransferFrom, ForcedTransferFailure());
        return success;
    }

    function _attemptReentry() private {
        if (msg.sender != address(vesting) || remainingReentries == 0) {
            return;
        }

        --remainingReentries;
        ++reentrancyAttempts;

        (bool success, bytes memory returnData) = address(vesting).call(
            reentrantCall
        );

        if (success) {
            ++successfulReentries;
        }

        lastReentrySucceeded = success;
        lastReentryReturnData = returnData;
    }
}

contract VestingReentrancyTest is VestingTestBase {
    uint256 internal constant MAX_REENTRIES = 3;
    uint256 internal constant MAX_AGREEMENTS = 7;

    ReentrantToken internal reentrantToken;
    uint256 internal agreementId;
    uint256 internal otherAgreementId;
    uint256 internal protectedAgreementId;

    function setUp() public override {
        super.setUp();
        reentrantToken = new ReentrantToken(vesting);
        token = MockToken(address(reentrantToken));
        payer = address(reentrantToken);
        beneficiary = address(reentrantToken);
        configuration.beneficiary = beneficiary;
        configuration.token = IERC20(address(reentrantToken));
        configuration.revocable = true;

        agreementId = _givenAgreement();
        otherAgreementId = _givenAgreement();
        protectedAgreementId = _givenProtectedAgreement();
        _fundAndApprove((MAX_REENTRIES + 1) * AMOUNT);
        vm.warp(MIDPOINT);
    }

    function testFuzz_createAgreement_whenTokenReenters_preservesAccounting(
        uint8 action,
        uint16 requestedAmount,
        uint8 repetitions,
        bool beforeTransfer,
        bool anotherAgreement
    ) public {
        uint256 claimAmount = bound(requestedAmount, 1, AMOUNT);
        uint256 targetId = anotherAgreement ? otherAgreementId : 3;
        _prepareAttack(
            true,
            beforeTransfer,
            repetitions,
            action,
            targetId,
            claimAmount
        );

        uint256 createdId = _createAgreement();

        assertEq(createdId, 3);
        _assertReentryAttempted(action, targetId);
        _assertAccounting(500);
    }

    function testFuzz_claimAmountFrom_whenTokenReenters_preservesAccounting(
        uint8 action,
        uint16 requestedAmount,
        uint8 repetitions,
        bool beforeTransfer,
        bool anotherAgreement
    ) public {
        uint256 claimAmount = bound(requestedAmount, 1, 500);
        uint256 targetId = anotherAgreement ? otherAgreementId : agreementId;
        _prepareAttack(
            false,
            beforeTransfer,
            repetitions,
            action,
            targetId,
            claimAmount
        );

        _claimAsBeneficiary(agreementId, claimAmount);

        _assertReentryAttempted(action, targetId);
        _assertAccounting(500);
    }

    function testFuzz_cancelAgreement_whenTokenReenters_preservesAccounting(
        uint8 action,
        uint16 requestedAmount,
        uint8 repetitions,
        bool beforeTransfer,
        bool anotherAgreement
    ) public {
        uint256 claimAmount = bound(requestedAmount, 1, AMOUNT);
        uint256 targetId = anotherAgreement ? otherAgreementId : agreementId;
        _prepareAttack(
            false,
            beforeTransfer,
            repetitions,
            action,
            targetId,
            claimAmount
        );

        _cancelAsPayer(agreementId);

        _assertReentryAttempted(action, targetId);
        _assertAccounting(500);
    }

    function testFuzz_claimAmountFrom_whenTokenReentersForAllVestedTokens_rejectsDoubleClaim(
        bool beforeTransfer
    ) public {
        _prepareAttack(false, beforeTransfer, 1, 1, agreementId, 500);

        _claimAsBeneficiary(agreementId, 500);

        _assertReentryRejected(Vesting.InsufficientVestedAmount.selector);
        assertEq(token.balanceOf(payer), 4_500);
        _assertAccounting(500);
    }

    function testFuzz_claimAmountFrom_whenTokenReentersAtEnd_preservesOtherAgreements(
        bool beforeTransfer
    ) public {
        vm.warp(END_DATE);
        _prepareAttack(false, beforeTransfer, 1, 1, agreementId, AMOUNT);

        _claimAsBeneficiary(agreementId, AMOUNT);

        _assertReentryRejected(Vesting.InsufficientVestedAmount.selector);
        assertEq(token.balanceOf(address(vesting)), 2_000);
        (, , Vesting.AgreementState state, , ) = vesting.agreements(
            agreementId
        );
        assertEq(uint256(state), uint256(Vesting.AgreementState.Completed));
        _assertAccounting(AMOUNT);
    }

    function testFuzz_claimAmountFrom_whenTokenReentersAfterCancellation_preservesFrozenEntitlement(
        bool beforeTransfer
    ) public {
        _cancelAsPayer(agreementId);
        vm.warp(END_DATE);
        _prepareAttack(false, beforeTransfer, 1, 1, agreementId, 500);

        _claimAsBeneficiary(agreementId, 500);

        _assertReentryRejected(Vesting.InsufficientVestedAmount.selector);
        assertEq(token.balanceOf(address(vesting)), 2_000);
        _assertAccounting(AMOUNT);
    }

    function testFuzz_cancelAgreement_whenTokenReentersDuringRefund_rejectsRepeatedCancellation(
        bool beforeTransfer
    ) public {
        _prepareAttack(false, beforeTransfer, 1, 2, agreementId, 500);

        _cancelAsPayer(agreementId);

        _assertReentryRejected(Vesting.AgreementNotActive.selector);
        assertEq(token.balanceOf(address(vesting)), 2_500);
        _assertAccounting(500);
    }

    function testFuzz_createAgreement_whenTransferFromFails_revertsNestedChanges(
        uint8 action,
        bool beforeTransfer
    ) public {
        _prepareAttack(true, beforeTransfer, 3, action, otherAgreementId, 250);
        reentrantToken.setTransferFailure(true, true);
        vm.expectRevert(ReentrantToken.ForcedTransferFailure.selector);

        _createAgreement();

        _assertRolledBack();
        reentrantToken.setTransferFailure(true, false);
        uint256 createdId = _createAgreement();
        assertEq(createdId, 3);
        _assertAccounting(500);
    }

    function testFuzz_claimAmountFrom_whenTransferFails_revertsNestedChanges(
        uint8 action,
        bool beforeTransfer
    ) public {
        _prepareAttack(false, beforeTransfer, 3, action, otherAgreementId, 250);
        reentrantToken.setTransferFailure(false, true);
        vm.expectRevert(ReentrantToken.ForcedTransferFailure.selector);

        _claimAsBeneficiary(agreementId, 250);

        _assertRolledBack();
    }

    function testFuzz_cancelAgreement_whenTransferFails_revertsNestedChanges(
        uint8 action,
        bool beforeTransfer
    ) public {
        _prepareAttack(false, beforeTransfer, 3, action, otherAgreementId, 250);
        reentrantToken.setTransferFailure(false, true);
        vm.expectRevert(ReentrantToken.ForcedTransferFailure.selector);

        _cancelAsPayer(agreementId);

        _assertRolledBack();
    }

    function _givenProtectedAgreement() private returns (uint256) {
        Vesting.AgreementConfiguration memory otherConfiguration =
            configuration;
        otherConfiguration.beneficiary = outsider;
        token.mint(outsider, AMOUNT);
        vm.prank(outsider);
        token.approve(address(vesting), AMOUNT);
        vm.prank(outsider);
        return vesting.createAgreement(otherConfiguration);
    }

    function _prepareAttack(
        bool onTransferFrom,
        bool beforeTransfer,
        uint8 repetitions,
        uint8 action,
        uint256 targetId,
        uint256 claimAmount
    ) private {
        reentrantToken.prepareReentrantCall(
            onTransferFrom,
            beforeTransfer,
            bound(repetitions, 1, MAX_REENTRIES),
            _reentrantCallData(action, targetId, claimAmount)
        );
    }

    function _reentrantCallData(
        uint8 action,
        uint256 targetId,
        uint256 claimAmount
    ) private view returns (bytes memory) {
        action = uint8(bound(action, 0, 4));

        if (action == 0) {
            return abi.encodeCall(Vesting.createAgreement, (configuration));
        }
        if (action == 1) {
            return
                abi.encodeCall(
                    Vesting.claimAmountFrom,
                    (targetId, claimAmount)
                );
        }
        if (action == 2) {
            return abi.encodeCall(Vesting.cancelAgreement, (targetId));
        }
        if (action == 3) {
            return abi.encodeCall(Vesting.vestedAmountOf, (targetId));
        }

        return abi.encodeWithSelector(vesting.agreements.selector, targetId);
    }

    function _assertReentryAttempted(
        uint8 action,
        uint256 targetId
    ) private view {
        assertGt(reentrantToken.reentrancyAttempts(), 0);
        assertLe(reentrantToken.reentrancyAttempts(), MAX_REENTRIES);

        action = uint8(bound(action, 0, 4));
        if (action >= 3) {
            assertTrue(reentrantToken.lastReentrySucceeded());
        }
        if (action == 3) {
            assertEq(
                reentrantToken.lastReentryReturnData(),
                abi.encode(uint256(500))
            );
        }
        if (action == 4) {
            (bool success, bytes memory finalState) = address(vesting)
                .staticcall(
                    abi.encodeWithSelector(
                        vesting.agreements.selector,
                        targetId
                    )
                );
            assertTrue(success);
            assertEq(reentrantToken.lastReentryReturnData(), finalState);
        }
    }

    function _assertReentryRejected(bytes4 expectedError) private view {
        assertEq(reentrantToken.reentrancyAttempts(), 1);
        assertEq(reentrantToken.successfulReentries(), 0);
        assertFalse(reentrantToken.lastReentrySucceeded());
        assertEq(
            reentrantToken.lastReentryReturnData(),
            abi.encodeWithSelector(expectedError)
        );
    }

    function _assertAccounting(uint256 vestedLimit) private view {
        uint256 totalReserved;

        for (uint256 id; id < MAX_AGREEMENTS; ++id) {
            (
                ,
                Vesting.AgreementConfiguration memory stored,
                Vesting.AgreementState state,
                uint256 vestedAtCancellation,
                uint256 withdrawn
            ) = vesting.agreements(id);

            if (stored.beneficiary == address(0)) {
                continue;
            }

            assertEq(stored.totalAmount, AMOUNT);
            assertEq(address(stored.token), address(token));
            assertLe(withdrawn, vestedLimit);

            if (state == Vesting.AgreementState.Cancelled) {
                assertEq(vestedAtCancellation, 500);
                assertLe(withdrawn, 500);
                assertEq(vesting.vestedAmountOf(id), 500);
                totalReserved += 500 - withdrawn;
            } else {
                assertEq(vesting.vestedAmountOf(id), vestedLimit);
                if (state == Vesting.AgreementState.Completed) {
                    assertEq(withdrawn, AMOUNT);
                }
                totalReserved += AMOUNT - withdrawn;
            }
        }

        assertEq(token.balanceOf(address(vesting)), totalReserved);
        _assertProtectedAgreement();
    }

    function _assertProtectedAgreement() private view {
        (
            address storedPayer,
            Vesting.AgreementConfiguration memory stored,
            Vesting.AgreementState state,
            uint256 vestedAtCancellation,
            uint256 withdrawn
        ) = vesting.agreements(protectedAgreementId);

        assertEq(storedPayer, outsider);
        assertEq(stored.beneficiary, outsider);
        assertEq(stored.totalAmount, AMOUNT);
        assertEq(uint256(state), uint256(Vesting.AgreementState.Active));
        assertEq(vestedAtCancellation, 0);
        assertEq(withdrawn, 0);
        assertEq(token.balanceOf(outsider), 0);
    }

    function _assertRolledBack() private view {
        _assertAgreementUnchanged(agreementId);
        _assertAgreementUnchanged(otherAgreementId);
        (, Vesting.AgreementConfiguration memory stored, , , ) = vesting
            .agreements(3);
        assertEq(stored.beneficiary, address(0));
        assertEq(token.balanceOf(address(vesting)), 3_000);
        assertEq(token.balanceOf(payer), 4_000);
        assertEq(reentrantToken.reentrancyAttempts(), 0);
        _assertAccounting(500);
    }

    function _assertAgreementUnchanged(uint256 id) private view {
        (
            ,
            ,
            Vesting.AgreementState state,
            uint256 vestedAtCancellation,
            uint256 withdrawn
        ) = vesting.agreements(id);

        assertEq(uint256(state), uint256(Vesting.AgreementState.Active));
        assertEq(vestedAtCancellation, 0);
        assertEq(withdrawn, 0);
    }
}
