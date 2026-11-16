// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {Vesting} from "../contracts/Vesting.sol";
import {MockToken} from "./mocks/MockToken.sol";
import {VestingTestBase} from "./Vesting.t.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";

contract ReentrantToken is ERC20 {
    Vesting internal vesting;
    bytes internal reentrantCall;
    bool internal duringTransferFrom;
    bool internal beforeTransfer;
    uint256 internal remainingReentries;
    bool internal returnFalseOnTransfer;
    bool internal returnFalseOnTransferFrom;

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

    function setReturnFalse(bool onTransferFrom, bool enabled) external {
        if (onTransferFrom) {
            returnFalseOnTransferFrom = enabled;
        } else {
            returnFalseOnTransfer = enabled;
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

        return success && !returnFalseOnTransfer;
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

        return success && !returnFalseOnTransferFrom;
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
    uint256 internal constant HALF = AMOUNT / 2;
    uint256 internal constant PAYER_FUNDS = (MAX_REENTRIES + 1) * AMOUNT;

    // setUp creates ids 0 (attacked), 1 (other) and 2 (protected), so the
    // next agreement is 3, and nested createAgreement calls can add up to
    // MAX_REENTRIES more.
    uint256 internal constant NEW_AGREEMENT_ID = 3;
    uint256 internal constant MAX_AGREEMENTS =
        NEW_AGREEMENT_ID + 1 + MAX_REENTRIES;

    ReentrantToken internal reentrantToken;
    MockToken internal honestToken;
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
        _fundAndApprove(PAYER_FUNDS);
        vm.warp(MIDPOINT);
    }

    function testFuzz_createAgreement_whenTokenReenters_preservesAccounting(
        uint8 action,
        uint16 requestedAmount,
        uint8 repetitions,
        bool beforeTransfer,
        uint8 target
    ) public {
        uint256 claimAmount = bound(requestedAmount, 1, AMOUNT);
        uint256 targetId = _targetId(target, NEW_AGREEMENT_ID);
        _prepareAttack(
            true,
            beforeTransfer,
            repetitions,
            action,
            targetId,
            claimAmount
        );

        uint256 createdId = _createAgreement();

        assertEq(createdId, NEW_AGREEMENT_ID);
        _assertReentryAttempted(action, targetId);
        _assertAccounting(HALF);
    }

    function testFuzz_claimAmountFrom_whenTokenReenters_preservesAccounting(
        uint8 action,
        uint16 requestedAmount,
        uint8 repetitions,
        bool beforeTransfer,
        uint8 target
    ) public {
        uint256 claimAmount = bound(requestedAmount, 1, HALF);
        uint256 targetId = _targetId(target, agreementId);
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
        _assertAccounting(HALF);
    }

    function testFuzz_cancelAgreement_whenTokenReenters_preservesAccounting(
        uint8 action,
        uint16 requestedAmount,
        uint8 repetitions,
        bool beforeTransfer,
        uint8 target
    ) public {
        uint256 claimAmount = bound(requestedAmount, 1, AMOUNT);
        uint256 targetId = _targetId(target, agreementId);
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
        _assertAccounting(HALF);
    }

    function test_claimAmountFrom_whenTokenReentersForAllVestedTokens_rejectsDoubleClaim()
        public
    {
        _forBothTimings(_checkDoubleClaimRejected);
    }

    function test_claimAmountFrom_whenTokenReentersAtEnd_preservesOtherAgreements()
        public
    {
        _forBothTimings(_checkClaimAtEndRejected);
    }

    function test_claimAmountFrom_whenTokenReentersAfterCancellation_preservesFrozenEntitlement()
        public
    {
        _forBothTimings(_checkClaimAfterCancellationRejected);
    }

    function test_cancelAgreement_whenTokenReentersDuringRefund_rejectsRepeatedCancellation()
        public
    {
        _forBothTimings(_checkRepeatedCancellationRejected);
    }

    function test_createAgreement_whenTransferFromReturnsFalse_reverts()
        public
    {
        reentrantToken.setReturnFalse(true, true);
        _expectSafeERC20Failure();

        _createAgreement();
    }

    function test_claimAmountFrom_whenTransferReturnsFalse_reverts() public {
        reentrantToken.setReturnFalse(false, true);
        _expectSafeERC20Failure();

        _claimAsBeneficiary(agreementId, HALF);
    }

    function test_cancelAgreement_whenTransferReturnsFalse_reverts() public {
        reentrantToken.setReturnFalse(false, true);
        _expectSafeERC20Failure();

        _cancelAsPayer(agreementId);
    }

    function _checkDoubleClaimRejected(bool beforeTransfer) private {
        _prepareAttack(false, beforeTransfer, 1, 1, agreementId, HALF);

        _claimAsBeneficiary(agreementId, HALF);

        _assertReentryRejected();
        assertEq(token.balanceOf(payer), PAYER_FUNDS + HALF);
        _assertAccounting(HALF);
    }

    function _checkClaimAtEndRejected(bool beforeTransfer) private {
        vm.warp(END_DATE);
        _prepareAttack(false, beforeTransfer, 1, 1, agreementId, AMOUNT);

        _claimAsBeneficiary(agreementId, AMOUNT);

        _assertReentryRejected();
        assertEq(token.balanceOf(address(vesting)), AMOUNT);
        (, , Vesting.AgreementState state, , ) = vesting.agreements(
            agreementId
        );
        assertEq(uint256(state), uint256(Vesting.AgreementState.Completed));
        _assertAccounting(AMOUNT);
    }

    function _checkClaimAfterCancellationRejected(bool beforeTransfer) private {
        _cancelAsPayer(agreementId);
        vm.warp(END_DATE);
        _prepareAttack(false, beforeTransfer, 1, 1, agreementId, HALF);

        _claimAsBeneficiary(agreementId, HALF);

        _assertReentryRejected();
        assertEq(token.balanceOf(address(vesting)), AMOUNT);
        _assertAccounting(AMOUNT);
    }

    function _checkRepeatedCancellationRejected(bool beforeTransfer) private {
        _prepareAttack(false, beforeTransfer, 1, 2, agreementId, HALF);

        _cancelAsPayer(agreementId);

        _assertReentryRejected();
        assertEq(token.balanceOf(address(vesting)), 2 * AMOUNT - HALF);
        _assertAccounting(HALF);
    }

    /// Runs `check` once reentering before the token movement and once after,
    /// each from the state left by setUp.
    function _forBothTimings(function(bool) internal check) private {
        uint256 snapshot = vm.snapshotState();
        check(true);
        vm.revertToState(snapshot);
        vm.warp(MIDPOINT);
        check(false);
    }

    function _givenProtectedAgreement() private returns (uint256) {
        honestToken = new MockToken();
        Vesting.AgreementConfiguration memory protectedConfiguration =
            configuration;
        protectedConfiguration.beneficiary = outsider;
        protectedConfiguration.token = IERC20(address(honestToken));

        honestToken.mint(outsider, AMOUNT);
        vm.prank(outsider);
        honestToken.approve(address(vesting), AMOUNT);
        vm.prank(outsider);
        return vesting.createAgreement(protectedConfiguration);
    }

    /// Selects the reentry target: the agreement under attack, another
    /// agreement of the same attacker, or the protected agreement.
    function _targetId(
        uint8 target,
        uint256 ownId
    ) private view returns (uint256) {
        target = uint8(bound(target, 0, 2));
        if (target == 0) {
            return ownId;
        }
        if (target == 1) {
            return otherAgreementId;
        }
        return protectedAgreementId;
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

    function _expectSafeERC20Failure() private {
        vm.expectRevert(
            abi.encodeWithSelector(
                SafeERC20.SafeERC20FailedOperation.selector,
                address(reentrantToken)
            )
        );
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
            assertEq(reentrantToken.lastReentryReturnData(), abi.encode(HALF));
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

    /// The guard rejects every nested call before it reaches the business logic.
    function _assertReentryRejected() private view {
        assertEq(reentrantToken.reentrancyAttempts(), 1);
        assertEq(reentrantToken.successfulReentries(), 0);
        assertFalse(reentrantToken.lastReentrySucceeded());
        assertEq(
            reentrantToken.lastReentryReturnData(),
            abi.encodeWithSelector(
                ReentrancyGuardTransient.ReentrancyGuardReentrantCall.selector
            )
        );
    }

    /// Checks every agreement funded with the reentrant token and the
    /// protected one. All of them share `configuration`'s dates and amount,
    /// so an active or completed agreement has vested `vestedLimit`, and a
    /// cancelled one froze HALF, since cancellation only happens at MIDPOINT.
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

            if (
                stored.beneficiary == address(0) || id == protectedAgreementId
            ) {
                continue;
            }

            assertEq(stored.totalAmount, AMOUNT);
            assertEq(address(stored.token), address(token));

            if (state == Vesting.AgreementState.Cancelled) {
                assertEq(vestedAtCancellation, HALF);
                assertLe(withdrawn, HALF);
                assertEq(vesting.vestedAmountOf(id), HALF);
                totalReserved += HALF - withdrawn;
            } else {
                assertLe(withdrawn, vestedLimit);
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
        assertEq(address(stored.token), address(honestToken));
        assertEq(stored.totalAmount, AMOUNT);
        assertEq(uint256(state), uint256(Vesting.AgreementState.Active));
        assertEq(vestedAtCancellation, 0);
        assertEq(withdrawn, 0);
        assertEq(honestToken.balanceOf(address(vesting)), AMOUNT);
        assertEq(honestToken.balanceOf(outsider), 0);
    }
}
