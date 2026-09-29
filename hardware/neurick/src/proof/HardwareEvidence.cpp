#include "HardwareEvidence.h"

HardwareEvidence::HardwareEvidence() {
    robotId = "NR-001";
    taskId = "";
    packageId = "";
    source = "Zone A";
    destination = "Zone B";
    timestamp = 0;
    rfidUid = "";
    distance = 0.0;
    simulation = true; // explicitly hybrid demo with simulated movement
}

void HardwareEvidence::setTask(const String& newTaskId, const String& newPackageId, const String& newSource, const String& newDestination) {
    taskId = newTaskId;
    packageId = newPackageId;
    if (newSource.length() > 0) source = newSource;
    if (newDestination.length() > 0) destination = newDestination;
    resetForNewTask();
}

void HardwareEvidence::resetForNewTask() {
    timestamp = 0;
    rfidUid = "";
    distance = 0.0;
}

bool HardwareEvidence::isConfigured() const {
    return taskId.length() > 0 && packageId.length() > 0;
}

String HardwareEvidence::toJson() {
    StaticJsonDocument<512> doc;
    doc["taskId"] = taskId;
    doc["robotId"] = robotId;
    doc["packageId"] = packageId;
    doc["source"] = source;
    doc["destination"] = destination;
    doc["timestamp"] = timestamp;
    doc["rfidUid"] = rfidUid;
    doc["distance"] = distance;
    doc["gps"] = nullptr; // no GPS data
    doc["simulation"] = simulation;
    
    String output;
    serializeJson(doc, output);
    return output;
}
