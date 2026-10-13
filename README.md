# BotPay — Machine-to-Machine Payment Protocol

BotPay is a production-grade, security-conscious, gas-optimized machine-to-machine payment protocol built for autonomous AI agents and services on **BOT Chain Mainnet**.

It enforces a decentralized native escrow agreement supporting the autonomous service lifecycle:
$$\text{REQUEST} \longrightarrow \text{QUOTE/TERMS} \longrightarrow \text{FUND} \longrightarrow \text{DELIVER} \longrightarrow \text{VERIFY/ACCEPT} \longrightarrow \text{SETTLE}$$

Without human checkout flows, ERC-20 token approval transactions, admin backdoors, or upgrade proxies.

---

## BOT Chain Mainnet Deployment

- **Network:** BOT Chain Mainnet
- **Chain ID:** `677`
- **RPC URL:** [`https://rpc.botchain.ai`](https://rpc.botchain.ai)
- **Explorer:** [`https://scan.botchain.ai`](https://scan.botchain.ai)
- **Contract Name:** `BotPayEscrow`
- **Contract Address:** [`0x2d25345ff92C85E00E83c8ce1798f0CD66f6DCCA`](https://scan.botchain.ai/address/0x2d25345ff92C85E00E83c8ce1798f0CD66f6DCCA)
- **Deployment Transaction:** [`0xf9a7f180e3b9d7d42df17746d50f6a47384394ab25ff9e10569f62bb02fbadbd`](https://scan.botchain.ai/tx/0xf9a7f180e3b9d7d42df17746d50f6a47384394ab25ff9e10569f62bb02fbadbd)
- **Block Confirmed:** `26552707`
- **Bytecode on-chain:** Verified 3,888 bytes runtime code

---

## Protocol Lifecycle

1. **Agent A (Buyer) requests a service** and initiates an escrow agreement on-chain via `createAndFund()`. Native BOT is locked in escrow atomically.
2. **Agent B (Provider) executes the service** (API response, compute workload, data stream) and submits a cryptographic delivery evidence hash via `submitDelivery()`.
3. **Review Window Begins:** Once delivery is submitted, Agent A has a pre-agreed review duration (e.g., 2 hours).
4. **Settlement Flow:**
   - **Explicit Release:** Agent A (or its authorized agent wallet) calls `releasePayment()` to release funds to the provider.
   - **Permissionless Finalization:** If Agent A becomes unresponsive and fails to release payment before the review deadline expires, `finalizeAfterReview()` can be called permissionlessly by anyone to transfer payment to the provider.
   - **Undelivered Refund:** If the provider fails to submit delivery before the service deadline, Agent A can claim a full refund via `refundUndelivered()`.

---

## Gas Benchmarks

Measurements conducted on local EVM environment (Solidity 0.8.24, optimizer runs: 200):

| Operation | Gas Used | Estimated Cost @ 20 gwei |
|:---|:---:|:---:|
| **Contract Deployment** | **915,714** | ~0.01831 BOT |
| **createAndFund (subsequent)** | **96,984** | ~0.00194 BOT |
| **submitDelivery** | **57,307** | ~0.00115 BOT |
| **releasePayment** | **45,414** | ~0.00091 BOT |
| **finalizeAfterReview** | **45,383** | ~0.00091 BOT |
| **refundUndelivered** | **40,918** | ~0.00082 BOT |

---

## Automated Test Suite

BotPay features a comprehensive 28-test suite covering functional, authorization, adversarial, reentrancy, and solvency invariants:

```bash
# Run automated tests
npx hardhat test

# Run gas benchmarking
npm run benchmark
```

Test Results: **28 passed (100% pass rate)**:
- 6 Functional Creation & Funding tests
- 5 Provider Delivery Submission tests
- 4 Payment Release & Authorized Agent tests
- 3 Permissionless Finalization tests
- 5 Undelivered Refund Lifecycle tests
- 5 Adversarial & Reentrancy tests (ReentrantAttacker & MaliciousRecipient)

---

## Agent TypeScript SDK

A typed TypeScript SDK is provided in `sdk/BotPayClient.ts` for autonomous machine-to-machine integration:

```typescript
import { BotPayClient } from "./sdk/BotPayClient";
import { ethers } from "ethers";

const provider = new ethers.JsonRpcProvider("https://rpc.botchain.ai");
const agentSigner = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY!, provider);

const client = new BotPayClient({
  contractAddress: "0x2d25345ff92C85E00E83c8ce1798f0CD66f6DCCA",
  signerOrProvider: agentSigner,
});

// 1. Create and fund escrow
const { agreementId, txHash } = await client.createServicePayment({
  provider: "0xProviderAddress...",
  serviceDeadlineUnix: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  reviewDurationSeconds: 7200, // 2 hours
  amountBot: "0.01",
});

// 2. Provider submits deliverable hash
const evidenceHash = BotPayClient.hashPayload(JSON.stringify({ result: "computed-dataset-root" }));
await client.submitDelivery(agreementId, evidenceHash);

// 3. Buyer verifies and releases payment
await client.releasePayment(agreementId);
```

---

## Frontend Application

The Bolt-exported frontend preserves the Bendore-inspired editorial dark aesthetic:
- Near-black `#111111` backgrounds, secondary black `#171717`.
- Mint `#D7F5D0`, pale blue `#CDEBFA`, lavender `#E8C7F5`, pale yellow `#F4EDB0` accents.
- Direct live connection to `BotPayEscrow` at `0x2d25345ff92C85E00E83c8ce1798f0CD66f6DCCA` on BOT Chain Mainnet (Chain ID 677).
- One-click wallet connection and BOT Chain network switching.
- Interactive agreement creation and live operational dashboard.
- Footer with clickable text links to official **Botchain** (`https://botchain.ai`) and **botscan** (`https://scan.botchain.ai`).

### Running the Frontend Locally

```bash
cd "Botpay Frontend"
npm run build
npm run dev
```

---

## Documentation Index

- [CONTRACT_DESIGN.md](file:///c:/Users/Goodness/Desktop/Projects/BotPay/CONTRACT_DESIGN.md): Detailed state machine, storage packing, and interface specifications.
- [SECURITY.md](file:///c:/Users/Goodness/Desktop/Projects/BotPay/SECURITY.md): Threat modeling, reentrancy analysis, and test invariants.
- [GAS_REPORT.md](file:///c:/Users/Goodness/Desktop/Projects/BotPay/GAS_REPORT.md): Gas optimization strategies and fee projections.
- [DEPLOYMENT.md](file:///c:/Users/Goodness/Desktop/Projects/BotPay/DEPLOYMENT.md): Mainnet verification record and deployment manifest.
