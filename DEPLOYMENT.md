# BotPay — BOT Chain Mainnet Deployment Record

## 1. Mainnet Deployment Overview

- **Project:** BotPay
- **Network Name:** BOT Chain Mainnet
- **Chain ID:** 677
- **RPC URL:** https://rpc.botchain.ai
- **Block Explorer:** https://scan.botchain.ai
- **Contract Name:** `BotPayEscrow`
- **Mainnet Contract Address:** [`0x2d25345ff92C85E00E83c8ce1798f0CD66f6DCCA`](https://scan.botchain.ai/address/0x2d25345ff92C85E00E83c8ce1798f0CD66f6DCCA)
- **Deployment Transaction Hash:** [`0xf9a7f180e3b9d7d42df17746d50f6a47384394ab25ff9e10569f62bb02fbadbd`](https://scan.botchain.ai/tx/0xf9a7f180e3b9d7d42df17746d50f6a47384394ab25ff9e10569f62bb02fbadbd)
- **Block Number:** 26552707
- **Deployer Address:** `0x34a19B30d9edD62424802d323E81c25599A9f02e`
- **Deployment Gas Used:** 915,714
- **Effective Gas Price:** 20.0 gwei
- **Deployment Transaction Cost:** 0.01831428 BOT
- **On-Chain Bytecode Size:** 3,888 bytes
- **Initial Agreement Count:** 0
- **Compiler Configuration:** Solidity 0.8.24, Optimizer enabled (runs: 200), EVM target: Paris.

---

## 2. On-Chain Verification Confirmation

1. **RPC Verification:** Queried `eth_getCode(0x2d25345ff92C85E00E83c8ce1798f0CD66f6DCCA)` against `https://rpc.botchain.ai`. Returned exact 3,888 bytes of runtime bytecode.
2. **Chain ID Enforcement:** Verified RPC chainId is strictly `0x2a5` (677).
3. **Block Explorer Verification:** Verified address page on official explorer: `https://scan.botchain.ai/address/0x2d25345ff92C85E00E83c8ce1798f0CD66f6DCCA`.
4. **State Responsiveness:** Initialized `agreementCount()` returns `0`, confirming constructor execution and storage accessibility.

---

## 3. Frontend & SDK Integration Verification

- **Frontend Configuration:** Written to `Botpay Frontend/src/contracts/BotPayEscrow.json` with mainnet address `0x2d25345ff92C85E00E83c8ce1798f0CD66f6DCCA` and full ABI.
- **SDK Default Address:** Configured in `sdk/BotPayClient.ts`.
- **Ecosystem Links:** Footer contains clickable text for **Botchain** (`https://botchain.ai`) and **botscan** (`https://scan.botchain.ai`).
