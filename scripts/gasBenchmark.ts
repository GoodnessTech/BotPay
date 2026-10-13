import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";

async function main() {
  console.log("=================================================");
  console.log("       BotPayEscrow — Gas Benchmarking Report    ");
  console.log("=================================================");

  const [buyer, provider, stranger] = await ethers.getSigners();
  const ONE_DAY = 24 * 60 * 60;
  const TWO_HOURS = 2 * 60 * 60;
  const sampleEvidenceHash = ethers.keccak256(ethers.toUtf8Bytes("gas-benchmark-evidence-payload"));

  // 1. Deployment Gas
  const EscrowFactory = await ethers.getContractFactory("BotPayEscrow");
  const deployTx = await EscrowFactory.getDeployTransaction();
  const estimatedDeployGas = await ethers.provider.estimateGas(deployTx);
  const escrow = await EscrowFactory.deploy();
  await escrow.waitForDeployment();
  const deployReceipt = await escrow.deploymentTransaction()?.wait();
  const actualDeployGas = deployReceipt?.gasUsed;

  console.log(`1. Deployment Gas:`);
  console.log(`   Estimated: ${estimatedDeployGas.toString()} gas units`);
  console.log(`   Actual:    ${actualDeployGas?.toString()} gas units`);

  // 2. createAndFund Gas
  const now1 = await time.latest();
  const txCreate = await escrow.connect(buyer).createAndFund(
    provider.address,
    now1 + ONE_DAY,
    TWO_HOURS,
    { value: ethers.parseEther("1.0") }
  );
  const receiptCreate = await txCreate.wait();
  console.log(`2. createAndFund (first agreement / zero-to-one ID):`);
  console.log(`   Gas used:  ${receiptCreate?.gasUsed.toString()} gas units`);

  // Second create to measure non-zero agreementCount slot SSTORE
  const now2 = await time.latest();
  const txCreate2 = await escrow.connect(buyer).createAndFund(
    provider.address,
    now2 + ONE_DAY,
    TWO_HOURS,
    { value: ethers.parseEther("1.0") }
  );
  const receiptCreate2 = await txCreate2.wait();
  console.log(`   createAndFund (subsequent agreement):`);
  console.log(`   Gas used:  ${receiptCreate2?.gasUsed.toString()} gas units`);

  // 3. submitDelivery Gas
  const txDelivery = await escrow.connect(provider).submitDelivery(1, sampleEvidenceHash);
  const receiptDelivery = await txDelivery.wait();
  console.log(`3. submitDelivery:`);
  console.log(`   Gas used:  ${receiptDelivery?.gasUsed.toString()} gas units`);

  // 4. releasePayment Gas
  const txRelease = await escrow.connect(buyer).releasePayment(1);
  const receiptRelease = await txRelease.wait();
  console.log(`4. releasePayment:`);
  console.log(`   Gas used:  ${receiptRelease?.gasUsed.toString()} gas units`);

  // 5. finalizeAfterReview Gas (using agreement 2)
  await escrow.connect(provider).submitDelivery(2, sampleEvidenceHash);
  const ag2 = await escrow.getAgreement(2);
  await time.increaseTo(Number(ag2.reviewDeadline) + 1);
  const txFinalize = await escrow.connect(stranger).finalizeAfterReview(2);
  const receiptFinalize = await txFinalize.wait();
  console.log(`5. finalizeAfterReview:`);
  console.log(`   Gas used:  ${receiptFinalize?.gasUsed.toString()} gas units`);

  // 6. refundUndelivered Gas (create agreement 3, let deadline pass without delivery)
  const now3 = await time.latest();
  await escrow.connect(buyer).createAndFund(
    provider.address,
    now3 + ONE_DAY,
    TWO_HOURS,
    { value: ethers.parseEther("1.0") }
  );
  await time.increaseTo(now3 + ONE_DAY + 1);
  const txRefund = await escrow.connect(buyer).refundUndelivered(3);
  const receiptRefund = await txRefund.wait();
  console.log(`6. refundUndelivered:`);
  console.log(`   Gas used:  ${receiptRefund?.gasUsed.toString()} gas units`);

  console.log("=================================================");
  console.log("Summary Table:");
  console.log(`- Deployment:        ${actualDeployGas} gas`);
  console.log(`- createAndFund:     ${receiptCreate2?.gasUsed} gas`);
  console.log(`- submitDelivery:    ${receiptDelivery?.gasUsed} gas`);
  console.log(`- releasePayment:    ${receiptRelease?.gasUsed} gas`);
  console.log(`- finalizeAfterReview: ${receiptFinalize?.gasUsed} gas`);
  console.log(`- refundUndelivered: ${receiptRefund?.gasUsed} gas`);
  console.log("=================================================");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
