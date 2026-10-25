// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.34;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Vesting {
    struct Agreement {
        address payer;
        address beneficiary;
        IERC20 token;
        uint256 totalAmount;
        uint256 startDate;
        uint256 endDate;
        bool revocable;
    }

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

        uint256 agreementId = nextAgreementId++;
        agreements[agreementId] = Agreement(
            msg.sender,
            beneficiary,
            token,
            totalAmount,
            startDate,
            endDate,
            revocable
        );
        return agreementId;
    }
}
