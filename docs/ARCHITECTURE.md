# Proof-to-Pay Architecture

## Overview
Proof-to-Pay is an end-to-end framework linking physical robotic task execution with on-chain cryptographic escrow settlement on MST Blockchain.

## System Components

### 1. Smart Contracts (`/contracts`)
- **Role**: Manages task lifecycle, escrows MSTC funds, records assigned robot IDs, stores canonical proof hashes, and validates verifier signatures before releasing payment.
- **Status**: TODO (Phase 1)

### 2. Frontend Application (`/frontend`)
- **Role**: Operator / client dashboard to create tasks, deposit reward funds via BridgeKey wallet, track robot assignment and physical status in real-time, inspect verification proofs, and verify MST Blockchain transaction hashes.
- **Status**: TODO

### 3. Backend Gateway (`/backend`)
- **Role**: REST API and task orchestration service. Coordinates task queues, communicates with NEURICK hardware/simulator, constructs canonical proof objects, and computes proof hashes.
- **Status**: TODO

### 4. Robot & Hardware Gateway (`/robot`)
- **Role**: ESP32-S3 microcontroller firmware and sensor integration (RFID RC522, ultrasonic sensors) running on NEURICK robot, with local simulation support (`/robot/simulator`).
- **Status**: TODO

### 5. Independent Verifier (`/verifier`)
- **Role**: Off-chain verification node that audits physical sensor telemetry against task constraints and signs or submits verification attestations to the smart contract.
- **Status**: TODO

## Data Flow
```
[User / Frontend]
       │ Create Task & Escrow Funds (MSTC)
       ▼
[MST Smart Contract] ◄──── Verification Submission
       ▲                           │
       │ Release Payment           │
       │                           │
[Backend Gateway] ──► [Independent Verifier]
       ▲                           ▲
       │ Dispatch Task & Collect   │ Audit Physical Telemetry
       │ Sensor Evidence           │
       ▼                           │
[NEURICK Robot / Sensors] ─────────┘
```
