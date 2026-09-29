# Proof-to-Pay Payment Flow (Phase 8)

The core principle of Proof-to-Pay is **Work → Proof → Verification → Payment**. This document traces the complete lifecycle of a task (T002) settling on the MST Blockchain Testnet.

## Lifecycle Steps

### 1. Task Creation (`CREATED`)
The user defines the task details (taskId, reward, packageId, source, destination).
- **Function**: `createTask(string taskId, uint256 reward, string packageId, string source, string destination)`
- **Signer**: User Wallet (BridgeKey)
- **Result**: Task is stored on the smart contract in the `CREATED` state.

### 2. Escrow Funding (`FUNDED`)
The user deposits the exact `reward` amount of MSTC tokens into the contract's escrow.
- **Function**: `fundTask(string taskId) payable`
- **Signer**: User Wallet (BridgeKey)
- **Result**: Escrow is funded. Task moves to `FUNDED`.

### 3. Robot Assignment (`ASSIGNED`)
The creator assigns a specific robot address to perform the task.
- **Function**: `assignRobot(string taskId, address robot)`
- **Signer**: User Wallet (BridgeKey)
- **Result**: Robot address recorded. Task moves to `ASSIGNED`.

### 4. Robot Work Commences (`WORKING`)
The assigned robot explicitly acknowledges and starts the task.
- **Function**: `startTask(string taskId)`
- **Signer**: Robot Wallet
- **Result**: Contract records the task is actively being worked on. State: `WORKING`.

### 5. Proof Generation
The NEURICK robot physically moves the package. It records sensor evidence (RFID tags read, wheel encoder distance covered, timestamp).
- **Result**: Off-chain evidence JSON payload. *(Simulated in Phase 8)*.

### 6. Independent Verification
The evidence is passed to an independent verifier (`VERIFIER-001`). The verifier calculates the deterministic `keccak256` hash of the evidence and ensures it meets the specific criteria (correct package, minimum distance traveled, etc).

### 7. On-Chain Proof Submission (`PROOF_SUBMITTED`)
The canonical `keccak256` hash of the evidence is posted to the smart contract. The raw evidence data itself stays off-chain for privacy and cost efficiency.
- **Function**: `submitProof(string taskId, bytes32 proofHash)`
- **Signer**: Robot Wallet or Verifier
- **Result**: Proof hash is logged permanently on-chain. State: `PROOF_SUBMITTED`.

### 8. On-Chain Verification (`VERIFIED`)
The authorized verifier tells the smart contract that the submitted proofHash matches a physically verified event. 
- **Function**: `verifyTask(string taskId, bool success)`
- **Signer**: Verifier Wallet (e.g. backend signer)
- **Result**: If successful, task state moves to `VERIFIED`. (If failed, it remains unverified and the user can request a refund).

### 9. Payment Release (`PAID`)
Once the contract state is `VERIFIED`, the escrowed funds are finally released to the robot's address.
- **Function**: `releasePayment(string taskId)`
- **Signer**: Any address (Permissionless call once verified)
- **Result**: MSTC is transferred to the robot. State: `PAID`.

## Final Result
- **Balance Before Payment**: `8.997002658 MSTC`
- **Balance After Payment**: `9.996957192 MSTC`
- **Difference**: `0.999954534 MSTC` (Exactly 1 MSTC reward minus gas fees)

This completes the trustless exchange of funds for verified physical work.
