# NEURICK Robot Simulator

## Purpose

This is a **software simulator** for the NEURICK robot (ID: NR-001).

The physical NEURICK robot's wheels are not yet available for full movement testing.
This simulator replaces the physical robot for Phase 6 of Proof-to-Pay development,
preserving the exact same task/proof interface that the real robot will use.

> **This simulator does not replace the real NEURICK hardware.**
> All sensor values are clearly labelled `SIMULATED`.
> Real NEURICK integration will happen in a future phase.

---

## Architecture

```
npm run simulate
       ↓
RobotSimulator (NR-001)
  ├── RfidSensorSimulator   (SIMULATED RC522)
  ├── EncoderSensorSimulator (SIMULATED encoder)
  ├── GpsSensorSimulator    (SIMULATED GPS — disabled by default)
  └── ProofGenerator        (assembles evidence bundle)
       ↓
BackendClient               (HTTP → localhost:3001)
       ↓
Backend API (Phase 4)
       ↓
MST Testnet (Chain ID 91562037)
       ↓
ProofToPay Contract (0x09b9e52dE1B7fd4cD1eC7139275131557dbF5347)
```

The simulator does **not** connect to the blockchain directly.
The backend remains the sole application gateway to the smart contract.

---

## Robot States

```
IDLE
  ↓
ASSIGNED          — task accepted
  ↓
MOVING_TO_SOURCE  — navigating to pickup
  ↓
PACKAGE_DETECTED  — RFID tag scanned at source
  ↓
MOVING_TO_DESTINATION — carrying package to destination
  ↓
DESTINATION_REACHED   — arrived at drop-off
  ↓
PROOF_GENERATED   — sensor evidence assembled
  ↓
COMPLETED         — proof submitted to backend
```

`FAILED` can be reached from any state on an unrecoverable error.

---

## Sensor Simulation

### RFID (RC522)

- Module: `src/sensors/RfidSensorSimulator.ts`
- Simulates RFID tag detection at the source location
- UID `D9:33:6A:F8` from bench testing of the physical RC522 hardware
- Label: `SIMULATED_RC522`

```typescript
const rfid = new RfidSensorSimulator('D9:33:6A:F8', 1.0);
const result = rfid.forceDetect();
// { detected: true, uid: 'D9:33:6A:F8', simulation: true, source: 'SIMULATED_RC522' }
```

### Wheel Encoder

- Module: `src/sensors/EncoderSensorSimulator.ts`
- Simulates distance measurement from wheel rotations
- Updates in sync with movement steps
- Label: `SIMULATED_ENCODER`

```typescript
const enc = new EncoderSensorSimulator();
enc.setDistance(12.4);
enc.getDistance(); // 12.4
```

### GPS (Disabled by default)

- Module: `src/sensors/GpsSensorSimulator.ts`
- GPS integration was attempted in hardware testing — no valid NMEA data received
- Placeholder interface so real GPS can be added later
- Label: `SIMULATED_GPS`

```typescript
const gps = new GpsSensorSimulator(12.9716, 77.5946, false); // disabled
gps.getReadingOrUndefined(); // undefined (GPS off)
```

---

## Proof Format

The simulator generates a `ProofEvidence` object and sends it to the backend.
The backend performs canonical hashing (`keccak256`) and returns the `proofHash`.

```typescript
{
  taskId: 'T001',
  robotId: 'NR-001',
  packageId: 'P01',
  source: 'Zone A',
  destination: 'Zone B',
  timestamp: 1700000000,
  rfidUid: 'D9:33:6A:F8',   // SIMULATED
  distance: 12.4,             // SIMULATED
  // gps: { ... }            // disabled by default
}
```

The simulator **never computes the proof hash itself**. The backend is
the single source of canonical hashing, matching `taskService.ts`:
```
keccak256(JSON.stringify(canonical, Object.keys(canonical).sort()))
```

---

## Backend Communication

The simulator calls three endpoints:

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/health` | Verify backend is running |
| GET | `/api/tasks/:taskId` | Fetch task data from blockchain |
| POST | `/api/tasks/:taskId/proof` | Submit proof evidence |

---

## How to Run

### Prerequisites

Backend must be running on port 3001:
```bash
cd backend && npm run dev
```

### Install dependencies
```bash
cd robot/simulator
npm install
```

### Run simulation (default: T001)
```bash
npm run simulate
```

### Run simulation for a specific task
```bash
npm run simulate -- T002
```

### Run tests
```bash
npm test
```

---

## Example Output

```
========================================
     PROOF-TO-PAY ROBOT SIMULATOR
========================================
Robot:   NR-001
Mode:    SIMULATION (no physical hardware)
Task:    T001
Package: P01
----------------------------------------
[1] ASSIGNED — Task T001 accepted
       Package: P01 | Reward: 100.0 MSTC
[2] MOVING TO SOURCE — Navigating to Zone A
       [SIM ENCODER] 6.2m / 6.2m  [██████████]
[3] PACKAGE DETECTED — RFID UID: D9:33:6A:F8 [SIMULATED RC522]
[4] MOVING TO DESTINATION — Navigating to Zone B
       [SIM ENCODER] 12.4m / 12.4m  [██████████]
[5] DESTINATION REACHED — Arrived at Zone B
       [SIM ENCODER] Total distance: 12.40m
[6] GENERATING PROOF — Assembling sensor evidence
       Evidence:
         - taskId:    T001
         - robotId:   NR-001
         - packageId: P01
         - source:    Zone A
         - dest:      Zone B
         - timestamp: 1700000000
         - rfidUid:   D9:33:6A:F8 [SIMULATED]
         - distance:  12.40m [SIMULATED]
[7] SUBMITTING PROOF — POST /api/tasks/T001/proof
[8] PROOF SUBMITTED — Proof hash received from backend
----------------------------------------
STATUS:  COMPLETED
Task:    T001

Proof Hash:
0x<keccak256-hash-from-backend>

⚠️  NOTE: Sensor values above are SIMULATED.
   No real physical movement occurred.
   Real NEURICK integration: future phase.
========================================
```

---

## Limitations

- **Software simulation only.** No real motor control or physical movement.
- **RFID is injected programmatically.** `D9:33:6A:F8` matches the known hardware UID but is not read live from the RC522.
- **Encoder distance is deterministic.** Not calibrated from real wheel circumference data.
- **GPS is disabled.** No valid NMEA data was received during hardware testing.
- **No blockchain transaction is created.** Phase 6 ends at proof submission to backend. The backend/verifier/contract payment flow is a later phase.
- **Robot ID NR-001** is hardcoded. Multi-robot support is a future phase.

---

## Security

This simulator contains **no private keys**, wallet seeds, or blockchain signing credentials.
It communicates with the backend API only.
All blockchain signing is handled by the backend (Phase 4) and user wallets (Phase 5).
