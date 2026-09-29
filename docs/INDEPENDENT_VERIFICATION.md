# Independent Verification (Phase 7)

## Overview
In the Proof-to-Pay architecture (`Work → Proof → Verification → Payment`), the verification step is critical. It ensures that payment is only released when independent evidence confirms the task was completed successfully.

## Robot vs Verifier Separation
The robot (`NR-001`) and the verifier (`VERIFIER-001`) are separate entities.
The robot is responsible for:
- Performing the work.
- Generating the proof evidence (RFID scans, distance).

The verifier is responsible for:
- Re-calculating the proof hash to ensure integrity.
- Checking that all sensor evidence meets the required thresholds (e.g. minimum distance).
- Ensuring the correct package was moved to the correct destination.

## Verification Flow
1. **Robot Submits Proof**: The robot generates evidence and sends it to the backend. The backend stores it and returns a `proofHash`.
2. **Verifier Retrieves Evidence**: The verifier pulls the raw evidence from the backend.
3. **Independent Checks**: The verifier runs 10 specific checks against the evidence.
4. **Tamper Detection**: The verifier recalculates the `keccak256` hash of the evidence. If it doesn't match the `proofHash`, the evidence was tampered with.
5. **Decision**: Only if **all 10 checks** pass, the result is `VERIFIED`.
6. **Backend Update**: The verifier submits the result to the backend.

## Why Payment is Blocked
In Phase 7, the verifier determines whether a task is `VERIFIED` or `FAILED`. However, the smart contract's `releasePayment` function is not called yet. Payment will be integrated in a later phase to ensure the verification logic is rock solid before real MST tokens are moved.

## Simulation Limitations
Currently, the sensor evidence is simulated (`SIMULATED_RC522`, `SIMULATED_ENCODER`). The verification engine proves that the logic works correctly, but it relies on simulated data. Real hardware verification will be introduced when the NEURICK robot is fully integrated.
