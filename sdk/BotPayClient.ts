import { ethers } from "ethers";

export interface AgreementState {
  id: bigint;
  buyer: string;
  provider: string;
  amount: bigint;
  amountFormatted: string;
  serviceDeadline: number;
  deliveryTimestamp: number;
  reviewDeadline: number;
  reviewDuration: number;
  deliveryEvidenceHash: string;
  status: AgreementStatus;
  statusLabel: string;
}

export enum AgreementStatus {
  None = 0,
  Funded = 1,
  Delivered = 2,
  Released = 3,
  Refunded = 4,
}

export const STATUS_LABELS: Record<AgreementStatus, string> = {
  [AgreementStatus.None]: "None",
  [AgreementStatus.Funded]: "Funded",
  [AgreementStatus.Delivered]: "Delivered",
  [AgreementStatus.Released]: "Released",
  [AgreementStatus.Refunded]: "Refunded",
};

export interface CreatePaymentParams {
  provider: string;
  serviceDeadlineUnix: number;
  reviewDurationSeconds: number;
  amountBot: string;
}

export interface BotPayConfig {
  contractAddress: string;
  rpcUrl?: string;
  signerOrProvider?: ethers.Signer | ethers.Provider;
}

export const BOT_CHAIN_MAINNET_PARAMS = {
  chainId: 677,
  chainName: "BOT Chain Mainnet",
  nativeCurrency: {
    name: "BOT",
    symbol: "BOT",
    decimals: 18,
  },
  rpcUrls: ["https://rpc.botchain.ai"],
  blockExplorerUrls: ["https://scan.botchain.ai"],
};

export const BOT_PAY_ABI = [
  "function agreementCount() external view returns (uint256)",
  "function createAndFund(address provider, uint40 serviceDeadline, uint32 reviewDuration) external payable returns (uint256)",
  "function submitDelivery(uint256 agreementId, bytes32 deliveryEvidenceHash) external",
  "function releasePayment(uint256 agreementId) external",
  "function finalizeAfterReview(uint256 agreementId) external",
  "function refundUndelivered(uint256 agreementId) external",
  "function getAgreement(uint256 agreementId) external view returns (tuple(address buyer, uint8 status, uint40 serviceDeadline, uint32 reviewDuration, address provider, uint40 deliveryTimestamp, uint40 reviewDeadline, uint256 amount, bytes32 deliveryEvidenceHash))",
  "function isAgentAuthorized(address buyer, address agent) external view returns (bool)",
  "function setAgentAuthorization(address agent, bool authorized) external",
  "event AgreementCreated(uint256 indexed agreementId, address indexed buyer, address indexed provider, uint256 amount, uint40 serviceDeadline, uint32 reviewDuration)",
  "event DeliverySubmitted(uint256 indexed agreementId, address indexed provider, bytes32 deliveryEvidenceHash, uint40 deliveryTimestamp, uint40 reviewDeadline)",
  "event PaymentReleased(uint256 indexed agreementId, address indexed provider, uint256 amount, address indexed releasedBy)",
  "event SettlementFinalized(uint256 indexed agreementId, address indexed provider, uint256 amount, address indexed finalizedBy)",
  "event RefundIssued(uint256 indexed agreementId, address indexed buyer, uint256 amount, address indexed refundedBy)",
];

export class BotPayClient {
  public readonly contract: ethers.Contract;
  public readonly provider: ethers.Provider;
  public readonly signer?: ethers.Signer;

  constructor(config: BotPayConfig) {
    if (config.signerOrProvider) {
      if ("provider" in config.signerOrProvider && config.signerOrProvider.provider) {
        this.signer = config.signerOrProvider as ethers.Signer;
        this.provider = this.signer.provider!;
      } else {
        this.provider = config.signerOrProvider as ethers.Provider;
      }
    } else {
      this.provider = new ethers.JsonRpcProvider(config.rpcUrl || BOT_CHAIN_MAINNET_PARAMS.rpcUrls[0]);
    }

    this.contract = new ethers.Contract(
      config.contractAddress,
      BOT_PAY_ABI,
      this.signer || this.provider
    );
  }

