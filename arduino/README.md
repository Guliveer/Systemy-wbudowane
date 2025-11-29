# Arduino RFID Access Control System

System kontroli dostępu oparty na Arduino z czytnikiem RFID i komunikacją HTTP z API.

⚠️ **Problemy z RFID?** Zobacz szczegółowy przewodnik: **[TROUBLESHOOTING.md](TROUBLESHOOTING.md:1)**

## Wymagane komponenty sprzętowe

- Arduino (Uno, Mega lub inny z obsługą Ethernet)
- Ethernet Shield (W5100/W5500)
- Czytnik RFID MFRC522
- Solenoid (elektrozamek)
- Moduł przekaźnika (do sterowania solenoidem)
- Karta/tag RFID

## Schemat podłączenia

### MFRC522 (czytnik RFID)
- SDA (SS) → Pin 9 (WAŻNE: NIE pin 10!)
- SCK → Pin 13
- MOSI → Pin 11
- MISO → Pin 12
- IRQ → Nie podłączone
- GND → GND
- RST → Pin 8
- 3.3V → 3.3V (WAŻNE: NIE podłączaj do 5V!)

### Ethernet Shield
- Podłącz bezpośrednio na Arduino (używa SPI)
- Pin 10 → ZAWSZE używany przez Ethernet (hardware requirement)
- Podłącz kabel Ethernet

**⚠️ UWAGA - Konflikt SPI:**
RFID i Ethernet Shield używają tej samej magistrali SPI. Aby uniknąć konfliktów:
- Ethernet MUSI używać pin 10 (sprzętowy wymóg)
- RFID MUSI używać inny pin (w tym projekcie: pin 9)
- Kod automatycznie zarządza aktywacją/deaktywacją każdego urządzenia

### Solenoid
- Sterowanie → Pin 2 (przez przekaźnik)
- Zasilanie → Zewnętrzne zasilanie (12V/24V zależnie od solenoidu)
- GND → Wspólna masa z Arduino

## Wymagane biblioteki Arduino

Zainstaluj następujące biblioteki przez Arduino IDE (Sketch → Include Library → Manage Libraries):

1. **MFRC522** (by GithubCommunity)
   - Do obsługi czytnika RFID

2. **Ethernet** (wbudowana)
   - Do obsługi komunikacji Ethernet

3. **SPI** (wbudowana)
   - Do komunikacji SPI

## Instalacja bibliotek

W Arduino IDE:
1. Otwórz: Sketch → Include Library → Manage Libraries
2. Wyszukaj i zainstaluj: **MFRC522**
3. Biblioteki Ethernet i SPI są już wbudowane

## Konfiguracja

1. Otwórz [`ArduinoProject.ino`](ArduinoProject.ino:1) w Arduino IDE
2. W razie potrzeby zmień adres MAC w linii 9:
   ```cpp
   byte mac[] = { 0x90, 0xA2, 0xDA, 0x10, 0x8F, 0x12 };
   ```
3. Opcjonalnie dostosuj piny w liniach 9-12:
   ```cpp
   #define ETHERNET_CS_PIN 10  // NIE ZMIENIAJ - wymagane przez Ethernet Shield
   #define RFID_RST_PIN 8
   #define RFID_SS_PIN 9       // MUSI być inny niż 10!
   #define SOLENOID_PIN 2
   ```

## Jak działa zarządzanie SPI

Ponieważ RFID i Ethernet używają tej samej magistrali SPI, kod implementuje mechanizm wzajemnego wykluczania:

1. **W setup():**
   - Inicjalizuje oba piny CS (Chip Select)
   - Dezaktywuje oba urządzenia (HIGH)
   - Inicjalizuje Ethernet, potem RFID - po kolei

2. **W loop():**
   - Aktywuje RFID (LOW) → odczytuje kartę → dezaktywuje (HIGH)
   - Aktywuje Ethernet (LOW) → wysyła request → dezaktywuje (HIGH)
   - W danym momencie tylko jedno urządzenie jest aktywne

## Jak to działa

1. System inicjalizuje połączenie Ethernet (DHCP) i czytnik RFID
2. Gdy zbliżysz kartę RFID do czytnika:
   - Arduino odczytuje ID karty (np. "A1B2C3D4")
   - Wysyła żądanie POST przez HTTP do API: `http://rfid-access-manager.vercel.app/api/v1/access`
   - API sprawdza czy karta jest autoryzowana
3. Jeśli dostęp jest przyznany:
   - Solenoid zostaje otwarty na 3 sekundy
   - Na Serial Monitor wyświetla się "Dostep PRZYZNANY!"
