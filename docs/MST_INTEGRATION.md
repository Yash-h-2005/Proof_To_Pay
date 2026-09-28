# MST Blockchain Integration Guide

## Overview
This document outlines the MST Blockchain specifications, contract requirements, and wallet interaction patterns for the Proof-to-Pay platform.

---

# Phase 1 — MST Environment

Documented and verified environment specifications for MST Blockchain development.

## Network
- **Network Name**: MST Testnet
- **Chain ID**: `91562037` (verified on-chain via `eth_chainId`; some early docs refer to `4545`)
- **RPC URL**: `https://testnetrpc.mstblockchain.com` (Verified active, block height > 5,788,000)
- **Explorer**: `https://testnet.mstscan.com` (MSTScan Testnet, HTTP 200 OK)
- **Native / Test Token**: `tMSTC` / `MSTC`

## Wallet
- **BridgeKey Status**: Configured. User created wallet named "Yash" for MST Testnet.
- **Public Wallet Address**: Not verified (pending user export from BridgeKey app).
- **Testnet Balance**: Not verified programmatically. Manual check instructions: Open BridgeKey, select "Yash" account on MST Testnet, view balance on dashboard.

## Development Tools
- **Node.js**: `v25.2.1` (Verified)
- **npm**: `11.6.2` (Verified)
- **Git**: `2.52.0.windows.1` (Verified)
- **Hardhat Status**: Available via `npx hardhat` (version `3.18.0`). Ready for Phase 2 smart contract compilation, testing, and deployment.
- **MST SDK Status**: Unverified / Not publicly available on npm registry (`mst-sdk`, `@mst/sdk`, and `@mstblockchain/sdk` returned 404). Standard EVM libraries (Hardhat, Ethers.js, Viem) will be used for contract interaction.
- **Vibe Kit Status**: Optional / not required for Phase 1. (VibeKit is an AI agent sandbox and Algorand framework, not required for the Proof-to-Pay EVM MVP).

## Important Security Notes

Never commit:
- `.env`
- private keys
- seed phrases
- wallet passwords
- secret credentials

---

## Smart Contract Integration Points (Future Reference)
- **Escrow Creation**: Caller deposits specified MSTC reward locked by `taskId`.
- **Robot Assignment**: Stores assigned robot identity.
- **Proof Recording**: Stores `bytes32 proofHash` representing canonical task evidence.
- **Verification & Settlement**: Authorized verifier calls settlement function to release MSTC funds to the robot's address.
- **Timeout / Refund**: Allows task creator to reclaim funds if task is not completed or verified within a timeout window.
