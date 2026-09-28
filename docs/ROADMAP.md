# Proof-to-Pay Hackathon Roadmap

## Hackathon Phases

### Phase 0: Setup & Workspace Initialization (Current)
- [x] Environment inspection (Node.js, npm, Git)
- [x] Project folder structure setup
- [x] Base documentation and Git initialization
- [ ] Ready for Phase 1

### Phase 1: Smart Contracts & MST Blockchain Escrow
- [ ] Define TaskEscrow contract specification
- [ ] Implement Task creation, funding, and state tracking in Solidity
- [ ] Implement proof hash submission and verifier authorization
- [ ] Implement payment release and refund mechanisms
- [ ] Write local unit tests for contracts

### Phase 2: Backend Orchestration & Verifier Engine
- [ ] Setup Node.js + TypeScript REST API service
- [ ] Canonical proof schema definition and hashing
- [ ] Independent verifier service logic
- [ ] Task state synchronization with smart contracts

### Phase 3: Robot Telemetry & Simulator
- [ ] Define hardware telemetry schema (RFID RC522, ultrasonic sensors)
- [ ] Create robot simulation environment for hackathon testing
- [ ] ESP32-S3 firmware interface specifications

### Phase 4: Frontend Operator Dashboard
- [ ] Vite + React + TypeScript web interface
- [ ] BridgeKey wallet connection and MST Testnet interaction
- [ ] Task creation form and live verification tracking
- [ ] MSTScan transaction link integration

### Phase 5: End-to-End Integration & Demo Run
- [ ] Full loop execution: Task -> Escrow -> Robot Execution -> Proof -> Verifier -> Release
- [ ] Demo run recording and presentation preparation
