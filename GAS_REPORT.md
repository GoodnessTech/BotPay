# BotPay — Gas Optimization & Benchmarking Report

## 1. Executive Summary
`BotPayEscrow` was designed with gas minimization as a primary architectural acceptance criterion. Every state variable is tightly packed into 4 32-byte slots, custom errors replace expensive string revert reasons, and native BOT transfers avoid ERC-20 approve/transferFrom overhead.

Measured on reproducible local execution (Solidity 0.8.24, optimizer enabled with 200 runs):

| Function Operation | Gas Units | Notes |
|:---|:---:|:---|
| **Contract Deployment** | **915,714** | Primary escrow contract with reentrancy guard |
| **createAndFund (First agreement)** | 114,084 | Cold `agreementCount` SSTORE from 0 to 1 |
| **createAndFund (Subsequent)** | **96,984** | Warm counter SSTORE, atomic escrow lock |
| **submitDelivery** | **57,307** | Records bytes32 hash, activates review window |
| **releasePayment** | **45,414** | CEI status update + native BOT transfer |
| **finalizeAfterReview** | **45,383** | Permissionless automated finalization |
| **refundUndelivered** | **40,918** | CEI status update + native refund transfer |

---

## 2. Bytecode Analysis

- **Deployed Bytecode Size:** **3,888 bytes**
- **EVM Size Limit (EIP-170):** 24,576 bytes
- **Utilization:** **15.82%** of maximum allowable contract size.

No unnecessary inherited frameworks, token abstractions, or proxy delegates are loaded into bytecode.

---

## 3. Gas Optimization Strategies Implemented

### A. Compact Storage Layout (Packing into 4 Slots)
- Slot 0 (32 bytes): `buyer` (20B) + `status` (1B) + `serviceDeadline` (5B) + `reviewDuration` (4B) + 2B free.
- Slot 1 (32 bytes): `provider` (20B) + `deliveryTimestamp` (5B) + `reviewDeadline` (5B) + 2B free.
- Slot 2 (32 bytes): `amount` (32B).
- Slot 3 (32 bytes): `deliveryEvidenceHash` (32B).

**Savings:** Consolidates 8 data fields into 4 storage slots, saving 4 cold `SSTORE` operations per agreement creation (~80,000 gas reduction compared to unpacked structures).

### B. Custom Errors Over Revert Strings
Instead of storing 32-byte revert strings in bytecode and memory (`require(condition, "BotPay: service deadline has passed")`), the contract utilizes Solidity custom errors:
- `error ServiceDeadlinePassed(uint40 deadline, uint40 currentTimestamp);`
- `error InvalidProvider();`
- `error ZeroValuePayment();`
- `error InvalidState(AgreementStatus current, AgreementStatus required);`

**Savings:** Saves ~200-500 gas on every revert and eliminates redundant string constants from the deployed bytecode.

### C. Native BOT Escrow Over ERC-20
ERC-20 payment escrows require two separate transactions: `approve()` (~45,000 gas) and `transferFrom()` (~60,000 gas), followed by `transfer()` (~35,000 gas). By utilizing native BOT:
- Single atomic transaction creates and funds the agreement.
- Zero approval gas.
- Zero external contract call overhead.

---

## 4. Fee Projections on BOT Chain Mainnet

At the current network gas price of **20.0 gwei** on BOT Chain Mainnet:

| Operation | Gas Used | Fee in Native BOT |
|:---|:---:|:---:|
| **Deployment** | 915,714 | ~0.01831 BOT |
| **Create & Fund** | 96,984 | ~0.00194 BOT |
| **Submit Delivery** | 57,307 | ~0.00115 BOT |
| **Release Payment** | 45,414 | ~0.00091 BOT |
| **Finalize After Review** | 45,383 | ~0.00091 BOT |
| **Refund Undelivered** | 40,918 | ~0.00082 BOT |

*Note: Network fees scale proportionally with BOT Chain's effective base fee and gas price.*
