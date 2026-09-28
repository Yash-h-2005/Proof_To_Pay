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
- **Public Wallet Address**: `0xBFe57C1C2B2eCeBF1f543A293b48221469EF4302` (Verified on-chain)
- **Initial Testnet Balance**: `10.0 tMSTC` (Verified via JSON-RPC)

## Development Tools
- **Node.js**: `v25.2.1` (Verified)
- **npm**: `11.6.2` (Verified)
- **Git**: `2.52.0.windows.1` (Verified)
- **Hardhat Status**: Hardhat `2.29.1` with `@nomicfoundation/hardhat-toolbox` `5.0.0`
- **MST SDK Status**: Unverified on public npm; standard EVM libraries (Hardhat, Ethers.js) utilized.
- **Vibe Kit Status**: Optional / not required for Phase 1.

## Important Security Notes
Never commit:
- `.env`
- private keys
- seed phrases
- wallet passwords
- secret credentials

---

# Phase 3 — Testnet Deployment & Verification

Real on-chain deployment and initial transaction execution records on MST Testnet.

## Network Parameters
- **Network**: MST Testnet
- **Chain ID**: `91562037`
- **RPC URL**: `https://testnetrpc.mstblockchain.com`
- **Deployer / Creator Public Address**: `0xBFe57C1C2B2eCeBF1f543A293b48221469EF4302`

## Contract Deployment Details
- **Contract Name**: `ProofToPay`
- **Contract Address**: `0x09b9e52dE1B7fd4cD1eC7139275131557dbF5347`
- **Deployment Transaction Hash**: `0x1dbc5be4c55ab28e725f811020d5f949a0e5d1f512fea7f37d874310ba8b7f8c`
- **Block Number**: `5789102`
- **Gas Used**: `2,206,142`
- **MSTScan Contract Explorer**: [https://testnet.mstscan.com/address/0x09b9e52dE1B7fd4cD1eC7139275131557dbF5347](https://testnet.mstscan.com/address/0x09b9e52dE1B7fd4cD1eC7139275131557dbF5347)
- **MSTScan Deployment Tx**: [https://testnet.mstscan.com/tx/0x1dbc5be4c55ab28e725f811020d5f949a0e5d1f512fea7f37d874310ba8b7f8c](https://testnet.mstscan.com/tx/0x1dbc5be4c55ab28e725f811020d5f949a0e5d1f512fea7f37d874310ba8b7f8c)

## First Contract Interaction
- **Function Executed**: `createTask("T001", 100 MSTC, "P01", "Zone A", "Zone B")`
- **Transaction Hash**: `0xbd615dc8556a8749a8e032c827e111ce1fc382bf171f13d3535ed7a520dd758f`
- **Block Number**: `5789120`
- **Gas Used**: `265,255`
- **MSTScan Interaction Tx**: [https://testnet.mstscan.com/tx/0xbd615dc8556a8749a8e032c827e111ce1fc382bf171f13d3535ed7a520dd758f](https://testnet.mstscan.com/tx/0xbd615dc8556a8749a8e032c827e111ce1fc382bf171f13d3535ed7a520dd758f)
- **On-Chain Verified State**: Task `T001` recorded with state `CREATED (0)`, reward `100.0 tMSTC`, package `P01`, source `Zone A`, destination `Zone B`.
- **Deployment Status**: **VERIFIED**

---

## Smart Contract Integration Points (Reference)
- **Escrow Creation**: Caller deposits specified MSTC reward locked by `taskId`.
- **Robot Assignment**: Stores assigned robot identity.
- **Proof Recording**: Stores `bytes32 proofHash` representing canonical task evidence.
- **Verification & Settlement**: Authorized verifier calls settlement function to release MSTC funds to the robot's address.
- **Timeout / Refund**: Allows task creator to reclaim funds if task is not completed or verified within a timeout window.
