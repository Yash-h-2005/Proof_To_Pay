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
Phase 2 — Smart Contract Development

## Local Testing
To compile contracts and run the full Hardhat test suite:

```bash
# Compile smart contracts
npx hardhat compile

# Run the automated test suite
npx hardhat test
```
