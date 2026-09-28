# MST Blockchain Integration Guide

## Overview
This document outlines the MST Blockchain specifications, contract requirements, and wallet interaction patterns for the Proof-to-Pay platform.

## Network Details
- **Network**: MST Testnet
- **Native Currency**: MSTC
- **Explorer**: MSTScan
- **Wallet**: BridgeKey Wallet / Web3 Provider
- **SDK**: MST TypeScript SDK (where applicable) / Ethers.js compatibility layer

## Smart Contract Integration Points
- **Escrow Creation**: Caller deposits specified MSTC reward locked by `taskId`.
- **Robot Assignment**: Stores assigned robot identity.
- **Proof Recording**: Stores `bytes32 proofHash` representing canonical task evidence.
- **Verification & Settlement**: Authorized verifier calls settlement function to release MSTC funds to the robot's address.
- **Timeout / Refund**: Allows task creator to reclaim funds if task is not completed or verified within a timeout window.

## TODOs
- [ ] Document official MST Testnet RPC URL, Chain ID, and explorer endpoint.
- [ ] Configure deployment scripts for MST Testnet.
- [ ] Document BridgeKey wallet connection steps.
- [ ] Verify testnet faucet access for MSTC gas/rewards.
