# NEURICK Robot Simulator — Technical Documentation

## Overview

The robot simulator (`robot/simulator/`) is a software replacement for the NEURICK NR-001 robot during Phase 6 of Proof-to-Pay development.

The physical NEURICK robot's wheels are not available for movement testing during this phase. The simulator preserves the exact task/proof interface that the real robot will use, so Phase 7+ can swap in the hardware robot without changing the backend API.

---

## Architecture

```
CLI: npm run simulate -- T001
             ↓
  RobotSimulator (src/robot/RobotSimulator.ts)
    ├─ RfidSensorSimulator  — simulates RC522 RFID read at source
    ├─ EncoderSensorSimulator — simulates wheel encoder distance
    ├─ GpsSensorSimulator   — GPS interface (disabled, no hardware)
    └─ ProofGenerator       — assembles ProofEvidence bundle
             ↓
  BackendClient (src/api/backendClient.ts)
    HTTP → http://localhost:3001
             ↓
  Backend API (Phase 4 — Express + ethers.js)
             ↓
  MST Testnet (Chain ID 91562037)
             ↓
  ProofToPay Contract (0x09b9e52dE1B7fd4cD1eC7139275131557dbF5347)
```

The simulator **does not** connect to the blockchain.

---

## Robot States

| State | Description |
|-------|-------------|
| IDLE | Waiting for task assignment |
| ASSIGNED | Task accepted — package + route loaded |
| MOVING_TO_SOURCE | Navigating to pickup location |
| PACKAGE_DETECTED | RFID tag confirmed at source |
| MOVING_TO_DESTINATION | Carrying package to delivery location |
| DESTINATION_REACHED | Arrived at drop-off point |
| PROOF_GENERATED | Sensor evidence bundle assembled |
| COMPLETED | Proof submitted to backend successfully |
| FAILED | Unrecoverable error — task aborted |

Valid transitions follow this DAG:
```
IDLE → ASSIGNED → MOVING_TO_SOURCE → PACKAGE_DETECTED
                                              ↓
                       COMPLETED ← PROOF_GENERATED ← DESTINATION_REACHED ← MOVING_TO_DESTINATION
```
All states → FAILED (except COMPLETED and FAILED themselves).

---

## Sensor Simulation Details

### RFID (RC522)

- File: `src/sensors/RfidSensorSimulator.ts`
- UID `D9:33:6A:F8` was obtained from physical bench testing of the RC522 hardware with the T001 package.
- In simulation, the UID is injected programmatically (`forceDetect()`), not read via SPI.
- Label: `SIMULATED_RC522`
- Configurable detection probability for failure scenarios.

### Wheel Encoder

- File: `src/sensors/EncoderSensorSimulator.ts`
- Maintains a running distance counter updated per movement tick.
- Simulated pulse rate: 1000 pulses/metre (placeholder — not calibrated to real NEURICK wheel circumference).
- Label: `SIMULATED_ENCODER`

### GPS

- File: `src/sensors/GpsSensorSimulator.ts`
- Disabled by default (`SIMULATOR_CONFIG.includeGps = false`).
- No valid NMEA sentences received from hardware during testing.
- Coordinates (12.9716, 77.5946) are placeholder values — not real positions.
- Label: `SIMULATED_GPS`
- Interface is ready for real hardware integration.

---

## Movement Model

```
Total simulated route: 12.4 metres (Zone A → Zone B)
Step size: 2.0 metres per tick
Interval: 500ms per tick

Timeline:
 t=0.0s: 0.0m  ░░░░░░░░░░
 t=0.5s: 2.0m  ██░░░░░░░░
 t=1.0s: 4.0m  ████░░░░░░
 t=1.5s: 6.0m  ██████░░░░  ← source reached
 t=2.0s: 8.0m  ████████░░
 t=2.5s:10.0m  █████████░
 t=3.0s:12.4m  ██████████  ← destination reached
```

Total simulated execution time: ~3 seconds (configurable via `SIMULATOR_CONFIG`).

---

## Proof Format

The proof evidence sent to the backend:

