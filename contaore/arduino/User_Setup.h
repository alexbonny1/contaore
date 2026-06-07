// ─────────────────────────────────────────────────────────────────────────────
// timbry NFC Reader — TFT_eSPI User_Setup.h
// Target: ESP32-WROOM + ILI9488 480x320 (SPI)
//
// PIN MAP:
//   MOSI → GPIO 23   SCK  → GPIO 18
//   CS   → GPIO 15   DC   → GPIO 2
//   RST  → GPIO 4    BL   → GPIO 32  (gestito dal firmware, non da TFT_eSPI)
//
// ISTRUZIONI:
//   Copia questo file in:
//   <Arduino>/libraries/TFT_eSPI/User_Setup.h
//   (sovrascrive quello esistente)
// ─────────────────────────────────────────────────────────────────────────────

#define USER_SETUP_INFO "timbry_ILI9488_ESP32"

// ── Driver ───────────────────────────────────────────────────────────────────
// Se schermo bianco con ILI9488_DRIVER prova ILI9486_DRIVER (alcuni cloni)
#define ILI9488_DRIVER
//#define ILI9486_DRIVER

// ── Pin SPI (ESP32) ──────────────────────────────────────────────────────────
#define TFT_MOSI 23
#define TFT_SCLK 18
#define TFT_CS   15
#define TFT_DC    2
#define TFT_RST   4
// TFT_MISO non definito: non necessario per scrittura
// TFT_BL non definito:   il backlight (GPIO 32) è controllato dal firmware

// ── Font ─────────────────────────────────────────────────────────────────────
#define LOAD_GLCD
#define LOAD_FONT2
#define LOAD_FONT4
#define LOAD_FONT6
#define LOAD_FONT7
#define LOAD_FONT8
#define LOAD_GFXFF
#define SMOOTH_FONT

// ── SPI frequency ────────────────────────────────────────────────────────────
// ILI9488 max affidabile ~20MHz; abbassare se schermo bianco/corrotto
#define SPI_FREQUENCY      20000000
#define SPI_READ_FREQUENCY 16000000
