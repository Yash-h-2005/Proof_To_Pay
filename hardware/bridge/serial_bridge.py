#!/usr/bin/env python3
"""
Proof-to-Pay - NEURICK Dynamic USB Serial Bridge
Connects the physical NEURICK ESP32-S3 robot controller to the Proof-to-Pay backend.

Architecture:
    Proof-to-Pay Backend (Current Task: e.g. T008, P08)
          |
          |  Query active task (GET /api/tasks/:id)
          v
    serial_bridge.py
          |
          |  TASK,<taskId>,<packageId>
          v
    NEURICK ESP32-S3 (Receives task at runtime)
          |
          |  RC522 RFID scan + simulated movement
          v
    serial_bridge.py (Detects evidence JSON)
          |
          |  POST /api/tasks/:taskId/proof
          v
    Proof-to-Pay Backend (Canonical hash, proofStore)
          |
          v
    Independent Verifier -> MST Blockchain

CONSTRAINTS:
- Transport adapter ONLY. Does NOT modify sensor evidence.
- Does NOT submit any blockchain transaction.
- Does NOT call submitProof(), verifyTask(), or releasePayment().
- simulation=true is forwarded exactly as produced by firmware.
- Does NOT hard-code any task or package IDs.

Usage:
    # Auto-detect latest active/working task from backend (e.g. T008):
    python hardware/bridge/serial_bridge.py

    # Target a specific task:
    python hardware/bridge/serial_bridge.py --task T008

    # Test mode (no COM9 needed - uses simulated fixture for current task):
    python hardware/bridge/serial_bridge.py --test
    python hardware/bridge/serial_bridge.py --test --task T008
"""

import sys
import json
import time
import argparse
import urllib.request
import urllib.error

# Ensure stdout flushes immediately when piped or redirected
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(line_buffering=True)

# --- Default Configuration ----------------------------------------------------

DEFAULT_COM_PORT    = "COM9"
DEFAULT_BAUD_RATE   = 115200
DEFAULT_BACKEND_URL = "http://localhost:3001"
DEFAULT_TIMEOUT     = 120

REQUIRED_FIELDS = [
    "taskId", "robotId", "packageId", "source",
    "destination", "timestamp", "rfidUid", "distance",
    "gps", "simulation",
]

# --- Helpers -----------------------------------------------------------------

def banner(title):
    width = 56
    print("=" * width)
    print("  " + title)
    print("=" * width)


def section(title):
    print("\n" + "-" * 56)
    print("  " + title)
    print("-" * 56)


