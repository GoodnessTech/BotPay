// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IBotPayEscrowTarget {
    function submitDelivery(uint256 agreementId, bytes32 evidenceHash) external;
}

/**
 * @title MaliciousRecipient
 * @notice Reverts on incoming ETH/BOT transfers to test resilience against griefing and failed transfers.
 */
contract MaliciousRecipient {
    bool public shouldRevert = true;
    IBotPayEscrowTarget public escrow;

    constructor(address _escrow) {
        escrow = IBotPayEscrowTarget(_escrow);
    }

    function setShouldRevert(bool _shouldRevert) external {
        shouldRevert = _shouldRevert;
    }

    function submitDelivery(uint256 agreementId, bytes32 evidenceHash) external {
        escrow.submitDelivery(agreementId, evidenceHash);
    }

    receive() external payable {
        if (shouldRevert) {
            revert("MaliciousRecipient: reject payment");
        }
    }
}