4. Jeśli dostęp jest odmówiony:
   - Solenoid pozostaje zamknięty
   - Na Serial Monitor wyświetla się "Dostep ODMOWIONY!"

## Format API

**Endpoint:** `POST http://rfid-access-manager.vercel.app/api/v1/access`

**Uwaga:** Standardowy Arduino Ethernet Shield nie obsługuje HTTPS natywnie. Jeśli API wymaga HTTPS, potrzebujesz:
- Arduino z WiFiClientSecure (ESP8266/ESP32)
- Lub dodatkowej biblioteki SSL dla Ethernet (np. SSLClient z certyfikatami)

**Request Body:**
```json
{
  "rfidTag": "A1B2C3D4"
}
```

**Response (dostęp przyznany):**
```json
{
  "granted": true,
  "message": "Access granted"
}
```

**Response (dostęp odmówiony):**
```json
{
  "granted": false,
  "message": "Access denied"
}
```

## Testowanie i diagnostyka

**WAŻNE:** Kod ma wbudowaną diagnostykę! Otwórz Serial Monitor (9600 baud) aby zobaczyć szczegółowe logi.

Co powinno się wyświetlać:
- `[DEBUG] Petla dziala... Czekam na karte...` - system działa, czeka na kartę
- `[DEBUG] Wykryto obecnosc karty!` - czytnik wykrył kartę
- `[DEBUG] Karta odczytana pomyslnie!` - dane karty odczytane
- `Wykryto karte RFID: XXXXXXXX` - wyświetlone ID karty

Jeśli nie widzisz tych komunikatów, sprawdź **[TROUBLESHOOTING.md](TROUBLESHOOTING.md:1)**

## Testowanie

1. Wgraj kod na Arduino
2. Otwórz Serial Monitor (9600 baud)
3. Poczekaj na komunikat "Czytnik RFID gotowy"
4. Przyłóż kartę RFID do czytnika
5. Obserwuj komunikaty w Serial Monitor

## Przykładowe ID kart do testów

System odczytuje rzeczywiste ID z kart RFID. Przykładowe formaty ID:
- `A1B2C3D4`
- `1A2B3C4D`
- `DEADBEEF`

## Szybkie rozwiązywanie problemów

💡 **Szczegółowy przewodnik:** [TROUBLESHOOTING.md](TROUBLESHOOTING.md:1)

## Najczęstsze problemy

### Błąd: "Failed to configure Ethernet using DHCP"
- Sprawdź podłączenie Ethernet Shield
- Upewnij się, że kabel Ethernet jest podłączony do routera z DHCP

### Błąd: "NIE MOZNA POLACZYC Z SERWEREM!"
- Sprawdź połączenie internetowe i kabel Ethernet
- Sprawdź czy router ma włączony DHCP
- Sprawdź adres IP Arduino w Serial Monitor
- Sprawdź czy możesz pingować Arduino z komputera
- Jeśli API wymaga HTTPS, rozważ użycie ESP8266/ESP32 zamiast Arduino Uno

### Czytnik RFID nie reaguje
- **NAJCZĘSTSZY PROBLEM:** Pin SS (SDA) musi być na pin 9, NIE na pin 10!
- Sprawdź podłączenie wszystkich pinów według schematu
- Upewnij się, że czytnik jest zasilany 3.3V (NIE 5V!)
- Sprawdź czy karta jest kompatybilna (MIFARE Classic 1K, 4K, Ultralight)
- W Serial Monitor sprawdź czy widzisz "[ OK ] Czytnik RFID" podczas startu
- Jeśli widzisz błędy inicjalizacji SPI, sprawdź połączenia MOSI/MISO/SCK

### Ethernet i RFID się "gryzą"
- To normalny problem gdy oba używają SPI
- Kod już zawiera rozwiązanie (kontrola pinów CS)
- Upewnij się, że RFID używa pin 9, a Ethernet pin 10
- NIE używaj pin 10 dla RFID - to spowoduje konflikt!

### Solenoid nie otwiera się
- Sprawdź podłączenie przekaźnika
- Upewnij się, że solenoid ma odpowiednie zewnętrzne zasilanie
- Sprawdź czy przekaźnik działa (powinna być słyszalna kliknięcie)

## Uwagi bezpieczeństwa

⚠️ **WAŻNE:**
- NIE podłączaj solenoidu bezpośrednio do Arduino - użyj przekaźnika
- Użyj zewnętrznego zasilania dla solenoidu (12V lub 24V)
- Upewnij się, że masa (GND) Arduino i zewnętrznego zasilania są połączone
- W środowisku produkcyjnym rozważ dodanie dodatkowych zabezpieczeń (np. timeout, alarm)

## Licencja

Ten projekt jest udostępniony jako open source do celów edukacyjnych.