def fetch_task_from_backend(backend_url, requested_task_id=None):
    """
    Fetch task details dynamically from backend.
    If requested_task_id is given, queries GET /api/tasks/:id.
    If requested_task_id is None, queries GET /api/tasks and picks the latest
    WORKING (state=3) or ASSIGNED (state=2) task.
    """
    if requested_task_id:
        url = "{}/api/tasks/{}".format(backend_url.rstrip("/"), requested_task_id)
        req = urllib.request.Request(url, headers={"Accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                if data.get("success") and "data" in data:
                    return data["data"]
                raise ValueError("Backend returned invalid response for task {}: {}".format(requested_task_id, data))
        except urllib.error.HTTPError as exc:
            raise ValueError("Task {} not found on backend (HTTP {})".format(requested_task_id, exc.code))
        except Exception as exc:
            raise RuntimeError("Failed to connect to backend at {}: {}".format(url, exc))

    # Auto-detect from all tasks
    url = "{}/api/tasks".format(backend_url.rstrip("/"))
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            tasks = data.get("data", [])
    except Exception as exc:
        raise RuntimeError("Failed to connect to backend at {}: {}".format(url, exc))

    if not tasks:
        raise ValueError("No tasks registered on backend. Create a task first.")

    # Prioritize WORKING state (3)
    working_tasks = [t for t in tasks if t.get("state") == 3]
    if working_tasks:
        return working_tasks[-1]

    # Next check ASSIGNED state (2)
    assigned_tasks = [t for t in tasks if t.get("state") == 2]
    if assigned_tasks:
        return assigned_tasks[-1]

    # Fallback to latest task
    return tasks[-1]


def wait_for_esp32_boot(ser, max_wait=3.0):
    """
    Wait for ESP32 boot/startup output and print diagnostic lines.
    Returns True if boot banner or READY FOR TASK was observed.
    """
    start_time = time.time()
    boot_detected = False
    print("  Listening for ESP32 startup / boot messages (max {}s)...".format(max_wait))
    while time.time() - start_time < max_wait:
        if hasattr(ser, "in_waiting") and ser.in_waiting == 0:
            time.sleep(0.05)
            continue
        try:
            raw = ser.readline()
        except Exception:
            break
        if not raw:
            continue
        line = raw.decode("utf-8", errors="replace").strip()
        if not line:
            continue
        print("  [SERIAL] " + line)
        if "READY FOR TASK" in line or "PROOF-TO-PAY NEURICK" in line:
            boot_detected = True
            time.sleep(0.1)
            # Drain any trailing lines from startup
            if hasattr(ser, "in_waiting"):
                while ser.in_waiting > 0:
                    extra = ser.readline()
                    if extra:
                        extra_line = extra.decode("utf-8", errors="replace").strip()
                        if extra_line:
                            print("  [SERIAL] " + extra_line)
            break
    return boot_detected


def send_task_command(ser, task_id, package_id, timeout=8.0, max_retries=3):
    """
    Send TASK,<taskId>,<packageId> command to NEURICK board over serial
    and await TASK_RECEIVED acknowledgement.
    Includes automatic retry if board does not acknowledge within retry interval.
    """
    command = "TASK,{},{}\n".format(task_id, package_id)
    per_attempt_timeout = max(0.1, timeout / max(1, max_retries))

    for attempt in range(1, max_retries + 1):
        if hasattr(ser, "reset_input_buffer"):
            ser.reset_input_buffer()

        if max_retries > 1:
            print("  Sending runtime task command (attempt {}/{}): {}".format(attempt, max_retries, command.strip()))
        else:
            print("  Sending runtime task command: {}".format(command.strip()))

        ser.write(command.encode("utf-8"))
        ser.flush()

        start_time = time.time()
        while time.time() - start_time < per_attempt_timeout:
            raw = ser.readline()
            if not raw:
                continue
            line = raw.decode("utf-8", errors="replace").strip()
            if not line:
                continue
            print("  [SERIAL] " + line)
            if "TASK_RECEIVED" in line:
                # Consume trailing confirmation lines if available
                time.sleep(0.1)
                if hasattr(ser, "in_waiting"):
                    while ser.in_waiting > 0:
                        conf_raw = ser.readline()
                        if conf_raw:
                            conf_line = conf_raw.decode("utf-8", errors="replace").strip()
                            if conf_line:
                                print("  [SERIAL] " + conf_line)
                return True
            if "TASK_ERROR" in line:
                raise RuntimeError("NEURICK returned task error: " + line)

    raise TimeoutError("Timed out waiting for TASK_RECEIVED acknowledgement from NEURICK board after {} attempts.".format(max_retries))


def is_evidence_json(line):
    """
    Try to parse a serial line as JSON evidence.
    Returns parsed dict if all required fields are present, else None.
    """
    line = line.strip()
    if not line.startswith("{"):
        return None
    try:
        data = json.loads(line)
    except (json.JSONDecodeError, ValueError):
        return None
    for field in REQUIRED_FIELDS:
        if field not in data:
            return None
    return data


def validate_evidence(data, expected_values):
    """
    Validate evidence dict against expected_values.
    Returns list of error strings (empty = OK).
    """
    errors = []
    for field, expected in expected_values.items():
        actual = data.get(field)
        if isinstance(expected, float):
            if not isinstance(actual, (int, float)) or abs(float(actual) - expected) > 0.001:
                errors.append("  {}: expected {!r}, got {!r}".format(field, expected, actual))
        else:
            if actual != expected:
                errors.append("  {}: expected {!r}, got {!r}".format(field, expected, actual))
    return errors


def print_evidence_summary(data):
    section("HARDWARE EVIDENCE DETECTED")
    print("  Task:        " + str(data.get("taskId")))
    print("  Robot:       " + str(data.get("robotId")))
    print("  Package:     " + str(data.get("packageId")))
    print("  Source:      " + str(data.get("source")))
    print("  Destination: " + str(data.get("destination")))
    print("  Timestamp:   " + str(data.get("timestamp")))
    print("  RFID UID:    " + str(data.get("rfidUid")))
    print("  Distance:    " + str(data.get("distance")) + " m")
    print("  GPS:         " + str(data.get("gps")))
    print("  Simulation:  " + str(data.get("simulation")))
    print()
    print("  NOTE: Physical RC522 RFID read UID: " + str(data.get("rfidUid")))


def post_evidence(backend_url, task_id, data):
    """POST evidence to backend. Returns parsed JSON response."""
    url = "{}/api/tasks/{}/proof".format(backend_url.rstrip("/"), task_id)
    payload = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "Accept":       "application/json",
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        raw = resp.read().decode("utf-8")
        return json.loads(raw)


def print_backend_response(resp):
    section("BACKEND RESPONSE")
    if resp.get("success"):
        print("  OK  success: true")
        print("  taskId:     " + str(resp.get("taskId")))
        print("  proofHash:  " + str(resp.get("proofHash")))
        print()
        print("  canonicalData:")
        try:
            cdata = json.loads(resp.get("canonicalData", "{}"))
            print("    " + json.dumps(cdata, indent=2))
        except Exception:
            print("    " + str(resp.get("canonicalData")))
        print()
        print("  note: " + str(resp.get("note")))
    else:
        print("  ERROR: Backend returned error:")
        print("  " + str(resp))


# --- Test Mode ---------------------------------------------------------------

def run_test_mode(backend_url=DEFAULT_BACKEND_URL, requested_task_id=None):
    """
    Test mode: bypasses COM9.
    Constructs dynamic fixture JSON for the active task and POSTs to backend.
    """
    banner("PROOF-TO-PAY | SERIAL BRIDGE | TEST MODE")
    print()
    print("  Mode:      LOCAL TEST (no physical hardware required)")
    print("  Backend:   " + backend_url)

    # Fetch active task details from backend
    try:
        task_data = fetch_task_from_backend(backend_url, requested_task_id)
        task_id = task_data.get("taskId", "T008")
        package_id = task_data.get("packageId", "P08")
        source = task_data.get("source", "Zone A")
        destination = task_data.get("destination", "Zone B")
    except Exception as exc:
        print("  Notice: Could not fetch from backend ({}), using defaults.".format(exc))
        task_id = requested_task_id or "T008"
        package_id = "P" + task_id.lstrip("T") if task_id.startswith("T") else "P08"
        source = "Zone A"
        destination = "Zone B"

    print("  Active Task:    " + task_id)
    print("  Active Package: " + package_id)
    print()

    # Dynamic fixture matching exact hardware evidence output
    test_fixture = {
        "taskId":      task_id,
        "robotId":     "NR-001",
        "packageId":   package_id,
        "source":      source,
        "destination": destination,
        "timestamp":   77200,
        "rfidUid":     "D9:33:6A:F8",
        "distance":    12.4,
        "gps":         None,
        "simulation":  True,
    }

    expected_values = {
        "taskId":      task_id,
        "robotId":     "NR-001",
        "packageId":   package_id,
        "source":      source,
        "destination": destination,
        "distance":    12.4,
        "simulation":  True,
    }

    print("  Dynamic fixture evidence:")
    print("  " + json.dumps(test_fixture, indent=4))

    section("VALIDATING FIXTURE")
    errors = validate_evidence(test_fixture, expected_values)
    if errors:
        print("  FAIL - Validation failed:")
        for e in errors:
            print(e)
        sys.exit(1)
    print("  OK - All required fields present and dynamic values match.")

    print_evidence_summary(test_fixture)

    section("POSTING TO BACKEND")
    print("  POST " + backend_url + "/api/tasks/" + task_id + "/proof")
    print()
    try:
        resp = post_evidence(backend_url, task_id, test_fixture)
    except urllib.error.URLError as exc:
        print("  ERROR: HTTP request failed: " + str(exc.reason))
        print("  Ensure backend is running: cd backend && npm run dev")
        sys.exit(1)
    except Exception as exc:
        print("  ERROR: Unexpected error: " + str(exc))
        sys.exit(1)

    print_backend_response(resp)

    if resp.get("success"):
        section("TEST RESULT")
        print("  OK - BRIDGE TEST PASSED FOR TASK " + task_id)
        print()
        print("  Returned proofHash:")
        print("    " + str(resp.get("proofHash")))
        print()
        print("  To run off-chain verification now:")
        print("    cd verifier && npm run verify -- " + task_id)
        print()
    else:
        section("TEST RESULT")
        print("  FAIL - BRIDGE TEST FAILED: backend returned error")
        sys.exit(1)


# --- Real Hardware Mode -------------------------------------------------------

def run_hardware_mode(port=DEFAULT_COM_PORT, baud_rate=DEFAULT_BAUD_RATE,
                      backend_url=DEFAULT_BACKEND_URL, requested_task_id=None,
                      timeout_seconds=DEFAULT_TIMEOUT):
    """
    Real hardware mode:
    1. Fetches current active task from backend.
    2. Opens COM port at 115200 baud.
    3. Sends TASK,<taskId>,<packageId> command to NEURICK board.
    4. Awaits TASK_RECEIVED acknowledgement.
    5. Reads hardware evidence JSON upon physical RFID detection.
    6. Validates evidence against the active task.
    7. POSTs evidence to backend proof store.
    """
    try:
        import serial
    except ImportError:
        print("ERROR: pyserial not installed.")
        print("Install:  python -m pip install pyserial")
        sys.exit(1)

    banner("PROOF-TO-PAY | NEURICK DYNAMIC USB SERIAL BRIDGE")
    print()
    print("  Mode:      REAL HARDWARE (Dynamic Task Protocol)")
    print("  Port:      " + port)
    print("  Baud:      " + str(baud_rate))
    print("  Backend:   " + backend_url)

    # 1. Fetch current task dynamically from backend
    try:
        task_data = fetch_task_from_backend(backend_url, requested_task_id)
    except Exception as exc:
        print("\nERROR: Could not resolve active task from backend: {}".format(exc))
        sys.exit(1)

    task_id = task_data.get("taskId")
    package_id = task_data.get("packageId")
    source = task_data.get("source", "Zone A")
    destination = task_data.get("destination", "Zone B")

    if not task_id or not package_id:
        print("\nERROR: Resolved task has invalid taskId or packageId: {}".format(task_data))
        sys.exit(1)

    print("  Target Task:    " + str(task_id))
    print("  Target Package: " + str(package_id))
    print("  Source:         " + str(source))
    print("  Destination:    " + str(destination))
    print("  State:          " + str(task_data.get("stateLabel", task_data.get("state"))))
    print()
    print("  REQUIREMENTS CHECKLIST:")
    print("    [ ] Arduino Serial Monitor is CLOSED")
    print("    [ ] NEURICK ESP32-S3 is connected via USB (" + port + ")")
    print("    [ ] Backend is running on " + backend_url)
    print()

    # 2. Open serial connection
    try:
        ser = serial.Serial(
            port=port,
            baudrate=baud_rate,
            timeout=1,
            bytesize=serial.EIGHTBITS,
            parity=serial.PARITY_NONE,
            stopbits=serial.STOPBITS_ONE,
        )
        # Prevent ESP32-S3 auto-reset circuit from being held in reset
        ser.dtr = False
        ser.rts = False
    except serial.SerialException as exc:
        print("ERROR: Cannot open " + port + ": " + str(exc))
        print("  Possible causes:")
        print("    - Arduino Serial Monitor is still open (close it first)")
        print("    - NEURICK USB is disconnected")
        print("    - COM port changed (check Device Manager)")
        print()
        print("  To test without hardware, run:")
        print("    python hardware/bridge/serial_bridge.py --test")
        sys.exit(1)

    try:
        section("CONNECTING TO NEURICK FIRMWARE")
        wait_for_esp32_boot(ser, max_wait=3.5)

        section("CONFIGURING NEURICK FIRMWARE AT RUNTIME")
        send_task_command(ser, task_id, package_id, timeout=9.0, max_retries=3)
        print("  OK - TASK_RECEIVED acknowledged by NEURICK board for Task {} / Package {}.".format(task_id, package_id))

        # 4. Wait for physical evidence JSON
        section("WAITING FOR PHYSICAL HARDWARE EVIDENCE")
        print("  NEURICK is armed and waiting for package " + package_id + ".")
        print("  Present the physical RFID tag to the RC522 reader now...")
        print()

        evidence_data = None
        start_time = time.time()

        while True:
            if time.time() - start_time > timeout_seconds:
                print("\nERROR: Timeout after {}s - no evidence JSON received.".format(timeout_seconds))
                print("    Did you present the RFID tag to the RC522 reader?")
                sys.exit(1)

            try:
                raw_bytes = ser.readline()
            except serial.SerialException as exc:
                print("\nERROR: Serial read error: " + str(exc))
                sys.exit(1)

            if not raw_bytes:
                continue

            try:
                line = raw_bytes.decode("utf-8", errors="replace").rstrip()
            except Exception:
                continue

            if not line:
                continue

            print("  [SERIAL] " + line)

            parsed = is_evidence_json(line)
            if parsed is not None:
                evidence_data = parsed
                print()
                print("  *** Physical hardware evidence JSON detected! ***")
                break

    finally:
        ser.close()

    if evidence_data is None:
        print("ERROR: No valid evidence JSON detected.")
        sys.exit(1)

    # 5. Validate evidence matches the dynamically configured task
    expected_values = {
        "taskId":      task_id,
        "robotId":     "NR-001",
        "packageId":   package_id,
        "source":      source,
        "destination": destination,
        "distance":    12.4,
        "simulation":  True,
    }

    section("VALIDATING EVIDENCE")
    errors = validate_evidence(evidence_data, expected_values)
    if errors:
        print("  FAIL - Evidence validation failed:")
        for e in errors:
            print(e)
        print()
        print("  Raw JSON: " + json.dumps(evidence_data))
        sys.exit(1)
    print("  OK - All required fields present and dynamic values validated.")

    print_evidence_summary(evidence_data)

    # 6. POST to backend
    section("POSTING TO BACKEND")
    print("  POST " + backend_url + "/api/tasks/" + task_id + "/proof")
    print()
    try:
        resp = post_evidence(backend_url, task_id, evidence_data)
    except urllib.error.URLError as exc:
        print("  ERROR: HTTP POST failed: " + str(exc.reason))
        print("  Ensure backend is running: cd backend && npm run dev")
        sys.exit(1)
    except Exception as exc:
        print("  ERROR: Unexpected error: " + str(exc))
        sys.exit(1)

    print_backend_response(resp)

    if resp.get("success"):
        section("BRIDGE COMPLETE")
        print("  OK - Evidence successfully bridged from real hardware to backend.")
        print()
        print("  proofHash: " + str(resp.get("proofHash")))
        print()
        print("  --- Next: Off-chain Verification ---")
        print("  Run from verifier/ directory:")
        print("    cd verifier")
        print("    npm run verify -- " + task_id)
        print()
        print("  --- Then On-chain Submission ---")
        print("  Visit the frontend at http://localhost:5173/task/" + task_id)
        print("  and click 'Submit Proof to Blockchain'.")
        print()
    else:
        section("BRIDGE FAILED")
        print("  FAIL - Backend returned an error. Evidence NOT stored.")
        sys.exit(1)


# --- Entry Point -------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        prog="serial_bridge.py",
        description=(
            "Proof-to-Pay NEURICK Dynamic USB Serial Bridge.\n"
            "Configures NEURICK board for the active task, reads evidence, and POSTs to backend.\n\n"
            "Use --test to run without physical hardware (fixture mode)."
        ),
    )
    parser.add_argument(
        "--task",
        dest="task_id",
        default=None,
        help="Target task ID (e.g. T008). If omitted, auto-detects current active task from backend.",
    )
    parser.add_argument(
        "--port",
        dest="port",
        default=DEFAULT_COM_PORT,
        help="USB serial port for NEURICK (default: {}).".format(DEFAULT_COM_PORT),
    )
    parser.add_argument(
        "--baud",
        dest="baud_rate",
        type=int,
        default=DEFAULT_BAUD_RATE,
        help="Baud rate (default: {}).".format(DEFAULT_BAUD_RATE),
    )
    parser.add_argument(
        "--backend",
        dest="backend_url",
        default=DEFAULT_BACKEND_URL,
        help="Backend URL (default: {}).".format(DEFAULT_BACKEND_URL),
    )
    parser.add_argument(
        "--test",
        action="store_true",
        help="Test mode: use dynamic test fixture, no COM9 required.",
    )
    args = parser.parse_args()

    if args.test:
        run_test_mode(backend_url=args.backend_url, requested_task_id=args.task_id)
    else:
        run_hardware_mode(
            port=args.port,
            baud_rate=args.baud_rate,
            backend_url=args.backend_url,
            requested_task_id=args.task_id,
        )


if __name__ == "__main__":
    main()