```json
{
  "taskId": "T001",
  "robotId": "NR-001",
  "packageId": "P01",
  "source": "Zone A",
  "destination": "Zone B",
  "timestamp": 1790625544,
  "rfidUid": "D9:33:6A:F8",
  "distance": 12.4
}
```

The backend computes the canonical hash:
```
keccak256(JSON.stringify(evidence, Object.keys(evidence).sort()))
→ 0xe3d61082b5d9f37f947a225d82881d45aee25f2b86d1c05d6e815009117daf03
```

The simulator does not compute the hash itself. The backend remains the single source of canonical hashing.

---

## Backend Communication

| Step | HTTP call | Purpose |
|------|-----------|---------|
| 1 | `GET /api/health` | Verify backend is online |
| 2 | `GET /api/tasks/T001` | Read task from blockchain |
| 3 | `POST /api/tasks/T001/proof` | Submit sensor evidence |

---

## Error Handling

| Scenario | Behaviour |
|----------|-----------|
| Backend unavailable | Prints `BACKEND UNAVAILABLE`, exits code 1 |
| Task not found | Prints task not found message, exits code 1 |
| RFID detection failure | Transitions to FAILED, descriptive message |
| Proof submission failure | Transitions to FAILED, shows HTTP error |
| Invalid state transition | Throws with `from → to` details |
| Movement failure | Transitions to FAILED |

---

## Files Created

```
robot/simulator/
├── src/
│   ├── index.ts                          ← CLI entry point
│   ├── config.ts                         ← All simulation parameters
│   ├── robot/
│   │   ├── RobotState.ts                 ← State machine + valid transitions
│   │   ├── RobotMovement.ts              ← Step-based movement simulation
│   │   └── RobotSimulator.ts             ← Main orchestrator
│   ├── sensors/
│   │   ├── RfidSensorSimulator.ts        ← RC522 simulation
│   │   ├── EncoderSensorSimulator.ts     ← Wheel encoder simulation
│   │   └── GpsSensorSimulator.ts         ← GPS interface (disabled)
│   ├── proof/
│   │   └── ProofGenerator.ts             ← Evidence bundle assembly
│   ├── api/
│   │   └── backendClient.ts              ← HTTP client
│   └── tests/
│       └── robot.test.ts                 ← 31 unit tests
├── package.json
├── tsconfig.json
└── README.md
```

---

## Verified Proof Hash

From T001 simulation run (2026-09-28):

```
Proof Hash:
0xe3d61082b5d9f37f947a225d82881d45aee25f2b86d1c05d6e815009117daf03

Evidence:
  taskId:    T001
  robotId:   NR-001
  packageId: P01
  source:    Zone A
  destination: Zone B
  timestamp: 1790625544
  rfidUid:   D9:33:6A:F8  [SIMULATED RC522]
  distance:  12.40m        [SIMULATED ENCODER]
```

This is a real `keccak256` hash computed by the Phase 4 backend.
It is NOT a blockchain transaction — no on-chain state was modified in Phase 6.

---

## Security

- No private keys, wallet seeds, or signing credentials in this module.
- The simulator talks to the backend only.
- Blockchain signing is handled by the backend (Phase 4) and BridgeKey wallet (Phase 5).

---

## Limitations

1. **Software simulation** — no real motor control or physical movement.
2. **RFID programmatically injected** — `D9:33:6A:F8` is not read live from RC522.
3. **Encoder not calibrated** — 1000 pulses/metre is a placeholder.
4. **GPS disabled** — no valid NMEA data received from hardware.
5. **No blockchain transaction** — Phase 6 ends at proof submission to backend.
6. **Single robot** — NR-001 only; multi-robot support is a future phase.

---

## What Is NOT Implemented in Phase 6

- Real motor control
- Real NEURICK movement hardware
- Real encoder hardware interface
- Real GPS NMEA parsing
- Real RFID hardware communication (live SPI read)
- Blockchain payment release
- Smart contract verification
- Independent verifier
- Robot HTTP status API (not needed for CLI simulation)
