#ifndef TELEMETRY_H
#define TELEMETRY_H

#include <Newrick.h>
#include <Arduino.h>

class Telemetry {
private:
    Newrick* nr;

public:
    Telemetry(Newrick* neurick);
    bool begin();
    bool update();
    float getBatteryVolts();
    int getButtonState();
};

#endif
