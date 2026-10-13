// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title BotPayEscrow
 * @author BotPay Protocol Team
 * @notice Production-grade, gas-optimized, machine-to-machine escrow protocol for autonomous services.
 * @dev Enforces the REQUEST -> QUOTE -> FUND -> DELIVER -> VERIFY/ACCEPT -> SETTLE lifecycle using native BOT.
 *      Designed for BOT Chain Mainnet (Chain ID 677).
 *      No admin keys, no pause doors, no upgradeability, strict checks-effects-interactions, and storage packing.
 */
contract BotPayEscrow {
    // --- Custom Errors (Gas optimized: saves ~200-500 gas vs require strings) ---
    error InvalidProvider();
    error SelfPaymentNotAllowed();
    error ZeroValuePayment();
    error InvalidServiceDeadline();
    error InvalidReviewDuration();
    error AgreementNotFound();
    error Unauthorized();
    error InvalidState(AgreementStatus currentStatus, AgreementStatus requiredStatus);
    error ServiceDeadlinePassed(uint40 deadline, uint40 currentTimestamp);
    error ServiceDeadlineNotPassed(uint40 deadline, uint40 currentTimestamp);
    error ReviewWindowNotClosed(uint40 reviewDeadline, uint40 currentTimestamp);
    error EmptyEvidenceHash();
    error TransferFailed();
    error DirectDepositNotAllowed();
    error ReentrancyGuardLocked();

    // --- Enums & Structs ---
    enum AgreementStatus {
        None,       // 0: Non-existent
        Funded,     // 1: Created and funded with native BOT
        Delivered,  // 2: Service evidence submitted by provider, review window active
        Released,   // 3: Payment settled to provider (terminal)
        Refunded    // 4: Escrow refunded to buyer (terminal)
    }

    /**
     * @dev Agreement storage layout packed into 4 32-byte slots.
     * Slot 0: buyer (20 bytes) + status (1 byte) + serviceDeadline (5 bytes) + reviewDuration (4 bytes) + padding (2 bytes) = 32 bytes
     * Slot 1: provider (20 bytes) + deliveryTimestamp (5 bytes) + reviewDeadline (5 bytes) + padding (2 bytes) = 32 bytes
     * Slot 2: amount (32 bytes)
     * Slot 3: deliveryEvidenceHash (32 bytes)
     */
    struct Agreement {
        // Slot 0 (32 bytes)
        address buyer;
        AgreementStatus status;
        uint40 serviceDeadline;
        uint32 reviewDuration;

        // Slot 1 (32 bytes)
        address provider;
        uint40 deliveryTimestamp;
        uint40 reviewDeadline;

        // Slot 2 (32 bytes)
        uint256 amount;

        // Slot 3 (32 bytes)
        bytes32 deliveryEvidenceHash;
    }

    // --- State Variables ---
    uint256 public agreementCount;
    mapping(uint256 => Agreement) private _agreements;

    /// @notice Allows a buyer to authorize autonomous agent wallets to release payments on its behalf
    mapping(address => mapping(address => bool)) public isAgentAuthorized;

    /// @dev Reentrancy lock (1 = UNLOCKED, 2 = LOCKED)
    uint8 private _reentrancyStatus;
    uint8 private constant _NOT_ENTERED = 1;
    uint8 private constant _ENTERED = 2;

    // --- Events ---
    event AgreementCreated(
        uint256 indexed agreementId,
        address indexed buyer,
        address indexed provider,
        uint256 amount,
        uint40 serviceDeadline,
        uint32 reviewDuration
    );

    event DeliverySubmitted(
        uint256 indexed agreementId,
        address indexed provider,
        bytes32 deliveryEvidenceHash,
        uint40 deliveryTimestamp,
        uint40 reviewDeadline
    );

    event PaymentReleased(
        uint256 indexed agreementId,
        address indexed provider,
        uint256 amount,
        address indexed releasedBy
    );

    event SettlementFinalized(
        uint256 indexed agreementId,
        address indexed provider,
        uint256 amount,
        address indexed finalizedBy
    );

    event RefundIssued(
        uint256 indexed agreementId,
        address indexed buyer,
        uint256 amount,
        address indexed refundedBy
    );

    event AgentAuthorizationUpdated(
        address indexed buyer,
        address indexed agent,
        bool authorized
    );

    // --- Modifiers ---
    modifier nonReentrant() {
        if (_reentrancyStatus == _ENTERED) revert ReentrancyGuardLocked();
        _reentrancyStatus = _ENTERED;
        _;
        _reentrancyStatus = _NOT_ENTERED;
    }

    constructor() {
        _reentrancyStatus = _NOT_ENTERED;
    }

    /**
     * @notice Creates an agreement and locks native BOT in escrow in a single atomic transaction.
     * @param provider The service provider address who will perform the work.
     * @param serviceDeadline Unix timestamp before which provider must submit delivery evidence.
     * @param reviewDuration Window in seconds granted to buyer to review delivery before permissionless finalization.
     * @return agreementId The unique identifier of the created agreement.
     */
    function createAndFund(
        address provider,
        uint40 serviceDeadline,
        uint32 reviewDuration
    ) external payable returns (uint256 agreementId) {
        if (provider == address(0)) revert InvalidProvider();
        if (provider == msg.sender) revert SelfPaymentNotAllowed();
        if (msg.value == 0) revert ZeroValuePayment();
        if (serviceDeadline <= block.timestamp) revert InvalidServiceDeadline();
        if (reviewDuration == 0 || reviewDuration > 30 days) revert InvalidReviewDuration();

        unchecked {
            agreementId = ++agreementCount;
        }

        Agreement storage ag = _agreements[agreementId];
        ag.buyer = msg.sender;
        ag.provider = provider;
        ag.amount = msg.value;
        ag.serviceDeadline = serviceDeadline;
        ag.reviewDuration = reviewDuration;
        ag.status = AgreementStatus.Funded;

        emit AgreementCreated(
            agreementId,
            msg.sender,
            provider,
            msg.value,
            serviceDeadline,
            reviewDuration
        );
    }

    /**
     * @notice Submits cryptographic delivery evidence for an agreement.
     * @dev Only callable by the designated provider before the service deadline has passed.
     * @param agreementId The ID of the agreement.
     * @param deliveryEvidenceHash Hash of the off-chain result/payload/deliverable.
     */
    function submitDelivery(
        uint256 agreementId,
        bytes32 deliveryEvidenceHash
    ) external {
        Agreement storage ag = _agreements[agreementId];
        if (ag.status != AgreementStatus.Funded) {
            revert InvalidState(ag.status, AgreementStatus.Funded);
        }
        if (msg.sender != ag.provider) revert Unauthorized();
        if (block.timestamp > ag.serviceDeadline) {
            revert ServiceDeadlinePassed(ag.serviceDeadline, uint40(block.timestamp));
        }
        if (deliveryEvidenceHash == bytes32(0)) revert EmptyEvidenceHash();

        uint40 currentTimestamp = uint40(block.timestamp);
        uint40 rDeadline;
        unchecked {
            rDeadline = currentTimestamp + ag.reviewDuration;
        }

        ag.status = AgreementStatus.Delivered;
        ag.deliveryEvidenceHash = deliveryEvidenceHash;
        ag.deliveryTimestamp = currentTimestamp;
        ag.reviewDeadline = rDeadline;

        emit DeliverySubmitted(
            agreementId,
            msg.sender,
            deliveryEvidenceHash,
            currentTimestamp,
            rDeadline
        );
    }

    /**
     * @notice Releases escrowed payment to the service provider.
     * @dev Callable by the buyer or any agent wallet authorized by the buyer.
     *      Applies Checks-Effects-Interactions pattern and nonReentrant guard.
     * @param agreementId The ID of the agreement.
     */
    function releasePayment(uint256 agreementId) external nonReentrant {
        Agreement storage ag = _agreements[agreementId];
        if (ag.status != AgreementStatus.Delivered) {
            revert InvalidState(ag.status, AgreementStatus.Delivered);
        }

        address buyer = ag.buyer;
        if (msg.sender != buyer && !isAgentAuthorized[buyer][msg.sender]) {
            revert Unauthorized();
        }

        address provider = ag.provider;
        uint256 amount = ag.amount;

        // Effect: update state before any external interaction
        ag.status = AgreementStatus.Released;

        emit PaymentReleased(agreementId, provider, amount, msg.sender);

        // Interaction: safe native BOT transfer
        (bool success, ) = provider.call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    /**
     * @notice Permissionlessly finalizes settlement to provider after review deadline expires.
     * @dev Ensures provider receives payment even if buyer becomes unresponsive.
     *      Checks-Effects-Interactions and nonReentrant guard applied.
     * @param agreementId The ID of the agreement.
     */
    function finalizeAfterReview(uint256 agreementId) external nonReentrant {
        Agreement storage ag = _agreements[agreementId];
        if (ag.status != AgreementStatus.Delivered) {
            revert InvalidState(ag.status, AgreementStatus.Delivered);
        }
        if (block.timestamp <= ag.reviewDeadline) {
            revert ReviewWindowNotClosed(ag.reviewDeadline, uint40(block.timestamp));
        }

        address provider = ag.provider;
        uint256 amount = ag.amount;

        // Effect: mark as released before sending funds
        ag.status = AgreementStatus.Released;

        emit SettlementFinalized(agreementId, provider, amount, msg.sender);

        // Interaction: transfer native BOT to provider
        (bool success, ) = provider.call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    /**
     * @notice Refunds locked payment back to buyer if provider failed to deliver before service deadline.
     * @dev Only callable by the buyer (or authorized agent) after service deadline if delivery was never submitted.
     *      Checks-Effects-Interactions and nonReentrant guard applied.
     * @param agreementId The ID of the agreement.
     */
    function refundUndelivered(uint256 agreementId) external nonReentrant {
        Agreement storage ag = _agreements[agreementId];
        if (ag.status != AgreementStatus.Funded) {
            revert InvalidState(ag.status, AgreementStatus.Funded);
        }

        address buyer = ag.buyer;
        if (msg.sender != buyer && !isAgentAuthorized[buyer][msg.sender]) {
            revert Unauthorized();
        }
        if (block.timestamp <= ag.serviceDeadline) {
            revert ServiceDeadlineNotPassed(ag.serviceDeadline, uint40(block.timestamp));
        }

        uint256 amount = ag.amount;

        // Effect: mark as refunded before sending funds
        ag.status = AgreementStatus.Refunded;

        emit RefundIssued(agreementId, buyer, amount, msg.sender);

        // Interaction: refund native BOT to buyer
        (bool success, ) = buyer.call{value: amount}("");
        if (!success) revert TransferFailed();
    }

    /**
     * @notice Returns the full public state of an agreement for frontend, agent SDK, and verifiers.
     * @param agreementId The ID of the agreement.
     */
    function getAgreement(uint256 agreementId) external view returns (Agreement memory) {
        if (agreementId == 0 || agreementId > agreementCount) revert AgreementNotFound();
        return _agreements[agreementId];
    }

    /**
     * @notice Sets or revokes an autonomous agent wallet's authorization to manage buyer escrows.
     * @param agent Address of the automated agent wallet.
     * @param authorized True to authorize, false to revoke.
     */
    function setAgentAuthorization(address agent, bool authorized) external {
        if (agent == address(0)) revert InvalidProvider();
        isAgentAuthorized[msg.sender][agent] = authorized;
        emit AgentAuthorizationUpdated(msg.sender, agent, authorized);
    }

    /**
     * @notice Reject unsolicited direct native BOT deposits.
     */
    receive() external payable {
        revert DirectDepositNotAllowed();
    }

    /**
     * @notice Reject unsolicited calls.
     */
    fallback() external payable {
        revert DirectDepositNotAllowed();
    }
}
