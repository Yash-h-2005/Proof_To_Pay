#include "Telemetry.h"

Telemetry::Telemetry(Newrick* neurick) : nr(neurick) {}

bool Telemetry::begin() {
    nr->begin();
    return nr->updateSensors();
}

bool Telemetry::update() {
    return nr->updateSensors();
}

float Telemetry::getBatteryVolts() {
    return nr->batteryVolts;
}

int Telemetry::getButtonState() {
    return nr->buttonState;
}
