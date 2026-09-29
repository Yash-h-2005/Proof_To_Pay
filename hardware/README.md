# NEURICK Hardware Integration

This directory contains the C++ (Arduino) firmware and Python USB serial bridge connecting the real NEURICK robot hardware (ESP32-S3 + RC522 RFID) with the Proof-to-Pay blockchain system.

**Architecture:** Task-Dynamic Hardware Integration  
**Board:** ESP32-S3 Dev Module  
**Baud Rate:** 115200 (USB Serial, COM9 default)  

---

## 1. Dynamic Task Protocol

The NEURICK firmware is **permanently uploaded once** and does not require recompilation or re-uploading when task IDs or packages change. Tasks are configured at runtime via USB Serial commands sent by `serial_bridge.py`.

### Serial Command Specification:

```text
TASK,<taskId>,<packageId>
```
*Optional extended format:* `TASK,<taskId>,<packageId>,<source>,<destination>`

- **Example**: `TASK,T008,P08`
- **Firmware Response (Success)**:
  ```text
  TASK_RECEIVED
  Task: T008
  Package: P08
  Waiting for package...
  Place P08 RFID tag near reader.
  ```
- **Firmware Response (Error)**:
  ```text
  TASK_ERROR,Invalid format. Usage: TASK,<taskId>,<packageId>
  ```
- **Status Inquiry**: Send `STATUS` -> replies with `STATUS,<ACTIVE|IDLE>,<COMPLETED|PENDING>,<taskId>,<packageId>`
- **Ping**: Send `PING` -> replies `PONG`

### Safety Guarantees:
- If no valid `TASK` command has been received (`taskId == ""`), the firmware **will NOT generate evidence** even if an RFID tag is detected.
- When a task completes, the board remains active and listens for the next `TASK,<taskId>,<packageId>` command, enabling back-to-back execution without resetting the board or restarting Arduino IDE.

---

## 2. Wiring / Pin Mapping (Verified)

**RC522 RFID Reader** is connected through the NEWRRO extension connector:
- **SDA (SS)** -> IO3
- **SCK** -> IO18
- **MOSI** -> IO17
- **MISO** -> IO16
- **RST** -> IO15
- **GND** -> GND
- **3.3V** -> 3V3

---

## 3. Real Telemetry & Hybrid Simulation

- **Real Telemetry**:
  - Motion controller heartbeat & communication via `Newrick nr;`
  - Real battery voltage telemetry (`telemetry.getBatteryVolts()`)
  - Real dynamic RFID tag UID detection (`rfidReader.scanRFID()`)
- **Simulated Movement**:
  - Physical wheels and chassis encoders are not attached in the hybrid setup.
  - Movement progression (0.0 m -> 12.4 m) is simulated programmatically.
  - Evidence explicitly retains: `"simulation": true`.
  - GPS is currently `null` (`"gps": null`).

---

## 4. Hardware Evidence Format

```json
{
  "taskId": "T008",
  "robotId": "NR-001",
  "packageId": "P08",
  "source": "Zone A",
  "destination": "Zone B",
  "timestamp": 45137,
  "rfidUid": "D9:33:6A:F8",
  "distance": 12.4,
  "gps": null,
  "simulation": true
}
```

---

## 5. Serial Bridge Usage

```bash
# Auto-detect latest active/working task from backend (e.g. T008):
python hardware/bridge/serial_bridge.py

# Specify an explicit task:
python hardware/bridge/serial_bridge.py --task T008

# Test mode (no COM port required, verifies backend ingestion & canonical hashing):
python hardware/bridge/serial_bridge.py --test
python hardware/bridge/serial_bridge.py --test --task T008

# Run bridge protocol unit tests:
python hardware/bridge/test_dynamic_protocol.py
```
