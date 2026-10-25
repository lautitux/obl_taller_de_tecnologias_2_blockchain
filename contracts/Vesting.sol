// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

contract Vesting {
    using SafeERC20 for IERC20;

    enum AgreementState {
        Active
    }

    struct Agreement {
        address payer;
        address beneficiary;
        IERC20 token;
        uint256 totalAmount;
        uint256 startDate;
        uint256 endDate;
        bool revocable;
        AgreementState state;
    }

    event AgreementCreated(uint256 indexed id);

    mapping(uint256 => Agreement) public agreements;
    uint256 private nextAgreementId = 0;

    function createAgreement(
        address beneficiary,
        IERC20 token,
        uint256 totalAmount,
        uint256 startDate,
        uint256 endDate,
        bool revocable
    ) external returns (uint256) {
        require(beneficiary != address(0));
        require(totalAmount != 0);
        require(endDate > startDate);

        uint256 agreementId = nextAgreementId++;
        agreements[agreementId] = Agreement(
            msg.sender,
            beneficiary,
            token,
            totalAmount,
            startDate,
            endDate,
            revocable,
            AgreementState.Active
        );

        token.safeTransferFrom(msg.sender, address(this), totalAmount);

        emit AgreementCreated(agreementId);
        return agreementId;
    }

    function vestedAmountOf(uint256 agreementId) public view returns (uint256) {
        Agreement storage agreement = agreements[agreementId];

        uint256 amount = agreement.totalAmount;
        uint256 startDate = agreement.startDate;
        uint256 endDate = agreement.endDate;

        uint256 secondsNow = block.timestamp;

        if (startDate > secondsNow) {
            return 0;
        }

        if (secondsNow >= endDate) {
            return amount;
        }

        uint256 secondsPassed = secondsNow - startDate;
        uint256 secondsTotal = endDate - startDate;

        return (amount * secondsPassed) / secondsTotal;
    }
}
