#ifndef HARDWARE_EVIDENCE_H
#define HARDWARE_EVIDENCE_H

#include <Arduino.h>
#include <ArduinoJson.h>

class HardwareEvidence {
public:
    String robotId;
    String taskId;
    String packageId;
    String source;
    String destination;
    unsigned long timestamp;
    String rfidUid;
    float distance;
    
    // Explicit simulation flag: true for Phase A hybrid (simulated movement)
    bool simulation;

    HardwareEvidence();
    void setTask(const String& newTaskId, const String& newPackageId, const String& newSource = "Zone A", const String& newDestination = "Zone B");
    void resetForNewTask();
    bool isConfigured() const;
    String toJson();
};

#endif
