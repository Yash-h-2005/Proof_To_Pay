#include "RFIDReader.h"

RFIDReader::RFIDReader(uint8_t ss, uint8_t rst) : ssPin(ss), rstPin(rst), mfrc522(ss, rst) {}

bool RFIDReader::beginRFID() {
    SPI.begin(18, 16, 17, ssPin); // SCK=18, MISO=16, MOSI=17, SS=3
    mfrc522.PCD_Init();
    
    byte version = mfrc522.PCD_ReadRegister(mfrc522.VersionReg);
    if (version == 0x00 || version == 0xFF) {
        return false;
    }
    return true;
}

RFIDStatus RFIDReader::scanRFID() {
    if (!mfrc522.PICC_IsNewCardPresent()) {
        return NO_CARD;
    }
    if (!mfrc522.PICC_ReadCardSerial()) {
        return RFID_ERROR;
    }
    return CARD_DETECTED;
}

String RFIDReader::getUID() {
    String uidString = "";
    for (byte i = 0; i < mfrc522.uid.size; i++) {
        uidString += String(mfrc522.uid.uidByte[i] < 0x10 ? "0" : "");
        uidString += String(mfrc522.uid.uidByte[i], HEX);
        if (i < mfrc522.uid.size - 1) {
            uidString += ":";
        }
    }
    uidString.toUpperCase();
    mfrc522.PICC_HaltA();
    return uidString;
}
