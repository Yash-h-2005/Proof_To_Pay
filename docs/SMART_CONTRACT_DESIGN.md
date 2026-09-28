# Proof-to-Pay Smart Contract Design

## 1. Purpose
`ProofToPay.sol` is the financial and verification escrow core of the Proof-to-Pay marketplace. It bridges physical work executed by NEURICK robots with trustless smart-contract settlements on the MST Blockchain.

The central principle enforced by this contract is:
> **WORK → PROOF → VERIFICATION → PAYMENT**
> 
> *No verified proof = No payment.*

---

## 2. Architecture & Interaction Diagram

```
Creator
  |
  | create + fund
  v
Smart Contract Escrow
  |
  | assign
  v
Robot
  |
  | physical work
  v
Proof
  |
  v
Independent Verifier
  |
  | verified
  v
Smart Contract
  |
  | release
  v
Robot Payment
```

---

## 3. Task Lifecycle & State Transitions

The contract models physical task execution through a finite state machine:

| State | Transition Trigger | Authorized Caller | Description |
| :--- | :--- | :--- | :--- |
| `CREATED` | `createTask()` | Task Creator | Task specification declared with unique `taskId` and `reward` |
| `FUNDED` | `fundTask()` | Task Creator | Exact reward value deposited into contract escrow |
| `ASSIGNED` | `assignRobot()` | Task Creator | Specific EVM robot address linked to the task |
| `WORKING` | `startTask()` | Assigned Robot | Robot signals start of physical navigation / package handling |
| `PROOF_SUBMITTED` | `submitProof()` | Assigned Robot / Verifier | Canonical cryptographic hash of sensor telemetry recorded on-chain |
| `VERIFIED` | `verifyTask(true)` | Authorized Verifier | Independent verifier confirms physical proof criteria are met |
| `PAID` | `releasePayment()` | Any Actor / Creator | Escrowed reward transferred safely to the robot's address |
| `REFUNDED` | `refundTask()` | Task Creator | Escrow returned to creator if task cannot be verified/completed |

---

## 4. Escrow Model
- **Locking Funds**: The task creator calls `fundTask(taskId)` with `msg.value == task.reward`. The native tokens (`tMSTC` / `MSTC`) remain locked in contract custody.
- **Custody Safety**: Funds cannot be accessed, moved, or seized by the contract owner or any third party while held in escrow.
- **Zero-Sum Accounting**: Every funded task holds exactly its specified reward, and funds are discharged solely upon transition to `PAID` or `REFUNDED`.

---

## 5. Proof Hash Model
- **Off-Chain Telemetry**: High-frequency physical telemetry (ultrasonic distance streams, RFID timestamps, GPS records) remains off-chain in the backend/robot gateway to eliminate excessive gas and storage bloat.
- **Canonical Hash**: A deterministic cryptographic digest (`bytes32 proofHash = keccak256(...)`) of the normalized proof JSON is written to `tasks[taskId].proofHash`.
- **Immutability**: Once `submitProof()` transitions the task to `PROOF_SUBMITTED`, the proof hash is permanently locked against tampering.

---

## 6. Verification Model
- **Separation of Concerns**: The robot is strictly prohibited from verifying its own physical tasks.
- **Verifier Role**: The contract maintains an authorized `verifier` address.
- **Independent Evaluation**: An off-chain verification node audits the sensor telemetry against task constraints (correct package RFID UID, start/end zones, realistic time elapsed).
- **Verification Call**: Only the authorized verifier can invoke `verifyTask(taskId, success)`.
  - If `success == true`: State transitions to `VERIFIED`.
  - If `success == false`: Task remains unverified and unpaid, allowing safe creator refund.

---

## 7. Payment Release
- **Guaranteed Settlement**: `releasePayment(taskId)` requires `task.state == TaskState.VERIFIED`.
- **Recipient Protection**: Payout goes strictly to the assigned `task.robot` address.
- **Checks-Effects-Interactions**: The state is set to `PAID` *before* initiating the external transfer.
- **Reentrancy Protection**: Guarded by OpenZeppelin's `nonReentrant` modifier.

---

## 8. Refund Mechanism
- **Protection for Creators**: If a robot fails to execute, goes offline, or verification is rejected, the creator can reclaim their escrowed funds via `refundTask(taskId)`.
- **Allowed States**: Refunds are strictly allowed from `FUNDED`, `ASSIGNED`, or `PROOF_SUBMITTED` (if verification failed).
- **Strict Invariants**: Cannot refund an already `PAID` or `REFUNDED` task.

---

## 9. Access Control
- **`onlyOwner`**: Restricted to deployer for administrative configuration (`setVerifier`).
- **Creator Restrictions**: Only the creator can fund, assign a robot, or claim refunds for their task.
- **Robot Restrictions**: Only the assigned robot address can initiate `startTask` and submit proof.
- **Verifier Restrictions**: Only the verified attestation node can record verification judgments.

---

## 10. Security Considerations
1. **Reentrancy**: Mitigated through Checks-Effects-Interactions and `ReentrancyGuard`.
2. **Double Payment**: State check `task.state == TaskState.VERIFIED` ensures transition to `PAID` happens exactly once.
3. **Task ID Collisions**: `createTask` enforces uniqueness via `!taskExists[taskId]`.
4. **Safe Transfer Logic**: Uses `call{value: payout}("")` with explicit success checks rather than deprecated `.transfer()` or `.send()`.

---

## 11. Future MST Testnet Deployment
During Phase 3, this contract will be deployed to MST Testnet (`Chain ID: 91562037`, `RPC: https://testnetrpc.mstblockchain.com`) using Hardhat and verified on MSTScan (`https://testnet.mstscan.com`).
