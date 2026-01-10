#include <SPI.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <MFRC522.h>

const char* ssid = "NAZWA_WIFI";
const char* password = "HASLO_DO_WIFI";

#define RFID_SS_PIN    4
#define RFID_RST_PIN   3
#define SOLENOID_PIN   2

MFRC522 mfrc522(RFID_SS_PIN, RFID_RST_PIN);
WiFiClientSecure client;

const char* server = "rfid-access-manager.vercel.app";
const char* scannerId = "7f3eeb72-5ca2-4e19-843c-dbedccaa3f00";
const int httpsPort = 443;

char lastCardID[20] = "";
char currentCardID[20] = "";
unsigned long lastCardTime = 0;

void setup() {
    Serial.begin(9600);
    delay(1000);
    
    Serial.println("\n=== RFID Access Control - HTTPS ===\n");
    
    pinMode(SOLENOID_PIN, OUTPUT);
    digitalWrite(SOLENOID_PIN, LOW);
    
    SPI.begin(8, 9, 10, RFID_SS_PIN);
    mfrc522.PCD_Init();
    
    Serial.print("Laczenie z WiFi...");
    WiFi.begin(ssid, password);
    
    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 30) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    
    if (WiFi.status() == WL_CONNECTED) {
        Serial.println(" OK");
        Serial.print("IP: ");
        Serial.println(WiFi.localIP());
    } else {
        Serial.println(" BLAD!");
    }
    
    client.setInsecure();
    
    Serial.println("\nSystem gotowy - przyloz karte RFID\n");
}

void loop() {
    if (!mfrc522.PICC_IsNewCardPresent()) {
        delay(50);
        return;
    }
    
    if (!mfrc522.PICC_ReadCardSerial()) {
        delay(50);
        return;
    }
    
    getCardID(currentCardID);
    mfrc522.PICC_HaltA();
    mfrc522.PCD_StopCrypto1();
    delay(100);
    
    if (strcmp(currentCardID, lastCardID) == 0 && (millis() - lastCardTime) < 2000) {
        return;
    }
    
    strcpy(lastCardID, currentCardID);
    lastCardTime = millis();
    
    Serial.print("\n[KARTA] Token: ");
    Serial.println(currentCardID);
    
    if (checkAccess(currentCardID)) {
        Serial.println("[DOSTEP] Przyznany!");
        openDoor();
    } else {
        Serial.println("[DOSTEP] Odmowiony!");
    }
    
    mfrc522.PCD_Init();
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
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("BLAD: WiFi rozlaczone!");
        return false;
    }
    
    Serial.print("Sprawdzanie dostepu...");
    
    if (!client.connect(server, httpsPort)) {
        Serial.println(" BLAD polaczenia!");
        return false;
    }
    
    String jsonBody = "{\"scanner\":\"";
    jsonBody += scannerId;
    jsonBody += "\",\"token\":\"";
    jsonBody += cardID;
    jsonBody += "\"}";
    
    client.print("POST /api/v1/access HTTP/1.1\r\n");
    client.print("Host: ");
    client.print(server);
    client.print("\r\n");
    client.print("Content-Type: application/json\r\n");
    client.print("Content-Length: ");
    client.print(jsonBody.length());
    client.print("\r\n");
    client.print("Connection: close\r\n\r\n");
    client.print(jsonBody);
    
    unsigned long timeout = millis();
    while (!client.available()) {
        if (millis() - timeout > 10000) {
            Serial.println(" Timeout!");
            client.stop();
            return false;
        }
        delay(10);
    }
    
    bool inBody = false;
    bool granted = false;
    
    while (client.available()) {
        String line = client.readStringUntil('\n');
        
        if (line.length() <= 1) {
            inBody = true;
            continue;
        }
        
        if (inBody && line.indexOf("\"granted\":true") > -1) {
            granted = true;
        }
    }
    
    client.stop();
    Serial.println(granted ? " OK" : " ODMOWA");
    return granted;
}

void openDoor() {
    Serial.println("Otwieranie drzwi...");
    digitalWrite(SOLENOID_PIN, HIGH);
    delay(3000);
    digitalWrite(SOLENOID_PIN, LOW);
    Serial.println("Zamknieto\n");
}