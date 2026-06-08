// User_Setup.h — Timbry NFC Reader
// Driver: ILI9488 480x320 SPI
// Board:  ESP32-WROOM-32

#define ILI9488_DRIVER

// Pin SPI display (condivide bus con RC522, CS separati)
#define TFT_MOSI  23
#define TFT_SCLK  18
#define TFT_CS    15
#define TFT_DC     2
#define TFT_RST    4
// TFT_MISO non definito: GPIO19 e' riservato a RC522

// Font caricati
#define LOAD_GLCD   // Adafruit GLCD 5x7, usato da setTextSize()
#define LOAD_GFXFF  // FreeFonts

// Velocita' SPI
#define SPI_FREQUENCY        27000000
#define SPI_READ_FREQUENCY   20000000
#define SPI_TOUCH_FREQUENCY   2500000
