# Backend Architecture

## Overview

The Proof-to-Pay backend is an **application gateway** — not a replacement for the smart contract. The MST Blockchain remains the authoritative source of truth for all task state, escrow, proof hashes, verification results, and payment releases.

## Component Diagram

```
┌─────────────────────────────────────────────────────┐
│  Frontend (React + TypeScript + Vite — Phase 5)     │
│  BridgeKey Wallet (user-signed blockchain tx)        │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP REST API
                       ▼
┌─────────────────────────────────────────────────────┐
│  Backend API (Node.js + TypeScript + Express)        │
│  Port: 3001                                         │
│                                                     │
│  Routes:                                            │
│    GET  /api/health           ← Health check        │
│    GET  /api/blockchain       ← Network info        │
│    GET  /api/tasks            ← All tasks (read)    │
│    GET  /api/tasks/:id        ← Single task (read)  │
│    POST /api/tasks/:id/proof  ← Proof hash gen      │
│    POST /api/tasks            ← createTask (stub)   │
│    POST /api/tasks/:id/*      ← Write stubs         │
│    GET  /api/robot/:id/status ← Robot status        │
└──────────────────────┬──────────────────────────────┘
                       │ ethers.js JsonRpcProvider
                       ▼
┌─────────────────────────────────────────────────────┐
│  MST Testnet RPC                                    │
│  https://testnetrpc.mstblockchain.com               │
│  Chain ID: 91562037                                 │
└──────────────────────┬──────────────────────────────┘
                       │ Contract calls (view functions)
                       ▼
┌─────────────────────────────────────────────────────┐
│  ProofToPay Smart Contract                          │
│  0x09b9e52dE1B7fd4cD1eC7139275131557dbF5347         │
│                                                     │
│  Source of truth for:                               │
│    • Task state                                     │
│    • Escrow balance                                 │
│    • Proof hash                                     │
│    • Verification result                            │
│    • Payment release                                │
└─────────────────────────────────────────────────────┘
                       
┌─────────────────────────────────────────────────────┐
│  Robot Service Interface (Phase 4: Stub)            │
│                                                     │
│  sendTask()         → NEURICK (Phase 6+)            │
│  getRobotStatus()   → NEURICK (Phase 6+)            │
│  receiveProof()     → Robot Simulator (Phase 6+)    │
└─────────────────────────────────────────────────────┘
```

## Read vs. Write Operations

### Read Operations (IMPLEMENTED)
The backend reads task data directly from the deployed smart contract via a read-only JSON-RPC provider. No private key is required.

| Endpoint | Contract Function | Description |
|----------|-------------------|-------------|
| GET /api/tasks/:id | `getTask(taskId)` | Full task state from chain |
| GET /api/tasks | `getAllTaskIds()` + `getTask()` | All tasks |
| GET /api/blockchain | `eth_chainId`, `eth_blockNumber` | Network info |

### Proof Hash Generation (IMPLEMENTED)
The backend accepts physical sensor evidence (off-chain) and generates a deterministic `keccak256` hash. The raw evidence **never** goes on-chain. Only the hash does.

### Write Operations (STUBS — BridgeKey in Phase 5)
User-facing write operations (`createTask`, `fundTask`, `assignRobot`, `refundTask`) must be signed by the user's wallet (BridgeKey). The backend does **not** take custody of user funds.

Robot-specific write operations (`startTask`, `submitProof`, `verifyTask`, `releasePayment`) will be signed by the backend's robot signer when NEURICK is integrated.

## Off-Chain Proof Model

```
NEURICK Robot
    │ Sensor telemetry (RFID, ultrasonic, GPS)
    ▼
Backend ProofEvidence object (off-chain, in memory)
    │
    ▼
keccak256(canonicalJSON(evidence))
    │
    ▼ bytes32 proofHash
Smart Contract submitProof(taskId, proofHash)
```

Raw sensor data stays off-chain. Only the cryptographic digest is committed to the blockchain.

## Security Principles
- No private keys are ever logged or returned in API responses.
- The `BACKEND_PRIVATE_KEY` in `.env` is only for robot/verifier-signed operations.
- User funds and escrow are controlled entirely by the smart contract.
- The BridgeKey wallet handles user-facing transaction signing.
