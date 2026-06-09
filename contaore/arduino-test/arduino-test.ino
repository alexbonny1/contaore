/*
 * timbry TEST Firmware
 * ESP32-WROOM + RC522 + ILI9488 TFT 480x320 + Buzzer
 *
 * Sequenza di test:
 *   1. TEST DISPLAY  → cicla tutti i colori (1s ciascuno)
 *   2. TEST BUZZER   → scala di frequenze dal grave all'acuto
 *   3. TEST RFID     → aspetta tag, lo legge, visualizza UID e bip
 *                      poi torna ad aspettare (loop continuo)
 *
 * OTA: stessa logica del firmware principale — heartbeat ogni 60s
 *      verso il backend salvato in NVS; aggiorna se la versione
 *      restituita differisce da FW_VERSION.
 *
 * PIN MAP:
 *   TFT ILI9488:  MOSI→23 / SCK→18 / CS→15 / DC→2 / RST→4 / BL→32
 *   RC522:        MOSI→23 / MISO→19 / SCK→18 / SS→21 / RST→22
 *   BUZZER:       GPIO 33
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include <HTTPClient.h>
#include <HTTPUpdate.h>
#include <WiFiClientSecure.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>
#include <TFT_eSPI.h>

// ── PIN ──────────────────────────────
#define PIN_RC522_SS    21
#define PIN_RC522_RST   22
#define PIN_RC522_MISO  19
#define PIN_RC522_MOSI  23
#define PIN_RC522_SCK   18
#define BUZZER_PIN      33
#define TFT_BL_PIN      32

// ── CONFIG ───────────────────────────
#define FW_VERSION     "test-1.0"
#define PREF_NAMESPACE "timrbry"
#define HEARTBEAT_MS   60000UL

// ── COSTANTI COLORI ──────────────────
#define C_BLACK   0x0000
#define C_WHITE   0xFFFF
#define C_RED     0xF800
#define C_GREEN   0x07E0
#define C_BLUE    0x001F
#define C_YELLOW  0xFFE0
#define C_CYAN    0x07FF
#define C_MAGENTA 0xF81F
#define C_ORANGE  0xFC00
#define C_TIMBRY  0x051F
#define C_GRAY    0x8410
#define C_BORD    0x4000
#define C_TEAL    0x0410

// ── OGGETTI ──────────────────────────
MFRC522  rfid(PIN_RC522_SS, PIN_RC522_RST);
TFT_eSPI tft = TFT_eSPI();
Preferences prefs;

// ── STATO GLOBALE ────────────────────
char          g_uid[64];
unsigned long g_lastHeartbeat = 0;
String        g_backendUrl    = "";
String        g_readerId      = "";
bool          g_rfidOk        = false;

// ── TEST COLORI ──────────────────────
struct ColorEntry { uint16_t color; const char* name; };
static const ColorEntry COLORS[] = {
  { C_BLACK,   "NERO"       },
  { C_WHITE,   "BIANCO"     },
  { C_RED,     "ROSSO"      },
  { C_GREEN,   "VERDE"      },
  { C_BLUE,    "BLU"        },
  { C_YELLOW,  "GIALLO"     },
  { C_CYAN,    "CIANO"      },
  { C_MAGENTA, "MAGENTA"    },
  { C_ORANGE,  "ARANCIO"    },
  { C_TIMBRY,  "TIMBRY BLU" },
  { C_GRAY,    "GRIGIO"     },
  { C_BORD,    "BORDEAUX"   },
  { C_TEAL,    "TEAL"       },
};
#define COLOR_COUNT       13
#define COLOR_DURATION_MS 1200

// ── TEST BUZZER ──────────────────────
static const int BUZZER_FREQS[] = {
  200, 300, 400, 500, 700, 900, 1100, 1400, 1600,
  1800, 2000, 2200, 2500, 2800, 3200
};
#define BUZZER_FREQ_COUNT 15
#define BUZZER_STEP_MS    650

// ── FASI ─────────────────────────────
enum Phase { PHASE_COLOR, PHASE_BUZZER, PHASE_RFID };
Phase         g_phase      = PHASE_COLOR;
int           g_step       = 0;
unsigned long g_stepTimer  = 0;

// ─────────────────────────────────────
// UTILITÀ
// ─────────────────────────────────────

// Sceglie colore testo contrastante per qualsiasi sfondo RGB565
static uint16_t contrastColor(uint16_t bg) {
  uint8_t r = (bg >> 11) & 0x1F;
  uint8_t g = (bg >> 5)  & 0x3F;
  uint8_t b = (bg >> 0)  & 0x1F;
  uint32_t lum = r * 8 + g * 4 + b * 8;
  return (lum > 240) ? C_BLACK : C_WHITE;
}

void loadConfig() {
  prefs.begin(PREF_NAMESPACE, true);
  g_backendUrl = prefs.getString("backend", "");
  g_readerId   = prefs.getString("readerId", "");
  prefs.end();
}

// ─────────────────────────────────────
// RFID
// ─────────────────────────────────────
void rfidInit() {
  // TFT_eSPI ha già chiamato SPI.begin() — end+begin forza la
  // reinizializzazione completa includendo MISO (GPIO 19).
  SPI.end();
  delay(20);
  SPI.begin(PIN_RC522_SCK, PIN_RC522_MISO, PIN_RC522_MOSI, PIN_RC522_SS);

  pinMode(PIN_RC522_RST, OUTPUT);
  digitalWrite(PIN_RC522_RST, LOW);
  delay(10);
  digitalWrite(PIN_RC522_RST, HIGH);
  delay(50);

  // Fino a 3 tentativi: alcuni cloni RC522 hanno bisogno di più tempo
  for (int attempt = 1; attempt <= 3; attempt++) {
    rfid.PCD_Init();
    delay(100);
    byte v = rfid.PCD_ReadRegister(MFRC522::VersionReg);
    Serial.printf("RC522 tentativo %d: v=0x%02X\n", attempt, v);
    if (v != 0x00 && v != 0xFF) {
      g_rfidOk = true;
      Serial.println("RC522 OK");
      return;
    }
    delay(200);
  }
  Serial.println("RC522 WARN: non rilevato");
  g_rfidOk = false;
}

// ─────────────────────────────────────
// BUZZER
// ─────────────────────────────────────
void beepRead() {
  tone(BUZZER_PIN, 1800, 80);
  delay(100);
  tone(BUZZER_PIN, 2400, 80);
}

// ─────────────────────────────────────
// OTA
// ─────────────────────────────────────
static String resolveOtaUrl(const String& url) {
  const char* hdrKeys[] = {"Location"};
  String loc = "";
  if (url.startsWith("https")) {
    WiFiClientSecure c; c.setInsecure();
    HTTPClient h;
    if (h.begin(c, url)) {
      h.collectHeaders(hdrKeys, 1);
      int code = h.GET();
      if (code == 301 || code == 302 || code == 307 || code == 308)
        loc = h.header("Location");
      h.end();
    }
  } else {
    HTTPClient h;
    if (h.begin(url)) {
      h.collectHeaders(hdrKeys, 1);
      int code = h.GET();
      if (code == 301 || code == 302 || code == 307 || code == 308)
        loc = h.header("Location");
      h.end();
    }
  }
  Serial.printf("OTA URL: %s\n", loc.length() > 8 ? loc.c_str() : url.c_str());
  return (loc.length() > 8) ? loc : url;
}

void doOTA(const String& url, const String& newVersion) {
  Serial.printf("OTA: %s → %s\n", FW_VERSION, newVersion.c_str());
  tft.fillScreen(C_BLACK);
  tft.setTextColor(C_WHITE, C_BLACK); tft.setTextSize(2);
  tft.setCursor(40, 100); tft.print("Aggiornamento OTA");
  tft.setCursor(40, 130); tft.printf("Versione: %s", newVersion.c_str());
  tft.setCursor(40, 160); tft.print("Non spegnere...");

  String finalUrl = resolveOtaUrl(url);
  httpUpdate.rebootOnUpdate(true);
  t_httpUpdate_return ret;
  if (finalUrl.startsWith("https")) {
    WiFiClientSecure c; c.setInsecure();
    ret = httpUpdate.update(c, finalUrl);
  } else {
    WiFiClient c;
    ret = httpUpdate.update(c, finalUrl);
  }
  // Arriva qui solo se OTA fallita
  Serial.printf("OTA FALLITO (%d): %s\n",
    httpUpdate.getLastError(), httpUpdate.getLastErrorString().c_str());
  tft.fillScreen(C_BLACK);
  tft.setTextColor(C_RED, C_BLACK); tft.setTextSize(2);
  tft.setCursor(40, 140); tft.print("OTA FALLITO");
  delay(3000);
}

void taskHeartbeat() {
  if (millis() - g_lastHeartbeat < HEARTBEAT_MS) return;
  g_lastHeartbeat = millis();
  if (g_backendUrl.length() == 0 || WiFi.status() != WL_CONNECTED) return;

  char url[256];
  snprintf(url, sizeof(url), "%s/api/hardware/ping", g_backendUrl.c_str());
  String otaUrl = "", otaVersion = "";

  auto extract = [&](HTTPClient& h, int code) {
    if (code == 200) {
      StaticJsonDocument<256> doc;
      if (!deserializeJson(doc, h.getString())) {
        otaUrl     = doc["ota_url"]     | "";
        otaVersion = doc["ota_version"] | "";
      }
    }
  };

  if (g_backendUrl.startsWith("https")) {
    WiFiClientSecure c; c.setInsecure();
    HTTPClient h;
    if (h.begin(c, url)) {
      if (g_readerId.length() > 0) h.addHeader("X-Reader-Id", g_readerId);
      extract(h, h.GET()); h.end();
    }
  } else {
    HTTPClient h;
    if (h.begin(url)) {
      if (g_readerId.length() > 0) h.addHeader("X-Reader-Id", g_readerId);
      extract(h, h.GET()); h.end();
    }
  }

  if (otaUrl.length() > 0 && otaVersion.length() > 0 && otaVersion != FW_VERSION)
    doOTA(otaUrl, otaVersion);
}

// ─────────────────────────────────────
// TEST: DISPLAY COLORI
// ─────────────────────────────────────
void drawColorScreen(int idx) {
  uint16_t col  = COLORS[idx].color;
  uint16_t txt  = contrastColor(col);
  uint16_t acc  = (col == C_WHITE || col == C_YELLOW) ? C_BLUE : C_YELLOW;

  tft.fillScreen(col);
  tft.setTextColor(acc, col); tft.setTextSize(3);
  tft.setCursor(70, 80);
  tft.print("TEST DISPLAY");

  tft.setTextColor(txt, col); tft.setTextSize(4);
  tft.setCursor(120, 140);
  tft.print(COLORS[idx].name);

  tft.setTextColor(txt, col); tft.setTextSize(2);
  tft.setCursor(70, 220);
  tft.printf("%d / %d", idx + 1, COLOR_COUNT);
}

void startColorTest() {
  g_step      = 0;
  g_stepTimer = millis();
  drawColorScreen(0);
}

void runColorTest() {
  if (millis() - g_stepTimer < COLOR_DURATION_MS) return;
  g_step++;
  if (g_step >= COLOR_COUNT) {
    g_phase = PHASE_BUZZER;
    startBuzzerTest();
    return;
  }
  g_stepTimer = millis();
  drawColorScreen(g_step);
}

// ─────────────────────────────────────
// TEST: BUZZER FREQUENZE
// ─────────────────────────────────────
void drawBuzzerScreen(int idx) {
  tft.fillRect(0, 120, 480, 120, C_BLACK);
  tft.setTextColor(C_CYAN, C_BLACK); tft.setTextSize(3);
  tft.setCursor(60, 130);
  tft.printf("%d Hz", BUZZER_FREQS[idx]);

  tft.setTextColor(C_GRAY, C_BLACK); tft.setTextSize(2);
  tft.setCursor(60, 180);
  tft.printf("Step %d / %d", idx + 1, BUZZER_FREQ_COUNT);

  // Barra progresso
  int barW = (int)((float)(idx + 1) / BUZZER_FREQ_COUNT * 360);
  tft.fillRect(60, 215, 360, 12, C_GRAY);
  tft.fillRect(60, 215, barW, 12, C_TIMBRY);
}

void startBuzzerTest() {
  g_step      = 0;
  g_stepTimer = millis();

  tft.fillScreen(C_BLACK);
  tft.setTextColor(C_YELLOW, C_BLACK); tft.setTextSize(3);
  tft.setCursor(80, 60);
  tft.print("TEST BUZZER");
  tft.setTextColor(C_WHITE, C_BLACK); tft.setTextSize(2);
  tft.setCursor(80, 105);
  tft.print("Scala di frequenze...");

  drawBuzzerScreen(0);
  tone(BUZZER_PIN, BUZZER_FREQS[0], 500);
}

void runBuzzerTest() {
  if (millis() - g_stepTimer < BUZZER_STEP_MS) return;
  g_step++;
  if (g_step >= BUZZER_FREQ_COUNT) {
    g_phase = PHASE_RFID;
    startRfidTest();
    return;
  }
  g_stepTimer = millis();
  drawBuzzerScreen(g_step);
  tone(BUZZER_PIN, BUZZER_FREQS[g_step], 500);
}

// ─────────────────────────────────────
// TEST: RFID READER
// ─────────────────────────────────────
void startRfidTest() {
  tft.fillScreen(C_BLACK);

  tft.setTextColor(C_TIMBRY, C_BLACK); tft.setTextSize(4);
  tft.setCursor(100, 50);
  tft.print("TEST RFID");

  tft.setTextColor(C_WHITE, C_BLACK); tft.setTextSize(2);
  tft.setCursor(50, 135);
  tft.print("Avvicina un tag NFC...");

  tft.setTextColor(C_GRAY, C_BLACK); tft.setTextSize(2);
  tft.setCursor(50, 165);
  tft.print("(qualsiasi tessera/tag)");

  // Icona pulsante
  tft.drawRoundRect(170, 215, 140, 50, 8, C_TIMBRY);
  tft.setTextColor(C_TIMBRY, C_BLACK); tft.setTextSize(2);
  tft.setCursor(193, 232);
  tft.print("IN ATTESA");

  if (!g_rfidOk) {
    tft.setTextColor(C_RED, C_BLACK); tft.setTextSize(1);
    tft.setCursor(50, 290);
    tft.print("ATTENZIONE: RC522 non rilevato");
  }
}

void runRfidTest() {
  if (!rfid.PICC_IsNewCardPresent()) return;
  if (!rfid.PICC_ReadCardSerial())   return;

  // Leggi UID
  g_uid[0] = '\0';
  for (byte i = 0; i < rfid.uid.size; i++) {
    char hex[5];
    snprintf(hex, sizeof(hex), "%02X", rfid.uid.uidByte[i]);
    strlcat(g_uid, hex, sizeof(g_uid));
  }
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  Serial.printf("TAG LETTO: %s\n", g_uid);
  beepRead();

  // Schermata risultato
  tft.fillScreen(C_GREEN);
  tft.setTextColor(C_BLACK, C_GREEN); tft.setTextSize(5);
  tft.setCursor(60, 60);
  tft.print("LETTO!");

  tft.setTextColor(C_BLACK, C_GREEN); tft.setTextSize(2);
  tft.setCursor(60, 150);
  tft.print("UID:");
  tft.setTextSize(3);
  tft.setCursor(60, 178);
  tft.print(g_uid);

  tft.setTextSize(2);
  tft.setCursor(60, 240);
  tft.setTextColor(0x0200, C_GREEN);
  tft.print("Avvicina ancora per rileggere");

  delay(3000);

  // Torna ad aspettare
  startRfidTest();
}

// ─────────────────────────────────────
// SETUP
// ─────────────────────────────────────
void setup() {
  Serial.begin(115200);
  Serial.printf("\n=== TIMBRY TEST v%s ===\n", FW_VERSION);

  pinMode(TFT_BL_PIN, OUTPUT);
  digitalWrite(TFT_BL_PIN, HIGH);

  tft.init();
  tft.setRotation(1);
  tft.fillScreen(C_BLACK);

  // Schermata di avvio
  tft.setTextColor(C_TIMBRY, C_BLACK); tft.setTextSize(5);
  tft.setCursor(100, 80);
  tft.print("TIMBRY");
  tft.setTextColor(C_WHITE, C_BLACK); tft.setTextSize(2);
  tft.setCursor(100, 148);
  tft.print("TEST FIRMWARE  v");
  tft.print(FW_VERSION);
  tft.setTextColor(C_GRAY, C_BLACK); tft.setTextSize(1);
  tft.setCursor(100, 175);
  tft.print("Display • Buzzer • RFID");
  delay(1800);

  // Buzzer pin idle (come nel firmware principale)
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  // RFID — feedback visivo durante i tentativi
  tft.fillScreen(C_BLACK);
  tft.setTextColor(C_WHITE, C_BLACK); tft.setTextSize(2);
  tft.setCursor(60, 130);
  tft.print("Inizializzo RC522...");
  rfidInit();
  if (g_rfidOk) {
    tft.setTextColor(C_GREEN, C_BLACK);
    tft.setCursor(60, 160);
    tft.print("RC522 OK");
  } else {
    tft.setTextColor(C_YELLOW, C_BLACK);
    tft.setCursor(60, 160);
    tft.print("RC522 non risponde — controlla cablaggio");
  }
  delay(1500);

  // WiFi
  tft.fillScreen(C_BLACK);
  tft.setTextColor(C_WHITE, C_BLACK); tft.setTextSize(2);
  tft.setCursor(60, 140);
  tft.print("Connessione WiFi...");

  WiFiManager wm;
  wm.setConfigPortalTimeout(120);
  wm.setSaveConfigCallback([]() {});
  if (!wm.autoConnect("timbry-test")) {
    tft.setTextColor(C_YELLOW, C_BLACK); tft.setTextSize(2);
    tft.setCursor(60, 175);
    tft.print("Nessun WiFi — OTA disabilitato");
    delay(2000);
  } else {
    tft.setTextColor(C_GREEN, C_BLACK); tft.setTextSize(2);
    tft.setCursor(60, 175);
    tft.print("WiFi OK: ");
    tft.print(WiFi.localIP().toString().c_str());
    delay(1500);
  }

  loadConfig();

  // Avvia sequenza test
  g_phase = PHASE_COLOR;
  startColorTest();
}

// ─────────────────────────────────────
// LOOP
// ─────────────────────────────────────
void loop() {
  switch (g_phase) {
    case PHASE_COLOR:  runColorTest();  break;
    case PHASE_BUZZER: runBuzzerTest(); break;
    case PHASE_RFID:   runRfidTest();   break;
  }
  taskHeartbeat();
}
