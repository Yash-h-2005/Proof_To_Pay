# Proof-to-Pay Demo Guide

This guide explains how to demonstrate the Proof-to-Pay project to judges.

### Preparation
1. Ensure Node.js (v18+) is installed.
2. Install BridgeKey in your browser and switch to the MST Testnet.
3. Obtain testnet MSTC for your wallet.

### 1. The Clean Start
1. Run `cd backend && npm run dev`
2. Run `cd frontend && npm run dev`
3. Open `http://localhost:5173/` in Chrome.
4. Show the Dashboard. It will pull all existing tasks (including T001, T002, T003) from the deployed MST Testnet smart contract.

### 2. Wallet Connection
Click "Connect BridgeKey" in the top right.
Show the wallet address and balance successfully loading. Explain that this is connected live to the MST Testnet (Chain ID 91562037).

### 3. Creating a Task
1. Navigate to `/create` via the UI.
2. Enter a new Task ID (e.g., T004), Package ID, Zones, and Reward.
3. Click Create. BridgeKey will prompt for a transaction.
4. Explain how funds are being locked in the smart contract escrow.

### 4. Running the E2E Lifecycle
Since the physical hardware cannot be shown due to the known USB/COM9 limitation, we use our E2E orchestrator to demonstrate the rest of the lifecycle.
1. Open a terminal.
2. Run `node scripts/phase10_e2e.js` (update the script to point to T004 if desired).
3. The script will automatically:
   - Assign the robot on-chain
   - Start the task on-chain
   - Invoke the robot simulator (generating the simulated JSON proof)
   - Canonicalize and hash the proof
   - Submit the proof on-chain
   - Invoke the independent verifier (which verifies the hash against business rules)
   - Verify the task on-chain
   - Release the payment from escrow back to the wallet
4. Show the script output. Highlight the Verification Engine passing all checks (Location, Distance, RFID, Hash Integrity).

### 5. Final State UI
Refresh the React frontend.
Show that the task is now in the `PAID` state, with all the verification steps marked as Complete.

### 6. Hardware Context (Optional)
Show the `hardware/neurick/` folder. Explain that the C++ code successfully interfaces with the NEURICK API and RC522 RFID reader, generating the exact same JSON evidence structure as the simulator. Explain that physical validation was only blocked by a local USB COM port driver issue.
