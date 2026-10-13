// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

interface IBotPayEscrow {
    function submitDelivery(uint256 agreementId, bytes32 evidenceHash) external;
    function releasePayment(uint256 agreementId) external;
    function finalizeAfterReview(uint256 agreementId) external;
    function refundUndelivered(uint256 agreementId) external;
}

/**
 * @title ReentrantAttacker
 * @notice Tries to reenter BotPayEscrow upon receiving funds during payment release, finalization, or refund.
 */
contract ReentrantAttacker {
    IBotPayEscrow public target;
    uint256 public targetAgreementId;
    enum AttackType { None, Release, Finalize, Refund }
    AttackType public attackType;
    uint256 public attackCount;
    bool public attackAttempted;
    bool public attackSuccess;

    constructor(address _target) {
        target = IBotPayEscrow(_target);
    }

    function setAttack(uint256 _agreementId, AttackType _type) external {
        targetAgreementId = _agreementId;
        attackType = _type;
        attackCount = 0;
        attackAttempted = false;
        attackSuccess = false;
    }

    function submitDelivery(uint256 agreementId, bytes32 evidenceHash) external {
        target.submitDelivery(agreementId, evidenceHash);
    }

    receive() external payable {
        if (attackType != AttackType.None && attackCount == 0) {
            attackCount++;
            attackAttempted = true;
            if (attackType == AttackType.Release) {
                target.releasePayment(targetAgreementId);
            } else if (attackType == AttackType.Finalize) {
                target.finalizeAfterReview(targetAgreementId);
            } else if (attackType == AttackType.Refund) {
                target.refundUndelivered(targetAgreementId);
            }
            attackSuccess = true;
        }
    }
}
