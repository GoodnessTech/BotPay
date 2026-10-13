import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { BotPayEscrow, MaliciousRecipient, ReentrantAttacker } from "../typechain-types";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

describe("BotPayEscrow — Protocol Lifecycle, Security & Invariants", function () {
  let escrow: BotPayEscrow;
  let buyer: HardhatEthersSigner;
  let provider: HardhatEthersSigner;
  let agent: HardhatEthersSigner;
  let stranger: HardhatEthersSigner;

  const sampleEvidenceHash = ethers.keccak256(ethers.toUtf8Bytes("service-payload-v1-result"));
  const ONE_DAY = 24 * 60 * 60;
  const TWO_HOURS = 2 * 60 * 60;

  beforeEach(async function () {
    [buyer, provider, agent, stranger] = await ethers.getSigners();
    const EscrowFactory = await ethers.getContractFactory("BotPayEscrow");
    escrow = await EscrowFactory.deploy();
    await escrow.waitForDeployment();
  });

  describe("Phase 1: Agreement Creation & Funding", function () {
    it("should successfully create and fund an escrow agreement in a single atomic transaction", async function () {
      const now = await time.latest();
      const serviceDeadline = now + ONE_DAY;
      const reviewDuration = TWO_HOURS;
      const amount = ethers.parseEther("1.5");

      const tx = await escrow.connect(buyer).createAndFund(
        provider.address,
        serviceDeadline,
        reviewDuration,
        { value: amount }
      );

      await expect(tx)
        .to.emit(escrow, "AgreementCreated")
        .withArgs(1, buyer.address, provider.address, amount, serviceDeadline, reviewDuration);

      expect(await escrow.agreementCount()).to.equal(1);

      const ag = await escrow.getAgreement(1);
      expect(ag.buyer).to.equal(buyer.address);
      expect(ag.provider).to.equal(provider.address);
      expect(ag.amount).to.equal(amount);
      expect(ag.serviceDeadline).to.equal(serviceDeadline);
      expect(ag.reviewDuration).to.equal(reviewDuration);
      expect(ag.status).to.equal(1); // Funded
      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(amount);
    });

    it("should reject zero-value funding", async function () {
      const now = await time.latest();
      await expect(
        escrow.connect(buyer).createAndFund(provider.address, now + ONE_DAY, TWO_HOURS, { value: 0 })
      ).to.be.revertedWithCustomError(escrow, "ZeroValuePayment");
    });

    it("should reject self-payment", async function () {
      const now = await time.latest();
      await expect(
        escrow.connect(buyer).createAndFund(buyer.address, now + ONE_DAY, TWO_HOURS, { value: ethers.parseEther("1.0") })
      ).to.be.revertedWithCustomError(escrow, "SelfPaymentNotAllowed");
    });

    it("should reject zero address provider", async function () {
      const now = await time.latest();
      await expect(
        escrow.connect(buyer).createAndFund(ethers.ZeroAddress, now + ONE_DAY, TWO_HOURS, { value: ethers.parseEther("1.0") })
      ).to.be.revertedWithCustomError(escrow, "InvalidProvider");
    });

    it("should reject expired or invalid service deadlines", async function () {
      const now = await time.latest();
      await expect(
        escrow.connect(buyer).createAndFund(provider.address, now - 10, TWO_HOURS, { value: ethers.parseEther("1.0") })
      ).to.be.revertedWithCustomError(escrow, "InvalidServiceDeadline");
    });

    it("should reject invalid review duration (0 or > 30 days)", async function () {
      const now = await time.latest();
      await expect(
        escrow.connect(buyer).createAndFund(provider.address, now + ONE_DAY, 0, { value: ethers.parseEther("1.0") })
      ).to.be.revertedWithCustomError(escrow, "InvalidReviewDuration");

      await expect(
        escrow.connect(buyer).createAndFund(provider.address, now + ONE_DAY, 31 * ONE_DAY, { value: ethers.parseEther("1.0") })
      ).to.be.revertedWithCustomError(escrow, "InvalidReviewDuration");
    });
  });

  describe("Phase 2: Service Delivery Submission", function () {
    let serviceDeadline: number;
    let reviewDuration: number;
    const amount = ethers.parseEther("2.0");

    beforeEach(async function () {
      const now = await time.latest();
      serviceDeadline = now + ONE_DAY;
      reviewDuration = TWO_HOURS;
      await escrow.connect(buyer).createAndFund(provider.address, serviceDeadline, reviewDuration, { value: amount });
    });

    it("should allow designated provider to submit delivery evidence before service deadline", async function () {
      const tx = await escrow.connect(provider).submitDelivery(1, sampleEvidenceHash);
      const deliveryBlock = await ethers.provider.getBlock(tx.blockNumber!);
      const deliveryTimestamp = deliveryBlock!.timestamp;
      const expectedReviewDeadline = deliveryTimestamp + reviewDuration;

      await expect(tx)
        .to.emit(escrow, "DeliverySubmitted")
        .withArgs(1, provider.address, sampleEvidenceHash, deliveryTimestamp, expectedReviewDeadline);

      const ag = await escrow.getAgreement(1);
      expect(ag.status).to.equal(2); // Delivered
      expect(ag.deliveryEvidenceHash).to.equal(sampleEvidenceHash);
      expect(ag.deliveryTimestamp).to.equal(deliveryTimestamp);
      expect(ag.reviewDeadline).to.equal(expectedReviewDeadline);
    });

    it("should reject delivery from non-provider address", async function () {
      await expect(
        escrow.connect(stranger).submitDelivery(1, sampleEvidenceHash)
      ).to.be.revertedWithCustomError(escrow, "Unauthorized");

      await expect(
        escrow.connect(buyer).submitDelivery(1, sampleEvidenceHash)
      ).to.be.revertedWithCustomError(escrow, "Unauthorized");
    });

    it("should reject delivery with empty evidence hash", async function () {
      await expect(
        escrow.connect(provider).submitDelivery(1, ethers.ZeroHash)
      ).to.be.revertedWithCustomError(escrow, "EmptyEvidenceHash");
    });

    it("should reject delivery after service deadline has passed", async function () {
      await time.increaseTo(serviceDeadline + 10);
      await expect(
        escrow.connect(provider).submitDelivery(1, sampleEvidenceHash)
      ).to.be.revertedWithCustomError(escrow, "ServiceDeadlinePassed");
    });

    it("should reject duplicate delivery submission", async function () {
      await escrow.connect(provider).submitDelivery(1, sampleEvidenceHash);
      await expect(
        escrow.connect(provider).submitDelivery(1, sampleEvidenceHash)
      ).to.be.revertedWithCustomError(escrow, "InvalidState");
    });
  });

  describe("Phase 3: Buyer & Agent Payment Release", function () {
    const amount = ethers.parseEther("1.0");

    beforeEach(async function () {
      const now = await time.latest();
      await escrow.connect(buyer).createAndFund(provider.address, now + ONE_DAY, TWO_HOURS, { value: amount });
      await escrow.connect(provider).submitDelivery(1, sampleEvidenceHash);
    });

    it("should allow buyer to explicitly release payment to provider", async function () {
      const providerBalBefore = await ethers.provider.getBalance(provider.address);
      const tx = await escrow.connect(buyer).releasePayment(1);

      await expect(tx)
        .to.emit(escrow, "PaymentReleased")
        .withArgs(1, provider.address, amount, buyer.address);

      const ag = await escrow.getAgreement(1);
      expect(ag.status).to.equal(3); // Released

      const providerBalAfter = await ethers.provider.getBalance(provider.address);
      expect(providerBalAfter - providerBalBefore).to.equal(amount);
      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(0);
    });

    it("should allow authorized agent wallet to release payment", async function () {
      await expect(escrow.connect(buyer).setAgentAuthorization(agent.address, true))
        .to.emit(escrow, "AgentAuthorizationUpdated")
        .withArgs(buyer.address, agent.address, true);

      expect(await escrow.isAgentAuthorized(buyer.address, agent.address)).to.be.true;

      const providerBalBefore = await ethers.provider.getBalance(provider.address);
      await escrow.connect(agent).releasePayment(1);

      const ag = await escrow.getAgreement(1);
      expect(ag.status).to.equal(3); // Released

      const providerBalAfter = await ethers.provider.getBalance(provider.address);
      expect(providerBalAfter - providerBalBefore).to.equal(amount);
    });

    it("should reject payment release from unauthorized stranger or revoked agent", async function () {
      await expect(
        escrow.connect(stranger).releasePayment(1)
      ).to.be.revertedWithCustomError(escrow, "Unauthorized");

      // Authorize then revoke
      await escrow.connect(buyer).setAgentAuthorization(agent.address, true);
      await escrow.connect(buyer).setAgentAuthorization(agent.address, false);

      await expect(
        escrow.connect(agent).releasePayment(1)
      ).to.be.revertedWithCustomError(escrow, "Unauthorized");
    });

    it("should prevent double release", async function () {
      await escrow.connect(buyer).releasePayment(1);
      await expect(
        escrow.connect(buyer).releasePayment(1)
      ).to.be.revertedWithCustomError(escrow, "InvalidState");
    });
  });

  describe("Phase 4: Permissionless Finalization After Review Window", function () {
    const amount = ethers.parseEther("0.75");

    beforeEach(async function () {
      const now = await time.latest();
      await escrow.connect(buyer).createAndFund(provider.address, now + ONE_DAY, TWO_HOURS, { value: amount });
      await escrow.connect(provider).submitDelivery(1, sampleEvidenceHash);
    });

    it("should reject finalization before review deadline has expired", async function () {
      await expect(
        escrow.connect(stranger).finalizeAfterReview(1)
      ).to.be.revertedWithCustomError(escrow, "ReviewWindowNotClosed");
    });

    it("should allow any caller to finalize settlement after review window expires", async function () {
      const ag = await escrow.getAgreement(1);
      await time.increaseTo(Number(ag.reviewDeadline) + 1);

      const providerBalBefore = await ethers.provider.getBalance(provider.address);
      const tx = await escrow.connect(stranger).finalizeAfterReview(1);

      await expect(tx)
        .to.emit(escrow, "SettlementFinalized")
        .withArgs(1, provider.address, amount, stranger.address);

      const agAfter = await escrow.getAgreement(1);
      expect(agAfter.status).to.equal(3); // Released

      const providerBalAfter = await ethers.provider.getBalance(provider.address);
      expect(providerBalAfter - providerBalBefore).to.equal(amount);
    });

    it("should prevent finalization after agreement was already released", async function () {
      await escrow.connect(buyer).releasePayment(1);

      const ag = await escrow.getAgreement(1);
      await time.increaseTo(Number(ag.reviewDeadline) + 1);

      await expect(
        escrow.connect(stranger).finalizeAfterReview(1)
      ).to.be.revertedWithCustomError(escrow, "InvalidState");
    });
  });

  describe("Phase 5: Undelivered Refund Lifecycle", function () {
    let serviceDeadline: number;
    const amount = ethers.parseEther("3.0");

    beforeEach(async function () {
      const now = await time.latest();
      serviceDeadline = now + ONE_DAY;
      await escrow.connect(buyer).createAndFund(provider.address, serviceDeadline, TWO_HOURS, { value: amount });
    });

    it("should reject refund before service deadline expires", async function () {
      await expect(
        escrow.connect(buyer).refundUndelivered(1)
      ).to.be.revertedWithCustomError(escrow, "ServiceDeadlineNotPassed");
    });

    it("should allow buyer to claim full refund after service deadline expires if delivery was never submitted", async function () {
      await time.increaseTo(serviceDeadline + 1);

      const buyerBalBefore = await ethers.provider.getBalance(buyer.address);
      const tx = await escrow.connect(buyer).refundUndelivered(1);
      const receipt = await tx.wait();
      const gasCost = receipt!.gasUsed * receipt!.gasPrice;

      await expect(tx)
        .to.emit(escrow, "RefundIssued")
        .withArgs(1, buyer.address, amount, buyer.address);

      const ag = await escrow.getAgreement(1);
      expect(ag.status).to.equal(4); // Refunded

      const buyerBalAfter = await ethers.provider.getBalance(buyer.address);
      expect(buyerBalAfter).to.equal(buyerBalBefore + amount - gasCost);
      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(0);
    });

    it("should reject refund from unauthorized parties or provider", async function () {
      await time.increaseTo(serviceDeadline + 1);

      await expect(
        escrow.connect(stranger).refundUndelivered(1)
      ).to.be.revertedWithCustomError(escrow, "Unauthorized");

      await expect(
        escrow.connect(provider).refundUndelivered(1)
      ).to.be.revertedWithCustomError(escrow, "Unauthorized");
    });

    it("should reject refund once delivery has already been submitted", async function () {
      await escrow.connect(provider).submitDelivery(1, sampleEvidenceHash);
      await time.increaseTo(serviceDeadline + 1);

      await expect(
        escrow.connect(buyer).refundUndelivered(1)
      ).to.be.revertedWithCustomError(escrow, "InvalidState");
    });

    it("should prevent double refund", async function () {
      await time.increaseTo(serviceDeadline + 1);
      await escrow.connect(buyer).refundUndelivered(1);

      await expect(
        escrow.connect(buyer).refundUndelivered(1)
      ).to.be.revertedWithCustomError(escrow, "InvalidState");
    });
  });

  describe("Phase 6: Adversarial & Reentrancy Protections", function () {
    it("should reject direct native BOT deposits through receive() or fallback()", async function () {
      await expect(
        buyer.sendTransaction({ to: await escrow.getAddress(), value: ethers.parseEther("0.1") })
      ).to.be.revertedWithCustomError(escrow, "DirectDepositNotAllowed");
    });

    it("should handle failed native BOT transfer safely and revert without corrupting agreement state", async function () {
      const MaliciousFactory = await ethers.getContractFactory("MaliciousRecipient");
      const malicious = await MaliciousFactory.deploy(await escrow.getAddress());
      await malicious.waitForDeployment();

      const now = await time.latest();
      await escrow.connect(buyer).createAndFund(
        await malicious.getAddress(),
        now + ONE_DAY,
        TWO_HOURS,
        { value: ethers.parseEther("1.0") }
      );

      // Provider contract submits delivery
      await malicious.submitDelivery(1, sampleEvidenceHash);

      // Malicious contract will revert in receive()
      await expect(
        escrow.connect(buyer).releasePayment(1)
      ).to.be.revertedWithCustomError(escrow, "TransferFailed");

      // Agreement status must remain Delivered, funds remain intact in escrow
      const ag = await escrow.getAgreement(1);
      expect(ag.status).to.equal(2); // Still Delivered
      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(ethers.parseEther("1.0"));

      // Now set malicious to accept payment
      await malicious.setShouldRevert(false);
      await escrow.connect(buyer).releasePayment(1);

      const agAfter = await escrow.getAgreement(1);
      expect(agAfter.status).to.equal(3); // Released
      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(0);
    });

    it("should prevent reentrancy during payment release", async function () {
      const ReentrantFactory = await ethers.getContractFactory("ReentrantAttacker");
      const attacker = await ReentrantFactory.deploy(await escrow.getAddress());
      await attacker.waitForDeployment();

      const now = await time.latest();
      await escrow.connect(buyer).createAndFund(
        await attacker.getAddress(),
        now + ONE_DAY,
        TWO_HOURS,
        { value: ethers.parseEther("1.0") }
      );

      await attacker.submitDelivery(1, sampleEvidenceHash);
      await attacker.setAttack(1, 1); // AttackType.Release

      // When buyer calls releasePayment, attacker receives ETH and tries to call releasePayment again
      // Due to Checks-Effects-Interactions, status is already Released (InvalidState) and nonReentrant guard is locked
      // So the reentrant call fails, which causes the transfer or release to cleanly handle it
      await expect(
        escrow.connect(buyer).releasePayment(1)
      ).to.be.reverted; // Reverts because reentrant call failed
    });

    it("should maintain strict solvency across multiple interleaved agreements", async function () {
      const now = await time.latest();
      const amt1 = ethers.parseEther("1.0");
      const amt2 = ethers.parseEther("2.5");
      const amt3 = ethers.parseEther("0.5");

      await escrow.connect(buyer).createAndFund(provider.address, now + ONE_DAY, TWO_HOURS, { value: amt1 });
      await escrow.connect(buyer).createAndFund(stranger.address, now + ONE_DAY, TWO_HOURS, { value: amt2 });
      await escrow.connect(provider).createAndFund(buyer.address, now + 2 * ONE_DAY, TWO_HOURS, { value: amt3 });

      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(amt1 + amt2 + amt3);

      // Settle agreement 2 (provider stranger delivers, buyer releases)
      await escrow.connect(stranger).submitDelivery(2, sampleEvidenceHash);
      await escrow.connect(buyer).releasePayment(2);
      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(amt1 + amt3);

      // Refund agreement 1 after deadline
      await time.increaseTo(now + ONE_DAY + 1);
      await escrow.connect(buyer).refundUndelivered(1);
      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(amt3);

      // Agreement 3 is delivered and finalized
      await escrow.connect(buyer).submitDelivery(3, sampleEvidenceHash);
      const ag3 = await escrow.getAgreement(3);
      await time.increaseTo(Number(ag3.reviewDeadline) + 1);
      await escrow.connect(stranger).finalizeAfterReview(3);
      expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(0);
    });

    it("should verify invalid agreement IDs revert with AgreementNotFound", async function () {
      await expect(escrow.getAgreement(0)).to.be.revertedWithCustomError(escrow, "AgreementNotFound");
      await expect(escrow.getAgreement(999)).to.be.revertedWithCustomError(escrow, "AgreementNotFound");
    });
  });
});