  /**
   * Reads an agreement's full on-chain state by ID.
   */
  async getAgreement(agreementId: bigint | number): Promise<AgreementState> {
    const raw = await this.contract.getAgreement(agreementId);
    const statusNum = Number(raw.status) as AgreementStatus;
    return {
      id: BigInt(agreementId),
      buyer: raw.buyer,
      provider: raw.provider,
      amount: raw.amount,
      amountFormatted: ethers.formatEther(raw.amount),
      serviceDeadline: Number(raw.serviceDeadline),
      deliveryTimestamp: Number(raw.deliveryTimestamp),
      reviewDeadline: Number(raw.reviewDeadline),
      reviewDuration: Number(raw.reviewDuration),
      deliveryEvidenceHash: raw.deliveryEvidenceHash,
      status: statusNum,
      statusLabel: STATUS_LABELS[statusNum] || "Unknown",
    };
  }

  /**
   * Returns the total number of agreements created on-chain.
   */
  async getAgreementCount(): Promise<bigint> {
    return await this.contract.agreementCount();
  }

  /**
   * Creates and funds an agreement with native BOT.
   */
  async createServicePayment(params: CreatePaymentParams): Promise<{ agreementId: bigint; txHash: string }> {
    if (!this.signer) throw new Error("A signer is required to create a service payment.");
    if (!ethers.isAddress(params.provider)) throw new Error("Invalid provider address.");
    if (params.serviceDeadlineUnix <= Math.floor(Date.now() / 1000)) {
      throw new Error("Service deadline must be in the future.");
    }
    if (params.reviewDurationSeconds <= 0 || params.reviewDurationSeconds > 30 * 86400) {
      throw new Error("Review duration must be between 1 second and 30 days.");
    }

    const valueWei = ethers.parseEther(params.amountBot);
    if (valueWei <= 0n) throw new Error("Payment amount must be greater than zero.");

    const tx = await this.contract.createAndFund(
      params.provider,
      params.serviceDeadlineUnix,
      params.reviewDurationSeconds,
      { value: valueWei }
    );

    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error("createAndFund transaction failed.");

    // Parse AgreementCreated event
    let createdId = 0n;
    for (const log of receipt.logs) {
      try {
        const parsed = this.contract.interface.parseLog({ topics: log.topics as string[], data: log.data });
        if (parsed?.name === "AgreementCreated") {
          createdId = parsed.args[0];
          break;
        }
      } catch {
        // ignore non-contract logs
      }
    }

    return { agreementId: createdId, txHash: receipt.hash };
  }

  /**
   * Submits cryptographic delivery evidence for an agreement.
   */
  async submitDelivery(agreementId: bigint | number, evidenceHash: string): Promise<string> {
    if (!this.signer) throw new Error("A signer is required to submit delivery.");
    if (!evidenceHash.startsWith("0x") || evidenceHash.length !== 66) {
      throw new Error("Evidence hash must be a valid 32-byte hex string (0x...).");
    }

    const tx = await this.contract.submitDelivery(agreementId, evidenceHash);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error("submitDelivery transaction failed.");
    return receipt.hash;
  }

  /**
   * Releases payment to the service provider.
   */
  async releasePayment(agreementId: bigint | number): Promise<string> {
    if (!this.signer) throw new Error("A signer is required to release payment.");
    const tx = await this.contract.releasePayment(agreementId);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error("releasePayment transaction failed.");
    return receipt.hash;
  }

  /**
   * Permissionlessly finalizes settlement to provider after review deadline.
   */
  async finalizeAfterReview(agreementId: bigint | number): Promise<string> {
    if (!this.signer) throw new Error("A signer is required to finalize settlement.");
    const tx = await this.contract.finalizeAfterReview(agreementId);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error("finalizeAfterReview transaction failed.");
    return receipt.hash;
  }

  /**
   * Refunds undelivered escrow back to buyer after service deadline.
   */
  async refundUndelivered(agreementId: bigint | number): Promise<string> {
    if (!this.signer) throw new Error("A signer is required to claim an undelivered refund.");
    const tx = await this.contract.refundUndelivered(agreementId);
    const receipt = await tx.wait();
    if (!receipt || receipt.status !== 1) throw new Error("refundUndelivered transaction failed.");
    return receipt.hash;
  }

  /**
   * Helper to hash an arbitrary off-chain payload into a bytes32 evidence reference.
   */
  static hashPayload(payload: string | Uint8Array): string {
    if (typeof payload === "string") {
      return ethers.keccak256(ethers.toUtf8Bytes(payload));
    }
    return ethers.keccak256(payload);
  }
}
