#include <SPI.h>
#include <Ethernet.h>
#include <MFRC522.h>

// Konfiguracja Ethernet
byte mac[] = { 0x90, 0xA2, 0xDA, 0x10, 0x8F, 0x12 };
EthernetClient client;

// Piny SPI
#define ETHERNET_CS_PIN 10
#define RFID_RST_PIN 8
#define RFID_SS_PIN 9
#define SOLENOID_PIN 2

MFRC522 mfrc522(RFID_SS_PIN, RFID_RST_PIN);

// API - używamy PROGMEM dla oszczędzenia RAM
const char server[] PROGMEM = "rfid-access-manager.vercel.app";
const char scannerId[] PROGMEM = "7f3eeb72-5ca2-4e19-843c-dbedccaa3f00";  // ZMIEŃ!
const int httpPort = 80;

// Bufor ID karty
char lastCardID[20] = "";
char currentCardID[20] = "";
unsigned long lastCardTime = 0;

void setup() {
    Serial.begin(9600);
    
    pinMode(SOLENOID_PIN, OUTPUT);
    digitalWrite(SOLENOID_PIN, LOW);
    
    pinMode(ETHERNET_CS_PIN, OUTPUT);
    pinMode(RFID_SS_PIN, OUTPUT);
    digitalWrite(ETHERNET_CS_PIN, HIGH);
    digitalWrite(RFID_SS_PIN, HIGH);
    
    SPI.begin();
    
    // Init Ethernet
    digitalWrite(RFID_SS_PIN, HIGH);
    digitalWrite(ETHERNET_CS_PIN, LOW);
    delay(100);
    
    if (Ethernet.begin(mac) == 0) {
        IPAddress ip(192, 168, 1, 177);
        Ethernet.begin(mac, ip);
    }
    
    digitalWrite(ETHERNET_CS_PIN, HIGH);
    
    // Init RFID
    digitalWrite(ETHERNET_CS_PIN, HIGH);
    digitalWrite(RFID_SS_PIN, LOW);
    delay(100);
    
    mfrc522.PCD_Init();
    digitalWrite(RFID_SS_PIN, HIGH);
    
    Serial.println(F("Ready - przyloz karte"));
}

void loop() {
    // Aktywuj RFID
    digitalWrite(ETHERNET_CS_PIN, HIGH);
    digitalWrite(RFID_SS_PIN, LOW);
    delayMicroseconds(100);
    
    if (!mfrc522.PICC_IsNewCardPresent()) {
        digitalWrite(RFID_SS_PIN, HIGH);
        delay(50);
        return;
    }
    
    Serial.println(F("Karta wykryta!"));
    
    if (!mfrc522.PICC_ReadCardSerial()) {
        Serial.println(F("Blad odczytu"));
        digitalWrite(RFID_SS_PIN, HIGH);
        delay(50);
        return;
    }
    
    Serial.println(F("Karta odczytana"));
    
    // Odczytaj ID
    getCardID(currentCardID);
    
    mfrc522.PICC_HaltA();
    digitalWrite(RFID_SS_PIN, HIGH);
    
    // Sprawdź duplikat
    if (strcmp(currentCardID, lastCardID) == 0 && (millis() - lastCardTime) < 2000) {
        return;
    }
    
    strcpy(lastCardID, currentCardID);
    lastCardTime = millis();
    
    Serial.print(F("Token: "));
    Serial.println(currentCardID);
    
    // Aktywuj Ethernet
    digitalWrite(RFID_SS_PIN, HIGH);
    digitalWrite(ETHERNET_CS_PIN, LOW);
    delay(50);
    
    if (checkAccess(currentCardID)) {
        Serial.println(F("OK"));
        openDoor();
    } else {
        Serial.println(F("DENY"));
    }
    
    digitalWrite(ETHERNET_CS_PIN, HIGH);
    delay(100);
}

void getCardID(char* buffer) {
    buffer[0] = '\0';
    char hex[3];
    
    for (byte i = 0; i < mfrc522.uid.size; i++) {
        sprintf(hex, "%02X", mfrc522.uid.uidByte[i]);
        strcat(buffer, hex);
    }
}

bool checkAccess(char* cardID) {
    char serverBuf[40];
    strcpy_P(serverBuf, server);
    
    Serial.print(F("Laczenie: "));
    Serial.println(serverBuf);
    
    if (!client.connect(serverBuf, httpPort)) {
        Serial.println(F("Blad polaczenia"));
        return false;
    }
    
    Serial.println(F("Polaczono"));
    
    // POST request
    client.print(F("POST /api/v1/access HTTP/1.1\r\nHost: "));
    client.print(serverBuf);
    client.print(F("\r\nContent-Type: application/json\r\n"));
    
    // Długość JSON
    char scannerBuf[40];
    strcpy_P(scannerBuf, scannerId);
    int len = 24 + strlen(scannerBuf) + strlen(cardID);
    
    client.print(F("Content-Length: "));
    client.print(len);
    client.print(F("\r\nConnection: close\r\n\r\n"));
    
    // JSON body
    client.print(F("{\"scanner\":\""));
    client.print(scannerBuf);
    client.print(F("\",\"token\":\""));
    client.print(cardID);
    client.print(F("\"}"));
    
    Serial.println(F("Wyslano POST"));
    
    // Czekaj na odpowiedź
    unsigned long timeout = millis();
    while (!client.available()) {
        if (millis() - timeout > 10000) {
            Serial.println(F("Timeout"));
            client.stop();
            return false;
        }
    }
    
    Serial.println(F("Odpowiedz:"));
    
    // Parsuj odpowiedź
    bool inBody = false;
    bool granted = false;
    
    while (client.available()) {
        String line = client.readStringUntil('\n');
        
        if (line.length() <= 1) {
            inBody = true;
            continue;
        }
        
        if (inBody) {
            Serial.println(line);
            if (line.indexOf(F("\"granted\":true")) > -1) {
                granted = true;
            }
        }
    }
    
    client.stop();
    return granted;
}

void openDoor() {
    digitalWrite(SOLENOID_PIN, HIGH);
    delay(3000);
    digitalWrite(SOLENOID_PIN, LOW);
}