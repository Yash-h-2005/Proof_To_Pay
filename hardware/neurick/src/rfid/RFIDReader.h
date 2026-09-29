#ifndef RFID_READER_H
#define RFID_READER_H

#include <SPI.h>
#include <MFRC522.h>
#include <Arduino.h>

enum RFIDStatus {
    NO_CARD,
    CARD_DETECTED,
    RFID_ERROR
};

class RFIDReader {
private:
    MFRC522 mfrc522;
    uint8_t ssPin;
    uint8_t rstPin;

public:
    RFIDReader(uint8_t ss = 3, uint8_t rst = 15);
    bool beginRFID();
    RFIDStatus scanRFID();
    String getUID();
};

#endif
