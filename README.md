# Proof-to-Pay

## Tagline
Work → Proof → Verification → Payment

## Problem
Physical robot work is difficult to connect with trustworthy automated payment.
A system needs to verify that a physical task actually happened before releasing payment.

## Solution
Proof-to-Pay connects a robot marketplace with MST Blockchain smart-contract escrow.
Robots perform physical tasks, sensors generate proof, an independent verifier validates the result, and the smart contract releases payment only after verification.

## Core Flow
Create Task
→ Fund Escrow
→ Assign Robot
→ Robot Performs Work
→ Generate Proof
→ Independent Verification
→ Smart Contract Verification
→ Payment Release

## Smart Contract
`ProofToPay.sol` manages task lifecycle, escrow, proof hashes, verification and payment release.
It guarantees that rewards locked in escrow cannot be released unless the independent verifier confirms the physical sensor proof hash.

## MST Testnet Deployment
- **Network**: MST Testnet
- **Chain ID**: `91562037`
- **RPC URL**: `https://testnetrpc.mstblockchain.com`
- **Deployer / Creator**: `0xBFe57C1C2B2eCeBF1f543A293b48221469EF4302`
- **Contract Address**: [`0x09b9e52dE1B7fd4cD1eC7139275131557dbF5347`](https://testnet.mstscan.com/address/0x09b9e52dE1B7fd4cD1eC7139275131557dbF5347)
- **Deployment Transaction**: [`0x1dbc5be4c55ab28e725f811020d5f949a0e5d1f512fea7f37d874310ba8b7f8c`](https://testnet.mstscan.com/tx/0x1dbc5be4c55ab28e725f811020d5f949a0e5d1f512fea7f37d874310ba8b7f8c)
- **First Interaction (`createTask T001`)**: [`0xbd615dc8556a8749a8e032c827e111ce1fc382bf171f13d3535ed7a520dd758f`](https://testnet.mstscan.com/tx/0xbd615dc8556a8749a8e032c827e111ce1fc382bf171f13d3535ed7a520dd758f)
- **Deployment Status**: **VERIFIED**

## Technology
- MST Blockchain
- MST Testnet
- Solidity
- Hardhat
- OpenZeppelin Contracts
- BridgeKey
- React
- TypeScript
- Node.js
- NEURICK
- ESP32-S3
- RFID
- Sensors

## Current Status
Phase 3 — MST Testnet Deployment (Verified)

## Local Testing & Scripts
To compile contracts and run the full Hardhat test suite:

```bash
# Compile smart contracts
npx hardhat compile

# Run the automated unit tests (17 passing)
npx hardhat test

# Deploy to MST Testnet
npx hardhat run scripts/deploy.js --network mstTestnet

# Run task creation interaction on MST Testnet
npx hardhat run scripts/createTask.js --network mstTestnet
```
