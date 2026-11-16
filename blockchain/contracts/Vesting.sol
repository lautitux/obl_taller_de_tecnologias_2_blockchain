// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuardTransient} from "@openzeppelin/contracts/utils/ReentrancyGuardTransient.sol";

contract Vesting is ReentrancyGuardTransient {
    using SafeERC20 for IERC20;

    enum AgreementState {
        Active,
        Cancelled,
        Completed
    }

    struct AgreementConfiguration {
        address beneficiary;
        IERC20 token;
        uint256 totalAmount;
        uint256 startDate;
        uint256 endDate;
        bool revocable;
    }

    struct Agreement {
        address payer;
        AgreementConfiguration configuration;
        AgreementState state;
        uint256 vestedAmountBeforeCancelled;
        uint256 alreadyWithdrawnAmount;
    }

    error InvalidBeneficiary();
    error InvalidAmount();
    error InvalidDateRange();
    error AgreementNotRevocable();
    error UnauthorizedPayer();
    error AgreementEnded();
    error UnauthorizedBeneficiary();
    error InsufficientVestedAmount();
    error AgreementNotFound();
    error AgreementNotActive();
    error UnsupportedToken();

    event AgreementCreated(
        uint256 indexed agreementId,
        address indexed payer,
        address indexed beneficiary,
        address token,
        uint256 totalAmount,
        uint256 startDate,
        uint256 endDate,
        bool revocable
    );
    event AgreementWithdrawal(
        uint256 indexed agreementId,
        address indexed beneficiary,
        uint256 amount
    );
    event AgreementCancelled(
        uint256 indexed agreementId,
        address indexed payer,
        address indexed beneficiary,
        address token,
        uint256 vestedAmount,
        uint256 refundedAmount
    );

    mapping(uint256 => Agreement) public agreements;
    uint256 private nextAgreementId = 0;

    function createAgreement(
        AgreementConfiguration calldata config
    ) external nonReentrant returns (uint256) {
        require(config.beneficiary != address(0), InvalidBeneficiary());
        require(config.totalAmount != 0, InvalidAmount());
        require(config.endDate > config.startDate, InvalidDateRange());

        uint256 agreementId = nextAgreementId++;
        agreements[agreementId] = Agreement({
            payer: msg.sender,
            configuration: config,
            state: AgreementState.Active,
            vestedAmountBeforeCancelled: 0,
            alreadyWithdrawnAmount: 0
        });

        uint256 balanceBefore = config.token.balanceOf(address(this));
        config.token.safeTransferFrom(
            msg.sender,
            address(this),
            config.totalAmount
        );

        // Fee-on-transfer tokens deliver less than totalAmount and would leave
        // the agreement underfunded. The strict equality is safe: both reads
        // happen in this call, and nonReentrant keeps any other Vesting
        // operation from moving the balance between them.
        uint256 received =
            config.token.balanceOf(address(this)) - balanceBefore;
        // forge-lint: disable-next-line(incorrect-strict-equality)
        require(received == config.totalAmount, UnsupportedToken());

        emit AgreementCreated(
            agreementId,
            msg.sender,
            config.beneficiary,
            address(config.token),
            config.totalAmount,
            config.startDate,
            config.endDate,
            config.revocable
        );
        return agreementId;
    }

    function cancelAgreement(uint256 agreementId) external nonReentrant {
        Agreement storage agreement = agreements[agreementId];
        require(
            agreement.configuration.beneficiary != address(0),
            AgreementNotFound()
        );
        require(agreement.state == AgreementState.Active, AgreementNotActive());

        address payer = agreement.payer;
        IERC20 token = agreement.configuration.token;
        uint256 amount = agreement.configuration.totalAmount;
        uint256 startDate = agreement.configuration.startDate;
        uint256 endDate = agreement.configuration.endDate;

        uint256 secondsNow = block.timestamp;

        require(agreement.configuration.revocable, AgreementNotRevocable());
        require(agreement.payer == msg.sender, UnauthorizedPayer());
        // Cancelling may only be done before the end date.
        // forge-lint: disable-next-line(block-timestamp)
        require(secondsNow < endDate, AgreementEnded());

        uint256 vestedAmount = calculateVestedAmount(
            amount,
            startDate,
            endDate,
            secondsNow
        );
        uint256 unvestedAmount = amount - vestedAmount;

        agreement.state = AgreementState.Cancelled;
        agreement.vestedAmountBeforeCancelled = vestedAmount;

        emit AgreementCancelled(
            agreementId,
            payer,
            agreement.configuration.beneficiary,
            address(token),
            vestedAmount,
            unvestedAmount
        );

        token.safeTransfer(payer, unvestedAmount);
    }

    function claimAmountFrom(
        uint256 agreementId,
        uint256 claimAmount
    ) external nonReentrant {
        Agreement storage agreement = agreements[agreementId];
        address beneficiary = agreement.configuration.beneficiary;
        require(beneficiary != address(0), AgreementNotFound());
        require(claimAmount != 0, InvalidAmount());

        IERC20 token = agreement.configuration.token;
        uint256 amount = agreement.configuration.totalAmount;
        uint256 startDate = agreement.configuration.startDate;
        uint256 endDate = agreement.configuration.endDate;
        AgreementState state = agreement.state;
        uint256 alreadyWithdrawnAmount = agreement.alreadyWithdrawnAmount;

        uint256 secondsNow = block.timestamp;

        require(beneficiary == msg.sender, UnauthorizedBeneficiary());

        uint256 vestedAmount;
        if (state == AgreementState.Cancelled) {
            vestedAmount = agreement.vestedAmountBeforeCancelled;
        } else {
            vestedAmount = calculateVestedAmount(
                amount,
                startDate,
                endDate,
                secondsNow
            );
        }
        uint256 amountAvailableForWithdrawal =
            vestedAmount - alreadyWithdrawnAmount;

        require(
            claimAmount <= amountAvailableForWithdrawal,
            InsufficientVestedAmount()
        );

        agreement.alreadyWithdrawnAmount += claimAmount;

        if (
            state == AgreementState.Active &&
            // forge-lint: disable-next-line(block-timestamp)
            secondsNow >= endDate &&
            agreement.alreadyWithdrawnAmount == amount
        ) {
            agreement.state = AgreementState.Completed;
        }

        emit AgreementWithdrawal(agreementId, beneficiary, claimAmount);

        token.safeTransfer(beneficiary, claimAmount);
    }

    function vestedAmountOf(uint256 agreementId) public view returns (uint256) {
        Agreement storage agreement = agreements[agreementId];
        require(
            agreement.configuration.beneficiary != address(0),
            AgreementNotFound()
        );

        if (agreement.state == AgreementState.Cancelled) {
            return agreement.vestedAmountBeforeCancelled;
        }

        uint256 amount = agreement.configuration.totalAmount;
        uint256 startDate = agreement.configuration.startDate;
        uint256 endDate = agreement.configuration.endDate;

        uint256 secondsNow = block.timestamp;

        return calculateVestedAmount(amount, startDate, endDate, secondsNow);
    }

    function calculateVestedAmount(
        uint256 amount,
        uint256 startDate,
        uint256 endDate,
        uint256 secondsNow
    ) internal pure returns (uint256) {
        if (startDate > secondsNow) {
            return 0;
        }

        if (secondsNow >= endDate) {
            return amount;
        }

        uint256 secondsElapsed = secondsNow - startDate;
        uint256 secondsTotal = endDate - startDate;

        return Math.mulDiv(amount, secondsElapsed, secondsTotal);
    }
}
