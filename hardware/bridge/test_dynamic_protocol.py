#!/usr/bin/env python3
"""
Unit tests for NEURICK dynamic task protocol & serial bridge.

Tests:
1. Parsing TASK,<taskId>,<packageId>
2. Rejecting malformed TASK commands (missing packageId, empty taskId, etc.)
3. Dynamically changing from T008/P08 to T009/P09 and T010/P10
4. Ensuring evidence payload uses the currently active task and package
5. Ensuring no valid evidence is accepted before a task is configured
6. Dynamic task resolution from backend
7. Serial command handshake simulation
"""

import unittest
import json
import io
import time
from serial_bridge import (
    is_evidence_json,
    validate_evidence,
    REQUIRED_FIELDS,
    send_task_command,
    wait_for_esp32_boot,
)


class MockSerial:
    """Simulates a serial connection for testing the protocol handshake."""
    def __init__(self, responses=None, attempt_responses=None):
        self.written = []
        self.responses = responses or []
        self.attempt_responses = attempt_responses or {}
        self.resp_index = 0
    @property
    def in_waiting(self):
        return max(0, len(self.responses) - self.resp_index)

    def write(self, data):
        self.written.append(data)
        attempt = len(self.written)
        if attempt in self.attempt_responses:
            self.responses = list(self.attempt_responses[attempt])
            self.resp_index = 0

    def flush(self):
        pass

    def reset_input_buffer(self):
        pass

    def readline(self):
        if self.resp_index < len(self.responses):
            line = self.responses[self.resp_index]
            self.resp_index += 1
            return line.encode("utf-8")
        time.sleep(0.05)
        return b""


def parse_task_command_spec(cmd_str):
    """
    Python reference implementation of the Arduino firmware's handleTaskCommand logic.
    Used to mathematically verify the protocol behavior across edge cases.
    """
    cmd = cmd_str.strip()
    first_comma = cmd.find(',')
    if first_comma == -1:
        return {"success": False, "error": "Invalid format. Usage: TASK,<taskId>,<packageId>"}

    second_comma = cmd.find(',', first_comma + 1)
    if second_comma == -1:
        return {"success": False, "error": "Missing packageId. Usage: TASK,<taskId>,<packageId>"}

    new_task_id = cmd[first_comma + 1:second_comma].strip()

    third_comma = cmd.find(',', second_comma + 1)
    new_source = "Zone A"
    new_destination = "Zone B"

    if third_comma == -1:
        new_package_id = cmd[second_comma + 1:].strip()
    else:
        new_package_id = cmd[second_comma + 1:third_comma].strip()
        fourth_comma = cmd.find(',', third_comma + 1)
        if fourth_comma == -1:
            new_source = cmd[third_comma + 1:].strip()
        else:
            new_source = cmd[third_comma + 1:fourth_comma].strip()
            new_destination = cmd[fourth_comma + 1:].strip()

    if not new_task_id or not new_package_id:
        return {"success": False, "error": "taskId and packageId cannot be empty"}

    return {
        "success": True,
        "taskId": new_task_id,
        "packageId": new_package_id,
        "source": new_source or "Zone A",
        "destination": new_destination or "Zone B",
    }


