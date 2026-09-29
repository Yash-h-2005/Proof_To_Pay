# Phase 10: End-to-End Workflow

## Architecture
The Proof-to-Pay Phase 10 architecture successfully runs a complete end-to-end task lifecycle, bridging real MST Testnet transactions with simulated off-chain services. 

1. **Frontend**: React-based UI to create and monitor the task.
2. **Smart Contract**: Deployed `ProofToPay` contract handles task state, escrow, and payments.
3. **Backend**: Express API orchestrates between blockchain, robot, and verifier.
4. **Robot Simulator**: Simulates NEURICK movement and RFID detection, generating off-chain JSON evidence with `simulation=true`.
5. **Verifier**: Independent Node.js service parses evidence, reconstructs the `keccak256` hash, checks business rules (Distance, Location, Package, RFID), and validates the proof.

## Workflow

1. **Create & Fund**: `createTask("T003", ...)` and `fundTask("T003")` executed on-chain.
2. **Assign & Start**: `assignRobot("T003", ...)` and `startTask("T003")` executed on-chain.
3. **Simulated Hardware execution**: Robot `NR-001` fetches task `T003` from backend, executes simulated route `Zone A` -> `Zone B`, detects RFID `D9:33:6A:F8`, and posts evidence to Backend.
4. **Proof Generation**: Backend canonicalizes evidence and creates `proofHash`.
5. **On-Chain Proof**: `submitProof("T003", proofHash)` executed on-chain.
6. **Independent Verification**: Verifier independently fetches task, calculates proof hash, and compares expectations. Result is `VERIFIED`.
7. **On-Chain Verification & Payment**: `verifyTask("T003", true)` and `releasePayment("T003")` executed on-chain. Escrow funds transferred back to wallet.

## Known Hardware Limitation
Phase 9 physical NEURICK validation remains pending because the ESP32-S3 USB/COM9 connection is currently unavailable. Therefore, Phase 10 successfully validates the software layer end-to-end while remaining ready for physical plug-and-play.

## Failure/Tamper Handling
- The Verifier catches tampered proofs. An invalid proof triggers a `FAIL` verification result, preventing `releasePayment()`.
- Smart contract logic ensures payments cannot be released unless the task state is `VERIFIED`.
