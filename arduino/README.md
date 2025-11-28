# RFID Access Manager - Arduino

## Description

This project implements a simple RFID door lock system using an Arduino board and an RFID reader.
When a valid RFID card is scanned, the door lock is activated (unlocked) for a short period of time.
It also includes logging functionality to keep track of access attempts as well as a permission system for managing authorized users.

## Components Needed

- Arduino Uno
- RFID Reader (e.g., RFID-RC522) + RFID tags/cards
- Solenoid lock or electronic door lock
- 12V DC power adapter
- Relay module

## Wiring

<!-- Add wiring diagram here -->

TBD

## IDE Setup

1. Install the Arduino IDE from [_arduino.cc_](https://www.arduino.cc/en/software).
2. Set additional board manager URL:
   - In Arduino IDE go to **File -> Preferences**
   - In the "Additional Board Manager URLs" field, add the following URL:
   ```
   https://mcudude.github.io/MiniCore/package_MCUdude_MiniCore_index.json
   ```
3. Install the `RC522` and `SPI` libraries:
   - Go to **Sketch -> Include Library -> Manage Libraries**
   - Search for `MFRC522` and install it
   - Search for `SPI` and install it
4. Select the board and port:
   - Go to **Tools -> Board** and select your Arduino board
   - Go to **Tools -> Port** and select the appropriate COM port for your Arduino
