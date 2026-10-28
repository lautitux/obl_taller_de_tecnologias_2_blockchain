// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Vesting {
    using SafeERC20 for IERC20;

    enum AgreementState {
        Active,
        Cancelled
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
    }

    event AgreementCreated(uint256 indexed id);

    mapping(uint256 => Agreement) public agreements;
    uint256 private nextAgreementId = 0;

    function createAgreement(
        AgreementConfiguration calldata config
    ) external returns (uint256) {
        require(config.beneficiary != address(0));
        require(config.totalAmount != 0);
        require(config.endDate > config.startDate);

        uint256 agreementId = nextAgreementId++;
        agreements[agreementId] = Agreement({
            payer: msg.sender,
            configuration: config,
            state: AgreementState.Active,
            vestedAmountBeforeCancelled: 0
        });

        config.token.safeTransferFrom(
            msg.sender,
            address(this),
            config.totalAmount
        );

        emit AgreementCreated(agreementId);
        return agreementId;
    }

    function cancelAgreement(uint256 agreementId) external {
        Agreement storage agreement = agreements[agreementId];

        address payer = agreement.payer;
        IERC20 token = agreement.configuration.token;
        uint256 amount = agreement.configuration.totalAmount;
        uint256 startDate = agreement.configuration.startDate;
        uint256 endDate = agreement.configuration.endDate;

        uint256 secondsNow = block.timestamp;

        require(agreement.configuration.revocable);
        require(agreement.payer == msg.sender);
        // Cancelling may only be done before the end date.
        // forge-lint: disable-next-line(block-timestamp)
        require(secondsNow < endDate);

        uint256 vestedAmount = calculateVestedAmount(
            amount,
            startDate,
            endDate,
            secondsNow
        );
        uint256 unvestedAmount = amount - vestedAmount;

        agreement.state = AgreementState.Cancelled;
        agreement.vestedAmountBeforeCancelled = vestedAmount;

        token.safeTransfer(payer, unvestedAmount);
    }

    function claimAmountFrom(uint256 agreementId, uint256 amount) external {
        Agreement storage agreement = agreements[agreementId];

        address beneficiary = agreement.configuration.beneficiary;

        require(beneficiary == msg.sender);
    }

    function vestedAmountOf(uint256 agreementId) public view returns (uint256) {
        Agreement storage agreement = agreements[agreementId];
        require(agreement.configuration.beneficiary != address(0));

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

        return (amount * secondsElapsed) / secondsTotal;
    }
}
