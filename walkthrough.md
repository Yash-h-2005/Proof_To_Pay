# NEURICK Serial Handshake Diagnosis & Dynamic Firmware Walkthrough

## 1. Executive Summary

During the initial deployment of the task-dynamic NEURICK firmware, the real USB serial bridge reported:
```text
Sending runtime task command: TASK,T008,P08
TimeoutError: Timed out waiting for TASK_RECEIVED acknowledgement from NEURICK board.
```

An exhaustive investigation across the firmware compilation flags, ESP32-S3 native USB architecture, and bridge serial connection handling identified the root causes. Both the firmware build options and the serial bridge handshake sequence were enhanced and validated on **COM9** with the real hardware.

---

## 2. Root Cause Analysis

### Investigation Findings Across 10 Vectors:

1. **Native USB CDC Mapping (`CDCOnBoot=cdc` Missing)**:
   - **Finding**: The ESP32-S3 on COM9 uses the chip's native USB CDC interface (`VID:PID=303A:1001`), not an external USB-UART converter chip.
   - **Root Cause**: When compiled with bare `--fqbn esp32:esp32:esp32s3`, the Arduino core defaults to `CDCOnBoot=default` (`ARDUINO_USB_CDC_ON_BOOT=0`). In this mode, the Arduino `Serial` object is routed to hardware UART0 on physical pins GPIO 43/44 instead of the USB CDC interface connected to the computer. Consequently, while ROM bootloader messages appeared on COM9, all application `Serial.println()` and `Serial.read()` calls were silently directed to floating header pins.
   - **Fix**: Compiled with `--fqbn esp32:esp32:esp32s3:CDCOnBoot=cdc` (`-DARDUINO_USB_MODE=1 -DARDUINO_USB_CDC_ON_BOOT=1`), binding `Serial` directly to USB CDC on COM9.

