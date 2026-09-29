# Real NEURICK Hardware Integration: Dynamic Task Architecture

## Architecture Overview

The Proof-to-Pay hardware integration connects real physical sensor readings and battery telemetry from the NEURICK ESP32-S3 robot to the Proof-to-Pay backend and MST Testnet smart contracts.

```
Web Dashboard (Create -> Fund -> Assign -> Start)
       │
       ▼
Proof-to-Pay Backend (e.g. Task T008, Package P08, state: WORKING)
       │
       ▼  (fetch active task)
serial_bridge.py
       │
       ▼  TASK,<taskId>,<packageId>  (USB Serial 115200 baud)
NEURICK ESP32-S3 Firmware
       │
       ├─> Parses taskId & packageId at runtime
       ├─> Acknowledges: TASK_RECEIVED
       ├─> MFRC522 RFID Reader (RC522): Real tag UID detection
       ├─> Newrick Motion Controller: Real battery telemetry (volts)
       ├─> Simulated Movement: 0.0m -> 12.4m ("simulation": true)
       └─> Emits canonical hardware evidence JSON
       │
       ▼
serial_bridge.py (validates JSON & POSTs /api/tasks/:taskId/proof)
       │
       ▼
Backend Proof Store -> Independent Verifier (10/10 checks) -> MST Blockchain Settlement
```

---

## 1. Dynamic Task Protocol

Rather than hard-coding task identifiers or recompiling firmware for every delivery task, the firmware is **permanently flashed** and receives task assignments at runtime via USB Serial:

### Command Format
```text
TASK,<taskId>,<packageId>
```
*Optional extended format:* `TASK,<taskId>,<packageId>,<source>,<destination>`

### Response Handshake
1. **Bridge sends**: `TASK,T008,P08\n`
2. **Firmware responds**:
   ```text
   TASK_RECEIVED
   Task: T008
   Package: P08
   Waiting for package...
   Place P08 RFID tag near reader.
   ```
3. **Serial Bridge confirms**: `TASK_RECEIVED acknowledged by NEURICK board.`
4. **Physical trigger**: User presents the physical RFID tag to the reader.
5. **Firmware emits**:
   ```text
   FINAL HARDWARE EVIDENCE
   ========================================
   {"taskId":"T008","robotId":"NR-001","packageId":"P08","source":"Zone A","destination":"Zone B","timestamp":45137,"rfidUid":"D9:33:6A:F8","distance":12.4,"gps":null,"simulation":true}
   ========================================
   TASK_COMPLETED
   Waiting for next task command (TASK,<taskId>,<packageId>)...
   ```

---

## 2. Telemetry & Sensor Mapping

- **Battery Voltage**: Real hardware telemetry via `nr.begin()` / `telemetry.getBatteryVolts()`.
- **RFID Scanner**: Real RC522 reader connected via NEWRRO expansion port:
  - SDA (SS) = IO3
  - SCK = IO18
  - MOSI = IO17
  - MISO = IO16
  - RST = IO15
- **RFID UID**: Real dynamic physical scan (`rfidReader.getUID()`).
- **Movement**: Simulated progression (`0.0m` to `12.4m`) due to unmounted physical wheels/encoders.
- **Simulation Flag**: Always `"simulation": true`.
- **GPS**: Reserved / `null` (`"gps": null`).

---

## 3. Safe Defaults & Continuous Operation

1. **Unconfigured State**: Before a valid `TASK` command is received, the firmware defaults to `taskId = ""` and `packageId = ""`. If an RFID tag is scanned in this state, evidence is **NOT** generated.
2. **Continuous Multi-Task Execution**: After a task completes (`TASK_COMPLETED`), the board remains powered and listening. A subsequent `TASK,T009,P09` immediately arms the board for the next task without restarting the board or opening Arduino IDE.
3. **Fault Tolerance**: Malformed or unknown serial commands are safely handled with error feedback (`TASK_ERROR,...`) without crashing or resetting the ESP32.
