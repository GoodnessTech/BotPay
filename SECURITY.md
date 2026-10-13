# BotPay Protocol — Security Assessment & Threat Model

## 1. Security Architecture Principles

`BotPayEscrow` is architected with a minimal attack surface:
1. **Zero Privileged Roles:** No `onlyOwner`, no emergency pause keys, no upgrade proxies, and no external oracle dependencies.
2. **Native Asset Safety:** Uses native BOT transfers without ERC-20 approval/transferFrom vectors, eliminating infinite approval exploits and reentrancy through token transfer hooks.
3. **Defense-in-Depth:** Every fund release or refund applies Checks-Effects-Interactions (CEI) alongside a reentrancy guard (`_reentrancyStatus`).
4. **Storage Packing & Bounds Checking:** All timestamps and durations are validated and stored in `uint40` / `uint32` types preventing overflow/underflow while rejecting unrealistic deadlines (> 30 days review).

---

## 2. Threat Analysis & Mitigations

### 2.1 Reentrancy & Double-Spend Attacks
- **Threat:** A malicious smart-contract provider or buyer attempts to reenter `releasePayment`, `finalizeAfterReview`, or `refundUndelivered` in a `receive()` or fallback hook to extract funds repeatedly.
- **Mitigation:**
  - `status` is transitioned to terminal (`Released` or `Refunded`) before any external low-level `.call{value: ...}("")` is triggered.
  - `nonReentrant` modifier locks execution. Reentrant calls fail immediately with custom error `ReentrancyGuardLocked()` or `InvalidState()`.
  - Automated adversarial tests verify reentrancy rejection via `contracts/test/ReentrantAttacker.sol`.

### 2.2 Revert Griefing & Transfer Failures
- **Threat:** A recipient contract consumes excessive gas or reverts on transfer to lock the contract state in a corrupted limbo.
- **Mitigation:**
  - Transfers are executed via `.call{value: amount}("")` checking return status `bool success`.
  - If a recipient explicitly reverts, the entire transaction reverts atomically with custom error `TransferFailed()`, preserving the escrow funds in the contract so that payment can be released once the recipient is resolved.

### 2.3 Solvency & Cross-Agreement Contamination
- **Threat:** Settling agreement A affects the balance or solvency of agreement B.
- **Mitigation:**
  - Every agreement tracks its exact deposited `amount`.
  - Payouts and refunds strictly transfer `agreement.amount`.
  - Unsolicited direct deposits via `receive()` and `fallback()` are explicitly rejected with `DirectDepositNotAllowed()`.
  - Interleaved multi-agreement stress tests confirm that the contract balance strictly matches active liabilities.

### 2.4 Timestamp & Miner Manipulation
- **Threat:** Block timestamp manipulation allows early refund or early finalization.
- **Mitigation:**
  - Review window bounds must be between 1 second and 30 days. In EVM networks (including BOT Chain), block timestamps can vary by at most a few seconds. The protocol enforces explicit strict inequalities (`> block.timestamp`).

---

## 3. Test Coverage Summary

The automated test suite in `test/BotPayEscrow.test.ts` provides 100% test pass rate across 28 unit, authorization, adversarial, and invariant test cases:

```
  BotPayEscrow — Protocol Lifecycle, Security & Invariants
    Phase 1: Agreement Creation & Funding (6 tests)
      ✔ should successfully create and fund an escrow agreement in a single atomic transaction
      ✔ should reject zero-value funding
      ✔ should reject self-payment
      ✔ should reject zero address provider
      ✔ should reject expired or invalid service deadlines
      ✔ should reject invalid review duration (0 or > 30 days)
    Phase 2: Service Delivery Submission (5 tests)
      ✔ should allow designated provider to submit delivery evidence before service deadline
      ✔ should reject delivery from non-provider address
      ✔ should reject delivery with empty evidence hash
      ✔ should reject delivery after service deadline has passed
      ✔ should reject duplicate delivery submission
    Phase 3: Buyer & Agent Payment Release (4 tests)
      ✔ should allow buyer to explicitly release payment to provider
      ✔ should allow authorized agent wallet to release payment
      ✔ should reject payment release from unauthorized stranger or revoked agent
      ✔ should prevent double release
    Phase 4: Permissionless Finalization After Review Window (3 tests)
      ✔ should reject finalization before review deadline has expired
      ✔ should allow any caller to finalize settlement after review window expires
      ✔ should prevent finalization after agreement was already released
    Phase 5: Undelivered Refund Lifecycle (5 tests)
      ✔ should reject refund before service deadline expires
      ✔ should allow buyer to claim full refund after service deadline expires if delivery was never submitted
      ✔ should reject refund from unauthorized parties or provider
      ✔ should reject refund once delivery has already been submitted
      ✔ should prevent double refund
    Phase 6: Adversarial & Reentrancy Protections (5 tests)
      ✔ should reject direct native BOT deposits through receive() or fallback()
      ✔ should handle failed native BOT transfer safely and revert without corrupting agreement state
      ✔ should prevent reentrancy during payment release
      ✔ should maintain strict solvency across multiple interleaved agreements
      ✔ should verify invalid agreement IDs revert with AgreementNotFound

  28 passing (4s)
```

---

## 4. Audit Disclaimer
The `BotPayEscrow` contract has been rigorously tested using automated unit, adversarial, reentrancy, and invariant test suites, static analysis, and bytecode inspection. **However, this implementation has not undergone a formal third-party commercial security audit.** Machine-to-machine agents interacting with the contract should verify parameters and manage private keys in accordance with their respective threat models.
