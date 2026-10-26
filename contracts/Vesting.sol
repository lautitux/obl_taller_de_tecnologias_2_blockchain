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
            state: AgreementState.Active
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
        require(agreement.configuration.revocable);
        require(agreement.payer == msg.sender);

        agreement.state = AgreementState.Cancelled;
    }

    function vestedAmountOf(uint256 agreementId) public view returns (uint256) {
        AgreementConfiguration storage agreement = agreements[agreementId]
            .configuration;
        require(agreement.beneficiary != address(0));

        uint256 amount = agreement.totalAmount;
        uint256 startDate = agreement.startDate;
        uint256 endDate = agreement.endDate;

        uint256 secondsNow = block.timestamp;

        // Vesting starts when the block time reaches startDate.
        // forge-lint: disable-next-line(block-timestamp)
        if (startDate > secondsNow) {
            return 0;
        }

        // The full amount is vested once the block time reaches endDate.
        // forge-lint: disable-next-line(block-timestamp)
        if (secondsNow >= endDate) {
            return amount;
        }

        uint256 secondsElapsed = secondsNow - startDate;
        uint256 secondsTotal = endDate - startDate;

        return (amount * secondsElapsed) / secondsTotal;
    }
}
