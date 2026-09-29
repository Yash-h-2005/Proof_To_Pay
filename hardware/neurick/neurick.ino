#include <Arduino.h>
#include <Newrick.h>
#include "src/telemetry/Telemetry.h"
#include "src/rfid/RFIDReader.h"
#include "src/proof/HardwareEvidence.h"

Newrick nr;
Telemetry telemetry(&nr);
RFIDReader rfidReader(3, 15); // SS=3, RST=15
HardwareEvidence evidence;

String serialBuffer = "";
bool hasActiveTask = false;
bool taskCompleted = false;

void handleTaskCommand(String cmd) {
    cmd.trim();
    // Format: TASK,<taskId>,<packageId>[,<source>,<destination>]
    int firstComma = cmd.indexOf(',');
    if (firstComma == -1) {
        Serial.println("TASK_ERROR,Invalid format. Usage: TASK,<taskId>,<packageId>");
        return;
    }

    int secondComma = cmd.indexOf(',', firstComma + 1);
    if (secondComma == -1) {
        Serial.println("TASK_ERROR,Missing packageId. Usage: TASK,<taskId>,<packageId>");
        return;
    }

    String newTaskId = cmd.substring(firstComma + 1, secondComma);
    newTaskId.trim();

    String newPackageId = "";
    String newSource = "Zone A";
    String newDestination = "Zone B";

    int thirdComma = cmd.indexOf(',', secondComma + 1);
    if (thirdComma == -1) {
        newPackageId = cmd.substring(secondComma + 1);
        newPackageId.trim();
    } else {
        newPackageId = cmd.substring(secondComma + 1, thirdComma);
        newPackageId.trim();
        int fourthComma = cmd.indexOf(',', thirdComma + 1);
        if (fourthComma == -1) {
            newSource = cmd.substring(thirdComma + 1);
            newSource.trim();
        } else {
            newSource = cmd.substring(thirdComma + 1, fourthComma);
            newSource.trim();
            newDestination = cmd.substring(fourthComma + 1);
            newDestination.trim();
        }
    }

    if (newTaskId.length() == 0 || newPackageId.length() == 0) {
        Serial.println("TASK_ERROR,taskId and packageId cannot be empty");
        return;
    }

    evidence.setTask(newTaskId, newPackageId, newSource, newDestination);
    hasActiveTask = true;
    taskCompleted = false;

    Serial.println("TASK_RECEIVED");
    Serial.print("Task: ");
    Serial.println(evidence.taskId);
    Serial.print("Package: ");
    Serial.println(evidence.packageId);
    Serial.println("Waiting for package...");
    Serial.print("Place ");
    Serial.print(evidence.packageId);
    Serial.println(" RFID tag near reader.");
}

void processSerialInput() {
    while (Serial.available() > 0) {
        char c = (char)Serial.read();
        if (c == '\n' || c == '\r') {
            if (serialBuffer.length() > 0) {
                serialBuffer.trim();
                if (serialBuffer.startsWith("TASK,") || serialBuffer.startsWith("TASK ")) {
                    handleTaskCommand(serialBuffer);
                } else if (serialBuffer.equalsIgnoreCase("PING")) {
                    Serial.println("PONG");
                } else if (serialBuffer.equalsIgnoreCase("STATUS")) {
                    Serial.print("STATUS,");
                    Serial.print(hasActiveTask ? "ACTIVE," : "IDLE,");
                    Serial.print(taskCompleted ? "COMPLETED," : "PENDING,");
                    Serial.print(evidence.taskId.length() > 0 ? evidence.taskId : "NONE");
                    Serial.print(",");
                    Serial.println(evidence.packageId.length() > 0 ? evidence.packageId : "NONE");
                } else if (serialBuffer.startsWith("TASK")) {
                    Serial.println("TASK_ERROR,Invalid format. Usage: TASK,<taskId>,<packageId>");
                }
                // Unknown commands safely ignored
                serialBuffer = "";
            }
        } else {
            if (serialBuffer.length() < 128) {
                serialBuffer += c;
            }
        }
    }
}

