# Proof-to-Pay 🚀

### Work → Proof → Verification → Payment

Proof-to-Pay is a blockchain-powered robot marketplace where physical work is verifiably linked to smart-contract escrow payments. 

## ⚠️ Hardware Status ⚠️
**Physical NEURICK robot validation remains pending because the ESP32-S3 USB/COM9 connection is currently blocked.** We have successfully prepared the modular C++ firmware (`hardware/neurick/`), but physical validation could not be completed. However, the software and blockchain components are **100% complete and working** using our end-to-end Robot Simulator.

---

## 🎯 Problem
Physical robot work is difficult to connect with trustworthy automated payment. When a robot claims to have completed a task, how does the payer *know* the physical task actually happened before releasing payment? Traditional systems rely on trust, which breaks down in decentralized or gig-economy models.

## 💡 Solution
Proof-to-Pay connects a robot marketplace with the **MST Blockchain** using smart-contract escrows. 
Robots perform physical tasks and their sensors generate proof. An independent verifier validates this sensor data, and the smart contract releases payment *only* after verification is confirmed on-chain.

## 🏗️ Architecture
Our system consists of decoupled, secure layers:
1. **Frontend**: React-based UI allowing users to create tasks, fund escrows, and monitor the lifecycle.
2. **Backend**: Express API orchestrator that canonicalizes sensor evidence and generates deterministic `keccak256` hashes.
3. **Robot / Simulator**: Executes the physical (or simulated) task, reads RFID tags, and generates evidence.
4. **Independent Verifier**: A separate engine that evaluates sensor evidence against business rules (Location, Package ID, RFID, Proof Hash) to prevent tampering.
5. **Smart Contract**: Immutable state machine deployed on MST Testnet that holds funds and enforces the verification requirement.

## 🔗 Meaningful MST Blockchain Usage
Proof-to-Pay is not just putting data on a blockchain. It leverages the MST Blockchain for **trustless escrow and state machines**.
- **`createTask` & `fundTask`**: Funds are locked safely in escrow.
- **`assignRobot` & `startTask`**: The robot is committed.
- **`submitProof`**: The cryptographic hash of the sensor evidence is anchored on-chain.
- **`verifyTask` & `releasePayment`**: The contract *guarantees* that rewards locked in escrow cannot be released unless the independent verifier confirms the physical sensor proof hash. If verification fails, the funds remain locked.

## 🛠️ Technology Stack
- **Blockchain**: MST Blockchain Testnet (Chain ID `91562037`)
- **Smart Contracts**: Solidity, Hardhat, OpenZeppelin
- **Web3 Wallet**: BridgeKey (EIP-1193)
- **Frontend**: React, TypeScript, Vite
- **Backend / Verifier**: Node.js, Express, TypeScript, ethers.js v6
- **Hardware (Phase 9 Prepared)**: NEURICK Robot, ESP32-S3, MFRC522 RFID

## 📜 Testnet Contract
- **Contract Address**: [`0x09b9e52dE1B7fd4cD1eC7139275131557dbF5347`](https://testnet.mstscan.com/address/0x09b9e52dE1B7fd4cD1eC7139275131557dbF5347)
- **Deployment Transaction**: [`0x1dbc5be4c55ab28e725f811020d5f949a0e5d1f512fea7f37d874310ba8b7f8c`](https://testnet.mstscan.com/tx/0x1dbc5be4c55ab28e725f811020d5f949a0e5d1f512fea7f37d874310ba8b7f8c)
- **Example End-to-End Task (T003)**:
  - Create: [`0xe7330869b65ca46ab66cc974bbfc6e0a32aaf22d090eeae3c45e407fb4166c80`](https://testnet.mstscan.com/tx/0xe7330869b65ca46ab66cc974bbfc6e0a32aaf22d090eeae3c45e407fb4166c80)
  - Verify: [`0xd8998a6b7191a4df01eb2a4d7555dfbbec15031edfe1208409d6cd4ced736bfe`](https://testnet.mstscan.com/tx/0xd8998a6b7191a4df01eb2a4d7555dfbbec15031edfe1208409d6cd4ced736bfe)
  - Payment: [`0x94499fbbc8064a2261761e04adfb6755a8bd520c1bc2bf1c459ad2bff97d56ee`](https://testnet.mstscan.com/tx/0x94499fbbc8064a2261761e04adfb6755a8bd520c1bc2bf1c459ad2bff97d56ee)

*(See `docs/PHASE_8_TRANSACTIONS.md` and `docs/MST_TESTNET_EVIDENCE.md` for full transaction logs)*

## 🎮 Demo Instructions
To run the full project locally:

**1. Start Backend**
```bash
cd backend && npm run dev
```

**2. Start Frontend**
```bash
cd frontend && npm run dev
# Open http://localhost:5173
```

**3. Run E2E Test Workflow**
(Creates task, funds, assigns, simulates robot, verifies, and pays out)
```bash
node scripts/phase10_e2e.js
```

## ✅ Testing
**90 out of 90 tests pass!**
```bash
npx hardhat test                 # 17 passing
cd backend && npm test           # 10 passing
cd frontend && npm test          # 16 passing
cd verifier && npm test          # 16 passing
cd robot/simulator && npm test   # 31 passing
```
