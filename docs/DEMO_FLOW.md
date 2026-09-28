# Demo Scenario: Physical Package Delivery Verification

## Scenario Summary
- **Task ID**: `T001`
- **Package ID**: `P01` (RFID UID)
- **Source**: `Zone A`
- **Destination**: `Zone B`
- **Reward**: `100 MSTC`
- **Robot ID**: `R01`

## Step-by-Step Flow
1. **Task Initialization**:
   - Operator creates delivery task via Frontend UI (`T001`, Package `P01`, Zone A -> Zone B, 100 MSTC).
   - Smart contract creates escrow and locks 100 MSTC from the user.
2. **Robot Assignment**:
   - Robot `R01` is assigned to task `T001`.
   - Backend dispatches assignment payload to NEURICK / simulator.
3. **Physical Task Execution**:
   - Robot navigates to Zone A.
   - Sensor scans Package `P01` RFID tag at pickup.
   - Robot traverses towards Zone B (ultrasonic obstacle avoidance and movement telemetry).
   - Robot scans RFID at Zone B drop-off location.
4. **Proof Generation**:
   - Robot telemetry packaged into canonical JSON proof object.
   - Backend computes SHA-256 / Keccak-256 `proofHash`.
5. **Independent Verification**:
   - Off-chain Verifier validates:
     - Correct RFID UID scanned at pickup and drop-off.
     - Sequential timestamp progression.
     - Ultrasonic movement telemetry consistency.
   - Verifier signs attestation with its authorized key.
6. **Settlement**:
   - Verifier submits verification transaction to MST Smart Contract with `proofHash`.
   - Smart contract verifies verifier signature / authorization and releases 100 MSTC to Robot `R01`.
   - Transaction hash is displayed to the user and linked to MSTScan.

## TODOs
- [ ] Define canonical JSON proof schema.
- [ ] Implement simulation script matching this exact demo flow.
- [ ] Add screenshots and MSTScan transaction links upon testnet execution.