void setup() {
    Serial.begin(115200);
    // Non-blocking TX timeout on ESP32-S3 USB CDC ensures prints never hang
    Serial.setTxTimeoutMs(0);
    delay(500);

    Serial.println("========================================");
    Serial.println("      PROOF-TO-PAY NEURICK              ");
    Serial.println("========================================");
    Serial.println("");
    Serial.println("Robot: NR-001");
    Serial.println("Task: WAITING FOR TASK COMMAND");
    Serial.println("Package: WAITING FOR TASK COMMAND");
    Serial.println("");
    Serial.println("Mode:");
    Serial.println("HYBRID DEMO");
    Serial.println("");
    Serial.println("Real:");
    Serial.println("- NEURICK controller");
    Serial.println("- Battery telemetry");
    Serial.println("- RFID detection");
    Serial.println("");
    Serial.println("Simulated:");
    Serial.println("- Robot movement");
    Serial.println("- Encoder distance");
    Serial.println("");
    Serial.println("Simulation flag: TRUE");
    Serial.println("========================================");
    Serial.println("");

    // Init motion controller
    if (telemetry.begin()) {
        Serial.println("Motion Controller:\nCONNECTED");
        Serial.print("\nBattery:\n");
        Serial.print(telemetry.getBatteryVolts(), 2);
        Serial.println(" V");
    } else {
        Serial.println("Motion Controller:\nNO REPLY");
    }

    // Init RFID
    if (rfidReader.beginRFID()) {
        Serial.println("\nRFID:\nREADY");
    } else {
        Serial.println("\nRFID:\nERROR");
    }
    
    Serial.println("----------------------------------------");
    Serial.println("READY FOR TASK COMMAND");
    Serial.println("Format: TASK,<taskId>,<packageId>");
    Serial.println("Example: TASK,T008,P08");
    Serial.println("========================================");
}

void loop() {
    telemetry.update();
    processSerialInput();

    if (!hasActiveTask || !evidence.isConfigured() || taskCompleted) {
        delay(50);
        return;
    }

    RFIDStatus status = rfidReader.scanRFID();
    if (status == CARD_DETECTED) {
        String uid = rfidReader.getUID();
        evidence.rfidUid = uid;

        Serial.println("");
        Serial.println("RFID TAG DETECTED");
        Serial.print("UID: ");
        Serial.println(uid);
        Serial.println("");
        Serial.println("PHYSICAL RFID PROOF: YES");
        Serial.println("");
        Serial.println("Starting simulated movement...");
        Serial.println("");

        // Simulated movement progression: 0.0 to 12.4 m
        const float distanceSteps[] = {0.0, 2.0, 4.0, 6.0, 8.0, 10.0, 12.0, 12.4};
        const int numSteps = sizeof(distanceSteps) / sizeof(distanceSteps[0]);

        for (int i = 0; i < numSteps; i++) {
            evidence.distance = distanceSteps[i];
            Serial.print("Distance: ");
            Serial.print(distanceSteps[i], 1);
            Serial.println(" m");
            delay(600); // pacing between distance intervals
            processSerialInput(); // allow serial command interrupts
        }

        evidence.distance = 12.4;
        evidence.timestamp = millis();
        taskCompleted = true;

        Serial.println("");
        Serial.println("========================================");
        Serial.println("DESTINATION REACHED");
        Serial.println("========================================");
        Serial.println("");
        Serial.print("Destination: ");
        Serial.println(evidence.destination);
        Serial.println("Distance: 12.4 m");
        Serial.println("");
        Serial.println("RFID: REAL");
        Serial.println("Movement: SIMULATED");
        Serial.println("Simulation: TRUE");
        Serial.println("");
        Serial.println("========================================");
        Serial.println("FINAL HARDWARE EVIDENCE");
        Serial.println("========================================");
        Serial.println(evidence.toJson());
        Serial.println("========================================");
        Serial.println("TASK_COMPLETED");
        Serial.println("Waiting for next task command (TASK,<taskId>,<packageId>)...");
    }
}