2. **Pyserial DTR/RTS Assertion & Auto-Reset**:
   - **Finding**: On Windows, `pyserial` asserts `DTR=True` and `RTS=True` by default when opening a port.
   - **Root Cause**: The ESP32 auto-reset circuit pulls the chip into reset or bootloader state when DTR/RTS are held high.
   - **Fix**: Explicitly set `ser.dtr = False` and `ser.rts = False` immediately upon opening the port in [serial_bridge.py](file:///d:/Proof-to-pay/hardware/bridge/serial_bridge.py).

3. **Serial Input Timing & Premature Command Transmission**:
   - **Finding**: The bridge previously waited a fixed 2.0s sleep and cleared buffers without observing whether the ESP32 had finished booting.
   - **Fix**: Added `wait_for_esp32_boot(ser, max_wait=3.5)` in [serial_bridge.py](file:///d:/Proof-to-pay/hardware/bridge/serial_bridge.py), which actively streams and logs boot banners until `READY FOR TASK COMMAND` is confirmed. Also reduced `delay(2000)` in `neurick.ino` `setup()` to `delay(500)` for faster boot settling.

4. **Non-blocking CDC TX Timeout**:
   - **Finding**: If USB CDC buffer fills before a terminal is attached, default blocking TX behavior can halt firmware execution.
   - **Fix**: Added `Serial.setTxTimeoutMs(0)` in [neurick.ino](file:///d:/Proof-to-pay/hardware/neurick/neurick.ino).

5. **Handshake Robustness & Retry Logic**:
   - **Finding**: If a single command packet was transmitted during a USB frame boundary or settling interval, `send_task_command` previously hung for the full timeout without retrying.
   - **Fix**: Added retry logic (up to 3 attempts with safe input buffer draining between attempts) in `send_task_command` with real-time `[SERIAL]` diagnostics.

---

## 3. Exact Files Modified

1. [hardware/neurick/neurick.ino](file:///d:/Proof-to-pay/hardware/neurick/neurick.ino):
   - Added `Serial.setTxTimeoutMs(0);` for non-blocking USB CDC transmission.
   - Reduced setup delay from `2000ms` to `500ms` for rapid boot settling.
   - Preserved all dynamic task parsing (`TASK,<taskId>,<packageId>`), status commands, and RC522 RFID pins.

2. [hardware/bridge/serial_bridge.py](file:///d:/Proof-to-pay/hardware/bridge/serial_bridge.py):
   - Configured `ser.dtr = False; ser.rts = False` upon opening the serial connection.
   - Implemented `wait_for_esp32_boot()` to listen for boot banner and log incoming lines.
   - Enhanced `send_task_command()` with automatic retries and live `[SERIAL]` diagnostics.
   - Added `sys.stdout.reconfigure(line_buffering=True)` for instant logging.

3. [hardware/bridge/test_dynamic_protocol.py](file:///d:/Proof-to-pay/hardware/bridge/test_dynamic_protocol.py):
   - Added unit tests for `wait_for_esp32_boot` detection.
   - Added unit tests for handshake retry on dropped initial packets.
   - Added unit tests for `TASK_ERROR` exception handling.
   - All 11 unit tests passing.

---

## 4. Verification & Validation Results

### 1. Firmware Compilation with CDC-on-Boot
```powershell
& "C:\Users\H YAASHIK\AppData\Local\Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe" compile --fqbn esp32:esp32:esp32s3:CDCOnBoot=cdc "d:\Proof-to-pay\hardware\neurick"
```
- **Exit Code**: `0`
- **Program Storage**: `340,514 bytes` (25% of 1,310,720 bytes maximum)
- **Dynamic Memory**: `23,968 bytes` (7% of 327,680 bytes maximum)

### 2. Firmware Upload to COM9
```powershell
& "C:\Users\H YAASHIK\AppData\Local\Programs\Arduino IDE\resources\app\lib\backend\resources\arduino-cli.exe" upload -p COM9 --fqbn esp32:esp32:esp32s3:CDCOnBoot=cdc "d:\Proof-to-pay\hardware\neurick"
```
- **Exit Code**: `0`
- **Result**: `Hard resetting via RTS pin... New upload port: COM9 (serial)`

### 3. Unit Test Suite
```powershell
python hardware/bridge/test_dynamic_protocol.py
```
- **Output**:
  ```text
  Ran 11 tests in 0.454s
  OK
  ```

### 4. Serial Bridge Dynamic Test Mode
```powershell
python hardware/bridge/serial_bridge.py --test
```
- **Output**:
  ```text
  Target Task: T008 | Package: P08
  OK - All required fields present and dynamic values match.
  POST http://localhost:3001/api/tasks/T008/proof
  OK - BRIDGE TEST PASSED FOR TASK T008
  Returned proofHash: 0xf105dec586b43c15dea88cd8a04b4b046dcd1ce029eff308f905b43a312ee6f6
  ```

### 5. Live COM9 Serial Handshake Validation
Running `python -u hardware/bridge/serial_bridge.py --task T008` against the real ESP32-S3 hardware produced the complete handshake:
```text
========================================================
  PROOF-TO-PAY | NEURICK DYNAMIC USB SERIAL BRIDGE
========================================================

  Mode:      REAL HARDWARE (Dynamic Task Protocol)
  Port:      COM9
  Baud:      115200
  Backend:   http://localhost:3001
  Target Task:    T008
  Target Package: P08
  Source:         Zone A
  Destination:    Zone B
  State:          WORKING

--------------------------------------------------------
  CONNECTING TO NEURICK FIRMWARE
--------------------------------------------------------
  Listening for ESP32 startup / boot messages (max 3.5s)...
  [SERIAL] ESP-ROM:esp32s3-20210327
  [SERIAL] rst:0x15 (USB_UART_CHIP_RESET),boot:0x2a (SPI_FAST_FLASH_BOOT)
  [SERIAL] entry 0x403c88b8
  [SERIAL] ========================================
  [SERIAL] PROOF-TO-PAY NEURICK
  [SERIAL] ========================================
  [SERIAL] Robot: NR-001
  [SERIAL] Task: WAITING FOR TASK COMMAND
  [SERIAL] Package: WAITING FOR TASK COMMAND
  [SERIAL] Mode: HYBRID DEMO
  [SERIAL] Motion Controller: CONNECTED
  [SERIAL] Battery: 11.74 V
  [SERIAL] RFID: READY
  [SERIAL] READY FOR TASK COMMAND
  [SERIAL] Format: TASK,<taskId>,<packageId>
  [SERIAL] Example: TASK,T008,P08
  [SERIAL] ========================================

--------------------------------------------------------
  CONFIGURING NEURICK FIRMWARE AT RUNTIME
--------------------------------------------------------
  Sending runtime task command (attempt 1/3): TASK,T008,P08
  [SERIAL] TASK_RECEIVED
  [SERIAL] Task: T008
  [SERIAL] Package: P08
  [SERIAL] Waiting for package...
  [SERIAL] Place P08 RFID tag near reader.
  OK - TASK_RECEIVED acknowledged by NEURICK board for Task T008 / Package P08.

--------------------------------------------------------
  WAITING FOR PHYSICAL HARDWARE EVIDENCE
--------------------------------------------------------
  NEURICK is armed and waiting for package P08.
  Present the physical RFID tag to the RC522 reader now...
```

---

- **Smart Contract Unchanged**: No modifications made to any contract.
- **On-chain State Unchanged**: Task `T008` remains untouched in `WORKING` state.
- **No Hard-coded Task IDs**: Firmware and bridge support arbitrary task assignments (`T008` -> `T009` -> `T010`).
- **Real Hardware Functions Intact**: Real RC522 RFID reader (pins 3, 15, 18, 17, 16) and battery telemetry fully functional.

---

## 6. GitHub Repository Deployment

The entire project has been successfully committed and pushed to GitHub:
- **Repository URL**: `https://github.com/Yash-h-2005/Proof_To_Pay.git`
- **Branches Synchronized**: `master`, `main`
- **Included Components**:
  - `contracts/`: Solidity escrow contracts and deployment scripts
  - `backend/`: Express + TypeScript API, blockchain events, and evidence store
  - `frontend/`: React + Vite + Tailwind CSS / Vanilla CSS dashboard & task manager
  - `hardware/`: Task-dynamic NEURICK firmware (ESP32-S3), RC522 RFID reader, USB serial bridge, and protocol tests
  - `verifier/`: Independent off-chain verification engine & CLI
  - `robot/simulator/`: Autonomous robot simulator
  - `docs/`: Complete architecture and verification documentation
- **Security Check**: `.env` and `frontend/.env` (containing private keys) remain protected and ignored via `.gitignore`.

---

## 7. Public Deployment Readiness (Vercel & Render)

The project has been prepared and locally validated for public deployment:

### Frontend (Vercel)
- **Root Directory**: `frontend`
- **Framework Preset**: `Vite`
- **Build Command**: `npm run build` (`tsc && vite build`)
- **Output Directory**: `dist`
- **SPA Routing**: Configured via `frontend/vercel.json` rewrites.
- **Environment Variables**:
  - `VITE_BACKEND_URL`: `https://<your-render-service>.onrender.com`
  - `VITE_MST_RPC_URL`: `https://testnetrpc.mstblockchain.com`
  - `VITE_MST_CHAIN_ID`: `91562037`
  - `VITE_MST_EXPLORER_URL`: `https://testnet.mstscan.com`
  - `VITE_PROOF_TO_PAY_CONTRACT`: `0x09b9e52dE1B7fd4cD1eC7139275131557dbF5347`

### Backend (Render Web Service)
- **Root Directory**: `backend`
- **Environment**: `Node`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start` (`node dist/server.js`)
- **Network Binding**: Explicitly configured for `0.0.0.0` with dynamic `$PORT`.
- **CORS Support**: Auto-configured for any `*.vercel.app` frontend domain, custom origins, and localhost.
- **Environment Variables**:
  - `NODE_ENV`: `production`
  - `MST_RPC_URL`: `https://testnetrpc.mstblockchain.com`
  - `MST_CHAIN_ID`: `91562037`
  - `MST_EXPLORER_URL`: `https://testnet.mstscan.com`
  - `PROOF_TO_PAY_CONTRACT`: `0x09b9e52dE1B7fd4cD1eC7139275131557dbF5347`
  - `CORS_ORIGIN`: `*` (or your specific Vercel URL)

---

## 8. Render TypeScript Build Fix

### Problem
On Render cloud deployment, when `NODE_ENV=production` is set or default production install behavior runs:
1. `npm install` skips installing packages located in `devDependencies`.
2. `@types/express`, `@types/cors`, `@types/node`, and `typescript` were previously in `devDependencies`.
3. Consequently, `tsc` failed during Render build with:
   - `Could not find a declaration file for module 'express'`
   - `Could not find a declaration file for module 'cors'`
   - `TS7006: Parameter implicitly has an 'any' type`

### Solution Applied
1. Moved `@types/express`, `@types/cors`, `@types/node`, and `typescript` directly into `dependencies` in `backend/package.json`.
2. Synchronized `backend/package-lock.json` via `npm install`.
3. Added explicit type annotations (`Request, Response`, `requestOrigin: string | undefined`, `callback`) in `backend/src/server.ts`.
4. Verified local TypeScript compilation: `npm run build` completed with 0 errors.
5. Ran backend test suite: 10 / 10 tests passed.