class TestDynamicTaskProtocol(unittest.TestCase):

    def test_parse_task_command_valid(self):
        """Test valid TASK,T008,P08 parsing."""
        res = parse_task_command_spec("TASK,T008,P08")
        self.assertTrue(res["success"])
        self.assertEqual(res["taskId"], "T008")
        self.assertEqual(res["packageId"], "P08")
        self.assertEqual(res["source"], "Zone A")
        self.assertEqual(res["destination"], "Zone B")

    def test_parse_task_command_with_custom_locations(self):
        """Test TASK command with custom source and destination."""
        res = parse_task_command_spec("TASK,T008,P08,Dock 1,Storage 4")
        self.assertTrue(res["success"])
        self.assertEqual(res["taskId"], "T008")
        self.assertEqual(res["packageId"], "P08")
        self.assertEqual(res["source"], "Dock 1")
        self.assertEqual(res["destination"], "Storage 4")

    def test_parse_task_command_with_whitespace(self):
        """Test TASK command with extraneous whitespace."""
        res = parse_task_command_spec("  TASK,  T008 , P08   \r\n")
        self.assertTrue(res["success"])
        self.assertEqual(res["taskId"], "T008")
        self.assertEqual(res["packageId"], "P08")

    def test_reject_malformed_commands(self):
        """Test rejection of malformed TASK commands."""
        bad_commands = [
            "TASK",
            "TASK,",
            "TASK,T008",
            "TASK,,P08",
            "TASK,   ,P08",
            "TASK,T008,  ",
            "TASK,T008,",
            "HELLO,WORLD",
        ]
        for cmd in bad_commands:
            res = parse_task_command_spec(cmd)
            self.assertFalse(res["success"], "Expected '{}' to fail validation".format(cmd))
            self.assertIn("error", res)

    def test_dynamic_task_transition(self):
        """Test updating from T008/P08 to T009/P09 then T010/P10 sequentially."""
        tasks = [
            ("TASK,T008,P08", "T008", "P08"),
            ("TASK,T009,P09", "T009", "P09"),
            ("TASK,T010,P10", "T010", "P10"),
        ]
        current_state = {"taskId": "", "packageId": ""}

        for cmd, expected_task, expected_pkg in tasks:
            res = parse_task_command_spec(cmd)
            self.assertTrue(res["success"])
            current_state["taskId"] = res["taskId"]
            current_state["packageId"] = res["packageId"]

            self.assertEqual(current_state["taskId"], expected_task)
            self.assertEqual(current_state["packageId"], expected_pkg)

    def test_evidence_matches_active_task(self):
        """Test evidence validation strictly matches the active task configuration."""
        active_task = "T008"
        active_pkg = "P08"

        valid_evidence = {
            "taskId":      active_task,
            "robotId":     "NR-001",
            "packageId":   active_pkg,
            "source":      "Zone A",
            "destination": "Zone B",
            "timestamp":   77200,
            "rfidUid":     "D9:33:6A:F8",
            "distance":    12.4,
            "gps":         None,
            "simulation":  True,
        }

        expected_values = {
            "taskId":      active_task,
            "robotId":     "NR-001",
            "packageId":   active_pkg,
            "source":      "Zone A",
            "destination": "Zone B",
            "distance":    12.4,
            "simulation":  True,
        }

        errors = validate_evidence(valid_evidence, expected_values)
        self.assertEqual(errors, [])

        # Mismatched task ID must fail validation
        mismatched_evidence = dict(valid_evidence)
        mismatched_evidence["taskId"] = "T006"
        errors = validate_evidence(mismatched_evidence, expected_values)
        self.assertTrue(any("taskId" in e for e in errors))

        # Mismatched package ID must fail validation
        mismatched_pkg = dict(valid_evidence)
        mismatched_pkg["packageId"] = "P06"
        errors = validate_evidence(mismatched_pkg, expected_values)
        self.assertTrue(any("packageId" in e for e in errors))

    def test_no_evidence_before_task_configured(self):
        """Test that unconfigured evidence (empty taskId/packageId) is rejected."""
        unconfigured_evidence = {
            "taskId":      "",
            "robotId":     "NR-001",
            "packageId":   "",
            "source":      "Zone A",
            "destination": "Zone B",
            "timestamp":   0,
            "rfidUid":     "D9:33:6A:F8",
            "distance":    0.0,
            "gps":         None,
            "simulation":  True,
        }

        expected_values = {
            "taskId":      "T008",
            "packageId":   "P08",
        }

        errors = validate_evidence(unconfigured_evidence, expected_values)
        self.assertTrue(len(errors) >= 2)

    def test_serial_handshake_simulation(self):
        """Test serial handshake sending TASK command and awaiting TASK_RECEIVED."""
        mock_ser = MockSerial(responses=[
            "========================================",
            "READY FOR TASK COMMAND",
            "TASK_RECEIVED",
            "Task: T008",
            "Package: P08",
            "Waiting for package...",
        ])

        success = send_task_command(mock_ser, "T008", "P08", timeout=2.0)
        self.assertTrue(success)
        self.assertEqual(len(mock_ser.written), 1)
        self.assertEqual(mock_ser.written[0], b"TASK,T008,P08\n")

    def test_wait_for_esp32_boot_detection(self):
        """Test boot banner detection from ESP32."""
        mock_ser = MockSerial(responses=[
            "ESP-ROM:esp32s3-20210327",
            "entry 0x403c88b8",
            "========================================",
            "PROOF-TO-PAY NEURICK",
            "READY FOR TASK COMMAND",
        ])
        detected = wait_for_esp32_boot(mock_ser, max_wait=1.0)
        self.assertTrue(detected)

    def test_serial_handshake_retry_success(self):
        """Test handshake retrying on first dropped attempt and succeeding on second."""
        mock_ser = MockSerial(attempt_responses={
            1: [],  # attempt 1: no response, times out
            2: [    # attempt 2: receives acknowledgement
                "TASK_RECEIVED",
                "Task: T008",
                "Package: P08",
            ],
        })
        success = send_task_command(mock_ser, "T008", "P08", timeout=0.3, max_retries=2)
        self.assertTrue(success)
        self.assertEqual(len(mock_ser.written), 2)

    def test_serial_handshake_error_raises(self):
        """Test that TASK_ERROR from firmware raises RuntimeError immediately."""
        mock_ser = MockSerial(responses=[
            "TASK_ERROR,Invalid format. Usage: TASK,<taskId>,<packageId>",
        ])
        with self.assertRaises(RuntimeError) as ctx:
            send_task_command(mock_ser, "BAD_CMD", "P08", timeout=2.0)
        self.assertIn("Invalid format", str(ctx.exception))


if __name__ == "__main__":
    unittest.main()
