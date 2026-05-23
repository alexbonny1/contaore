/*
 * ContaOre NFC Reader Firmware
 * ESP32-WROOM + RC522 + ILI9488 TFT 480x320 + Buzzer
 * v1.0.0
 *
 * PIN MAP:
 * ─────────────────────────────────────
 * TFT ILI9488 (SPI)
 *   MOSI  → GPIO 23
 *   SCK   → GPIO 18
 *   CS    → GPIO 15
 *   DC    → GPIO 2
 *   RST   → GPIO 4
 *   BL    → GPIO 32
 *
 * RC522 RFID (SPI condiviso)
 *   MOSI  → GPIO 23
 *   MISO  → GPIO 19
 *   SCK   → GPIO 18
 *   SS    → GPIO 21
 *   RST   → GPIO 22
 *
 * BUZZER (attivo o passivo)
 *   +     → GPIO 33
 *   -     → GND
 * ─────────────────────────────────────
 *
 * LIBRERIE NECESSARIE (Library Manager):
 *   - TFT_eSPI  (Bodmer)
 *   - MFRC522
 *   - WiFiManager (tzapu)
 *   - ArduinoJson
 *
 * IMPORTANTE: configurare TFT_eSPI
 * nel file User_Setup.h scegliere:
 *   #define ILI9488_DRIVER
 *   #define TFT_MOSI 23
 *   #define TFT_SCLK 18
 *   #define TFT_CS   15
 *   #define TFT_DC   2
 *   #define TFT_RST  4
 *   #define SPI_FREQUENCY 27000000
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WiFiManager.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <Preferences.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>
#include <TFT_eSPI.h>
#include <time.h>

/*
────────────────────────────────────
PIN
────────────────────────────────────
*/

#define RC522_SS    21
#define RC522_RST   22
#define BUZZER_PIN  33
#define TFT_BL_PIN  32

/*
────────────────────────────────────
CONFIG
────────────────────────────────────
*/

#define FW_VERSION      "1.0.0"
#define PREF_NAMESPACE  "contaore"
#define QUEUE_MAX       100
#define HEARTBEAT_MS    60000UL
#define DEBOUNCE_MS_DEFAULT  5000UL
#define RECONNECT_MS    10000UL
#define NTP_SERVER      "pool.ntp.org"
#define TZ_OFFSET       3600
#define TZ_DST          3600

/*
────────────────────────────────────
COLORI TFT
────────────────────────────────────
*/

#define C_BG        0x0000  // nero
#define C_WHITE     0xFFFF
#define C_GREEN     0x07E0
#define C_RED       0xF800
#define C_YELLOW    0xFFE0
#define C_ORANGE    0xFC00
#define C_GRAY      0x8410
#define C_DARKGRAY  0x4208
#define C_CYAN      0x07FF
#define C_HEADER    0x1082  // grigio scuro header

/*
────────────────────────────────────
OGGETTI
────────────────────────────────────
*/

MFRC522    rfid(RC522_SS, RC522_RST);
TFT_eSPI   tft = TFT_eSPI();
Preferences prefs;

/*
────────────────────────────────────
CONFIG STRUCT
────────────────────────────────────
*/

struct Config {
  char backend[128];
  char readerId[64];
  char companyId[64];
  bool valid;
};

Config cfg;

/*
────────────────────────────────────
STATO DISPLAY
────────────────────────────────────
*/

struct DisplayState {
  String status;       // ENTRATA / USCITA / ERRORE / ATTESA
  String dipendente;
  String orario;
  String oraCorrente;
  bool   online;
  int    queueSize;
};

DisplayState ds;

/*
────────────────────────────────────
GLOBALS
────────────────────────────────────
*/

char     g_uid[64];
char     g_payload[600];
char     g_url[256];

unsigned long g_lastHeartbeat  = 0;
unsigned long g_lastRead       = 0;
unsigned long g_lastReconnect  = 0;
unsigned long g_lastClockUpdate = 0;

uint32_t g_lastHash    = 0;
bool     g_wifiOffline = false;
int      g_queueSize   = 0;
bool     g_ntpSynced   = false;
unsigned long g_debouncMs     = DEBOUNCE_MS_DEFAULT;
unsigned long g_resultTimer   = 0;
unsigned long g_resultTimeout = 3000UL;  // ms che resta visibile il risultato

// queue in memoria + LittleFS/Preferences
struct QueueEntry {
  char uid[64];
  char timestamp[32];
};

QueueEntry g_queue[QUEUE_MAX];

/*
────────────────────────────────────
BUZZER
────────────────────────────────────
*/

void beepOk() {
  // doppio bip corto
  tone(BUZZER_PIN, 1000, 100);
  delay(150);
  tone(BUZZER_PIN, 1200, 100);
}

void beepErr() {
  // bip lungo basso
  tone(BUZZER_PIN, 400, 400);
}

void beepOffline() {
  // bip singolo medio
  tone(BUZZER_PIN, 700, 150);
}

/*
────────────────────────────────────
DISPLAY - LAYOUT
────────────────────────────────────
480x320
┌─────────────────────────────────┐
│ HEADER: ContaOre  ●ONLINE  12:34│ h=50
├─────────────────────────────────┤
│                                 │
│   STATO (ENTRATA/USCITA)        │ h=100
│                                 │
├─────────────────────────────────┤
│   Nome Dipendente               │ h=80
├─────────────────────────────────┤
│   Orario timbratura             │ h=50
├─────────────────────────────────┤
│   Avvicina badge...  Queue: 0   │ h=40
└─────────────────────────────────┘
────────────────────────────────────
*/

void drawHeader() {
  tft.fillRect(0, 0, 480, 40, C_HEADER);

  // ContaOre in alto a sinistra size 2
  tft.setTextColor(C_WHITE, C_HEADER);
  tft.setTextSize(2);
  tft.setCursor(8, 12);
  tft.print("ContaOre");

  // pallino + ONLINE/OFFLINE in alto a destra size 2
  uint16_t dotColor = g_wifiOffline ? C_RED : C_GREEN;
  tft.fillCircle(355, 20, 7, dotColor);
  tft.setTextSize(2);
  tft.setTextColor(C_WHITE, C_HEADER);
  tft.setCursor(368, 12);
  tft.print(g_wifiOffline ? "OFFLINE" : "ONLINE ");
}

void drawStatus() {
  // area stato (y=50, h=100)
  uint16_t bgColor = C_BG;
  uint16_t fgColor = C_WHITE;

  if (ds.status == "ENTRATA") {
    bgColor = 0x0320;
    fgColor = C_GREEN;
  } else if (ds.status == "USCITA") {
    bgColor = 0x4000;
    fgColor = C_RED;
  } else if (ds.status == "ERRORE") {
    bgColor = 0x4200;
    fgColor = C_ORANGE;
  } else {
    bgColor = C_BG;
    fgColor = C_GRAY;
  }

  tft.fillRect(0, 40, 480, 245, bgColor);

  if (ds.status == "ATTESA") {

    // ora grande centrata size 11
    // char width ~66px, HH:MM = 330px, tx = 75
    // char height ~88px, centro y = 40 + (245-88)/2 = 118
    tft.setTextColor(C_WHITE, C_BG);
    tft.setTextSize(11);
    tft.setCursor(150, 130);
    tft.print(ds.oraCorrente);

    // data in basso centrata, ciano
    if (g_ntpSynced) {
      time_t now = time(nullptr);
      struct tm* t = localtime(&now);
      char dateBuf[16];
      snprintf(dateBuf, sizeof(dateBuf), "%02d/%02d/%04d",
        t->tm_mday, t->tm_mon + 1, t->tm_year + 1900);
      // size 2 = 10 char * 12px = 120px, tx = (480-120)/2 = 180... usiamo size 3
      // size 3 = 10 char * 18px = 180px, tx = (480-180)/2 = 150
      tft.setTextColor(C_CYAN, C_BG);
      tft.setTextSize(3);
      tft.setCursor(150, 248);
      tft.print(dateBuf);
    }

  } else {

    // stato ENTRATA/USCITA/ERRORE centrato grande
    tft.setTextColor(fgColor, bgColor);
    tft.setTextSize(5);
    int16_t tw = ds.status.length() * 30;
    int16_t tx = (480 - tw) / 2;
    tft.setCursor(tx > 0 ? tx : 10, 80);
    tft.print(ds.status);

  }
}

void drawDipendente() {
  // area nome (y=150, h=80)
  tft.fillRect(0, 160, 480, 70, C_BG);

  if (ds.dipendente.length() > 0) {
    tft.setTextColor(C_WHITE, C_BG);
    tft.setTextSize(3);

    // centra
    int16_t tw = ds.dipendente.length() * 18;
    int16_t tx = (480 - tw) / 2;
    tft.setCursor(tx > 0 ? tx : 10, 180);
    tft.print(ds.dipendente);
  }
}

void drawOrario() {
  // area orario timbratura (y=230, h=50)
  tft.fillRect(0, 240, 480, 40, C_BG);

  if (ds.orario.length() > 0) {
    tft.setTextColor(C_YELLOW, C_BG);
    tft.setTextSize(2);
    int16_t tw = ds.orario.length() * 12;
    int16_t tx = (480 - tw) / 2;
    tft.setCursor(tx > 0 ? tx : 10, 252);
    tft.print(ds.orario);
  }
}

void drawFooter() {
  // footer (y=280, h=40)
  tft.fillRect(0, 285, 480, 35, C_HEADER);

  tft.setTextColor(C_GRAY, C_HEADER);
  tft.setTextSize(1);
  tft.setCursor(10, 298);
  tft.print("Avvicina badge al lettore");

  // queue
  if (g_queueSize > 0) {
    tft.setTextColor(C_YELLOW, C_HEADER);
    tft.setCursor(340, 298);
    tft.print("In coda: ");
    tft.print(g_queueSize);
  }
}

void drawAll() {
  drawHeader();
  drawStatus();
  drawDipendente();
  drawOrario();
  drawFooter();
}

void showIdle() {
  ds.status     = "ATTESA";
  ds.dipendente = "";
  ds.orario     = "";
  // pulisci area centrale una volta sola
  tft.fillRect(0, 40, 480, 245, C_BG);
  drawHeader();
  // disegna ora grande
  tft.setTextColor(C_WHITE, C_BG);
  tft.setTextSize(11);
  tft.setCursor(150, 130);
  tft.print(ds.oraCorrente);
  drawFooter();
}

void showResult(String tipo, String nome, String orario) {
  ds.status     = tipo;
  ds.dipendente = nome;
  ds.orario     = orario;
  drawAll();
  // avvia timer - showIdle verra chiamato nel loop
  g_resultTimer = millis();
}

void updateClock() {
  if (millis() - g_lastClockUpdate < 1000) return;
  g_lastClockUpdate = millis();

  if (!g_ntpSynced) {
    ds.oraCorrente = "--:--";
  } else {
    time_t now = time(nullptr);
    struct tm* t = localtime(&now);
    char buf[8];
    snprintf(buf, sizeof(buf), "%02d:%02d", t->tm_hour, t->tm_min);
    ds.oraCorrente = String(buf);
  }

  drawHeader();

  // in modalita ATTESA aggiorna solo i pixel dell'ora
  // senza fillRect per evitare sfarfallio
  if (ds.status == "ATTESA") {
    tft.setTextColor(C_WHITE, C_BG);
    tft.setTextSize(11);
    tft.setCursor(150, 130);
    tft.print(ds.oraCorrente);

    if (g_ntpSynced) {
      time_t now2 = time(nullptr);
      struct tm* t2 = localtime(&now2);
      char dateBuf2[16];
      snprintf(dateBuf2, sizeof(dateBuf2), "%02d/%02d/%04d",
        t2->tm_mday, t2->tm_mon + 1, t2->tm_year + 1900);
      tft.setTextColor(C_CYAN, C_BG);
      tft.setTextSize(3);
      tft.setCursor(160, 248);
      tft.print(dateBuf2);
    }
  }
}

/*
────────────────────────────────────
CONFIG (Preferences = NVS)
────────────────────────────────────
*/

bool loadConfig() {
  prefs.begin(PREF_NAMESPACE, true);
  String backend   = prefs.getString("backend",   "");
  String readerId  = prefs.getString("readerId",  "");
  String companyId = prefs.getString("companyId", "");
  prefs.end();

  if (backend.length() < 4 || readerId.length() < 2 || companyId.length() < 10) {
    return false;
  }

  strlcpy(cfg.backend,   backend.c_str(),   sizeof(cfg.backend));
  strlcpy(cfg.readerId,  readerId.c_str(),  sizeof(cfg.readerId));
  strlcpy(cfg.companyId, companyId.c_str(), sizeof(cfg.companyId));
  cfg.valid = true;
  return true;
}

void saveConfig() {
  prefs.begin(PREF_NAMESPACE, false);
  prefs.putString("backend",   cfg.backend);
  prefs.putString("readerId",  cfg.readerId);
  prefs.putString("companyId", cfg.companyId);
  prefs.end();
}

void clearConfig() {
  prefs.begin(PREF_NAMESPACE, false);
  prefs.clear();
  prefs.end();
}

/*
────────────────────────────────────
QUEUE
────────────────────────────────────
*/

void saveQueue() {
  prefs.begin(PREF_NAMESPACE, false);
  prefs.putInt("qsize", g_queueSize);
  for (int i = 0; i < g_queueSize; i++) {
    char key[16];
    snprintf(key, sizeof(key), "q%d", i);
    String val = String(g_queue[i].uid) + "|" + String(g_queue[i].timestamp);
    prefs.putString(key, val);
  }
  prefs.end();
}

void loadQueue() {
  prefs.begin(PREF_NAMESPACE, true);
  g_queueSize = prefs.getInt("qsize", 0);
  if (g_queueSize > QUEUE_MAX) g_queueSize = 0;
  for (int i = 0; i < g_queueSize; i++) {
    char key[16];
    snprintf(key, sizeof(key), "q%d", i);
    String val = prefs.getString(key, "");
    int sep = val.indexOf('|');
    if (sep > 0) {
      strlcpy(g_queue[i].uid,       val.substring(0, sep).c_str(),  sizeof(g_queue[i].uid));
      strlcpy(g_queue[i].timestamp, val.substring(sep + 1).c_str(), sizeof(g_queue[i].timestamp));
    }
  }
  prefs.end();
}

void queueAdd(const char* uid, const char* ts) {
  if (g_queueSize >= QUEUE_MAX) return;
  strlcpy(g_queue[g_queueSize].uid,       uid, sizeof(g_queue[0].uid));
  strlcpy(g_queue[g_queueSize].timestamp, ts,  sizeof(g_queue[0].timestamp));
  g_queueSize++;
  saveQueue();
  Serial.printf("QUEUE +1 (tot: %d)\n", g_queueSize);
}

/*
────────────────────────────────────
NTP
────────────────────────────────────
*/

bool syncNTP() {
  configTime(TZ_OFFSET, TZ_DST, NTP_SERVER);
  Serial.print("NTP sync");
  unsigned long start = millis();
  while (time(nullptr) < 1000000000UL) {
    if (millis() - start > 6000) {
      Serial.println(" FAIL");
      return false;
    }
    delay(200);
    Serial.print(".");
  }
  Serial.println(" OK");
  return true;
}

String getISOTimestamp() {
  time_t now = time(nullptr);
  if (now < 1000000000UL) return "";
  struct tm* t = gmtime(&now);
  char buf[32];
  snprintf(buf, sizeof(buf), "%04d-%02d-%02dT%02d:%02d:%02dZ",
    t->tm_year + 1900, t->tm_mon + 1, t->tm_mday,
    t->tm_hour, t->tm_min, t->tm_sec);
  return String(buf);
}

String getLocalTime() {
  time_t now = time(nullptr);
  if (now < 1000000000UL) return "--:--:--";
  struct tm* t = localtime(&now);
  char buf[10];
  snprintf(buf, sizeof(buf), "%02d:%02d:%02d",
    t->tm_hour, t->tm_min, t->tm_sec);
  return String(buf);
}

/*
────────────────────────────────────
HTTP POST
────────────────────────────────────
*/

int httpPost(const char* path, const char* payload) {
  if (WiFi.status() != WL_CONNECTED) return -1;

  snprintf(g_url, sizeof(g_url), "%s%s", cfg.backend, path);
  Serial.printf("POST %s\n", g_url);

  bool isHttps = strncmp(cfg.backend, "https", 5) == 0;
  int code = -1;

  if (isHttps) {
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;
    if (!http.begin(client, g_url)) return -1;
    http.setTimeout(8000);
    http.setReuse(false);
    http.addHeader("Content-Type", "application/json");
    code = http.POST(payload);
    String body = http.getString();
    http.end();

    // parse risposta per nome dipendente
    if (code == 200 && body.length() > 2) {
      StaticJsonDocument<512> doc;
      if (!deserializeJson(doc, body)) {
        String tipo      = doc["tipo"]       | "";
        String dipName   = doc["dipendente"] | "";
        if (tipo.length() > 0) {
          String ts = getLocalTime();
          showResult(tipo, dipName, ts);
        }
      }
    }

  } else {
    WiFiClient client;
    HTTPClient http;
    if (!http.begin(client, g_url)) return -1;
    http.setTimeout(8000);
    http.setReuse(false);
    http.addHeader("Content-Type", "application/json");
    code = http.POST(payload);
    String body = http.getString();
    http.end();

    if (code == 200 && body.length() > 2) {
      StaticJsonDocument<512> doc;
      if (!deserializeJson(doc, body)) {
        String tipo    = doc["tipo"]       | "";
        String dipName = doc["dipendente"] | "";
        if (tipo.length() > 0) {
          String ts = getLocalTime();
          showResult(tipo, dipName, ts);
        }
      }
    }
  }

  Serial.printf("CODE: %d\n", code);
  return code;
}

/*
────────────────────────────────────
QUEUE FLUSH
────────────────────────────────────
*/

void queueFlush() {
  if (WiFi.status() != WL_CONNECTED) return;
  if (g_queueSize == 0) return;

  Serial.printf("FLUSH QUEUE (%d)...\n", g_queueSize);

  int sent   = 0;
  int failed = 0;
  QueueEntry remaining[QUEUE_MAX];
  int remainingCount = 0;

  for (int i = 0; i < g_queueSize; i++) {

    if (strlen(g_queue[i].timestamp) > 0) {
      snprintf(g_payload, sizeof(g_payload),
        "{\"uid\":\"%s\",\"reader_id\":\"%s\",\"company_id\":\"%s\",\"timestamp\":\"%s\",\"offline\":true}",
        g_queue[i].uid, cfg.readerId, cfg.companyId, g_queue[i].timestamp);
    } else {
      snprintf(g_payload, sizeof(g_payload),
        "{\"uid\":\"%s\",\"reader_id\":\"%s\",\"company_id\":\"%s\",\"offline\":true}",
        g_queue[i].uid, cfg.readerId, cfg.companyId);
    }

    // per il flush non mostriamo il risultato sul display
    bool isHttps = strncmp(cfg.backend, "https", 5) == 0;
    int code = -1;

    snprintf(g_url, sizeof(g_url), "%s/api/hardware/tag", cfg.backend);

    if (isHttps) {
      WiFiClientSecure client;
      client.setInsecure();
      HTTPClient http;
      if (http.begin(client, g_url)) {
        http.setTimeout(8000);
        http.setReuse(false);
        http.addHeader("Content-Type", "application/json");
        code = http.POST(g_payload);
        http.end();
      }
    } else {
      WiFiClient client;
      HTTPClient http;
      if (http.begin(client, g_url)) {
        http.setTimeout(8000);
        http.setReuse(false);
        http.addHeader("Content-Type", "application/json");
        code = http.POST(g_payload);
        http.end();
      }
    }

    if (code == 200 || code == 201) {
      sent++;
    } else {
      remaining[remainingCount++] = g_queue[i];
      failed++;
    }

    delay(300);
  }

  // aggiorna queue con solo quelli falliti
  g_queueSize = remainingCount;
  for (int i = 0; i < remainingCount; i++) {
    g_queue[i] = remaining[i];
  }
  saveQueue();

  Serial.printf("FLUSH: sent=%d failed=%d\n", sent, failed);
}

/*
────────────────────────────────────
HEARTBEAT
────────────────────────────────────
*/

void sendHeartbeat() {
  if (millis() - g_lastHeartbeat < HEARTBEAT_MS) return;
  g_lastHeartbeat = millis();

  snprintf(g_payload, sizeof(g_payload),
    "{\"reader_id\":\"%s\",\"company_id\":\"%s\",\"firmware\":\"%s\",\"queue\":%d}",
    cfg.readerId, cfg.companyId, FW_VERSION, g_queueSize);

  bool isHttps = strncmp(cfg.backend, "https", 5) == 0;
  snprintf(g_url, sizeof(g_url), "%s/api/hardware/ping", cfg.backend);
  int code = -1;

  if (isHttps) {
    WiFiClientSecure client;
    client.setInsecure();
    HTTPClient http;
    if (http.begin(client, g_url)) {
      http.setTimeout(6000);
      http.setReuse(false);
      http.addHeader("Content-Type", "application/json");
      code = http.POST(g_payload);
      http.end();
    }
  } else {
    WiFiClient client;
    HTTPClient http;
    if (http.begin(client, g_url)) {
      http.setTimeout(6000);
      http.setReuse(false);
      http.addHeader("Content-Type", "application/json");
      code = http.POST(g_payload);
      http.end();
    }
  }

  Serial.printf("PING: %d\n", code);
}

/*
────────────────────────────────────
RFID
────────────────────────────────────
*/

uint32_t fnv1a(const char* s) {
  uint32_t h = 0x811c9dc5;
  while (*s) { h ^= (uint8_t)*s++; h *= 0x01000193; }
  return h;
}

void taskRfid() {
  if (!rfid.PICC_IsNewCardPresent()) return;
  if (!rfid.PICC_ReadCardSerial())   return;

  g_uid[0] = '\0';
  for (byte i = 0; i < rfid.uid.size; i++) {
    char hex[5];
    snprintf(hex, sizeof(hex), "%02X", rfid.uid.uidByte[i]);
    strlcat(g_uid, hex, sizeof(g_uid));
  }

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  uint32_t hash = fnv1a(g_uid);
  if (hash == g_lastHash && millis() - g_lastRead < g_debouncMs) return;

  g_lastHash = hash;
  g_lastRead = millis();

  Serial.printf("TAG: %s\n", g_uid);

  // bip immediato alla lettura del tag
  beepOk();

  String isoTs = getISOTimestamp();

  if (isoTs.length() > 0) {
    snprintf(g_payload, sizeof(g_payload),
      "{\"uid\":\"%s\",\"reader_id\":\"%s\",\"company_id\":\"%s\",\"timestamp\":\"%s\",\"offline\":false}",
      g_uid, cfg.readerId, cfg.companyId, isoTs.c_str());
  } else {
    snprintf(g_payload, sizeof(g_payload),
      "{\"uid\":\"%s\",\"reader_id\":\"%s\",\"company_id\":\"%s\",\"offline\":false}",
      g_uid, cfg.readerId, cfg.companyId);
  }

  int code = httpPost("/api/hardware/tag", g_payload);

  if (code <= 0) {
    // offline → salva in coda
    beepOffline();
    queueAdd(g_uid, isoTs.length() > 0 ? isoTs.c_str() : "");

    ds.status     = "OFFLINE";
    ds.dipendente = "Salvato in coda";
    ds.orario     = isoTs.length() > 0 ? isoTs.substring(11, 19) : "";
    drawAll();
    g_resultTimer = millis();

  } else if (code != 200 && code != 201) {
    beepErr();
    ds.status     = "ERRORE";
    ds.dipendente = "Tag non registrato";
    ds.orario     = "";
    drawAll();
    g_resultTimer = millis();
  }
  // se 200/201 il display e gia aggiornato dentro httpPost
}

/*
────────────────────────────────────
WIFI TASK
────────────────────────────────────
*/

void taskWifi() {
  if (WiFi.status() == WL_CONNECTED) {

    if (g_wifiOffline) {
      g_wifiOffline = false;
      Serial.println("WIFI RESTORED");

      if (syncNTP()) g_ntpSynced = true;

      queueFlush();
      drawAll();
    }
    return;
  }

  if (!g_wifiOffline) {
    g_wifiOffline = true;
    g_lastReconnect = millis();
    Serial.println("WIFI OFFLINE");
    drawAll();
  }

  if (millis() - g_lastReconnect > RECONNECT_MS) {
    g_lastReconnect = millis();
    Serial.println("WiFi reconnect...");
    if (!WiFi.reconnect()) WiFi.begin();
  }
}

/*
────────────────────────────────────
PROVISIONING
────────────────────────────────────
*/

void startProvisioning() {

  tft.fillScreen(C_BG);
  tft.setTextColor(C_WHITE, C_BG);
  tft.setTextSize(2);
  tft.setCursor(20, 60);
  tft.print("Modalita configurazione");
  tft.setCursor(20, 100);
  tft.print("Connetti al WiFi:");
  tft.setTextColor(C_CYAN, C_BG);
  tft.setTextSize(3);

  char apName[32];
  snprintf(apName, sizeof(apName), "ContaOre-%06X", (uint32_t)(ESP.getEfuseMac() & 0xFFFFFF));

  tft.setCursor(20, 150);
  tft.print(apName);
  tft.setTextColor(C_GRAY, C_BG);
  tft.setTextSize(1);
  tft.setCursor(20, 210);
  tft.print("Poi vai su: 192.168.4.1");

  WiFiManager wm;
  wm.setConfigPortalTimeout(300);

  WiFiManagerParameter p_backend(
    "backend", "Backend URL (es: https://xxx.railway.app)", cfg.backend, 127);
  WiFiManagerParameter p_reader(
    "reader", "Reader ID (es: lettore-1)", cfg.readerId, 63);
  WiFiManagerParameter p_company(
    "company", "Company ID (UUID)", cfg.companyId, 63);

  wm.addParameter(&p_backend);
  wm.addParameter(&p_reader);
  wm.addParameter(&p_company);

  bool ok = wm.startConfigPortal(apName);

  if (!ok) { ESP.restart(); return; }

  strlcpy(cfg.backend,   p_backend.getValue(),  sizeof(cfg.backend));
  strlcpy(cfg.readerId,  p_reader.getValue(),   sizeof(cfg.readerId));
  strlcpy(cfg.companyId, p_company.getValue(),  sizeof(cfg.companyId));

  // rimuovi slash finale
  int len = strlen(cfg.backend);
  if (len > 0 && cfg.backend[len - 1] == '/') cfg.backend[len - 1] = '\0';

  saveConfig();
  delay(500);
  ESP.restart();
}

/*
────────────────────────────────────
SERIAL COMMANDS
────────────────────────────────────
*/

void taskSerial() {
  if (!Serial.available()) return;

  String cmd = Serial.readStringUntil('\n');
  cmd.trim();
  cmd.toUpperCase();

  if (cmd == "RESET") {
    Serial.println("RESET CONFIG");
    WiFi.disconnect(true);
    clearConfig();
    delay(1000);
    ESP.restart();

  } else if (cmd == "STATUS") {
    Serial.printf("Backend:  %s\n", cfg.backend);
    Serial.printf("Reader:   %s\n", cfg.readerId);
    Serial.printf("Company:  %s\n", cfg.companyId);
    Serial.printf("Queue:    %d\n", g_queueSize);
    Serial.printf("WiFi:     %s\n", WiFi.status() == WL_CONNECTED ? "OK" : "OFFLINE");
    Serial.printf("IP:       %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("NTP:      %s\n", g_ntpSynced ? "OK" : "NO SYNC");
    Serial.printf("Time:     %s\n", getISOTimestamp().c_str());

  } else if (cmd == "FLUSH") {
    queueFlush();

  } else if (cmd.startsWith("DEBOUNCE ")) {
    String val = cmd.substring(9);
    unsigned long ms = val.toInt();
    if (ms >= 500 && ms <= 30000) {
      g_debouncMs = ms;
      Serial.printf("DEBOUNCE impostato a %lu ms\n", g_debouncMs);
    } else {
      Serial.println("Valore non valido (500-30000 ms)");
    }

  } else if (cmd.startsWith("DISPLAY ")) {
    // es: "DISPLAY 2000" mostra risultato per 2 secondi
    String val = cmd.substring(8);
    unsigned long ms = val.toInt();
    if (ms >= 500 && ms <= 10000) {
      g_resultTimeout = ms;
      Serial.printf("DISPLAY timeout impostato a %lu ms\n", g_resultTimeout);
    } else {
      Serial.println("Valore non valido (500-10000 ms)");
    }
  }
}

/*
────────────────────────────────────
SETUP
────────────────────────────────────
*/

void setup() {
  Serial.begin(115200);

  // backlight display ON
  pinMode(TFT_BL_PIN, OUTPUT);
  digitalWrite(TFT_BL_PIN, HIGH);

  // init display
  tft.init();
  tft.setRotation(1); // landscape
  tft.fillScreen(C_BG);

  // splash screen
  tft.setTextColor(C_CYAN, C_BG);
  tft.setTextSize(4);
  tft.setCursor(100, 100);
  tft.print("ContaOre");
  tft.setTextColor(C_GRAY, C_BG);
  tft.setTextSize(2);
  tft.setCursor(160, 160);
  tft.print("NFC Reader");
  tft.setCursor(180, 190);
  tft.print("v");
  tft.print(FW_VERSION);
  delay(1500);

  // init RFID
  SPI.begin();
  rfid.PCD_Init();

  // init buzzer
  pinMode(BUZZER_PIN, OUTPUT);
  digitalWrite(BUZZER_PIN, LOW);

  // carica queue salvata
  loadQueue();

  Serial.println("\nCONTAORE NFC ESP32");
  Serial.println(FW_VERSION);

  // carica config
  bool ok = loadConfig();

  if (!ok) {
    Serial.println("START PROVISIONING");
    startProvisioning();
    return;
  }

  Serial.printf("Backend:  %s\n", cfg.backend);
  Serial.printf("Reader:   %s\n", cfg.readerId);
  Serial.printf("Company:  %s\n", cfg.companyId);
  Serial.printf("Queue:    %d\n", g_queueSize);

  // connetti WiFi
  tft.fillScreen(C_BG);
  tft.setTextColor(C_WHITE, C_BG);
  tft.setTextSize(2);
  tft.setCursor(20, 100);
  tft.print("Connessione WiFi...");

  WiFi.mode(WIFI_STA);
  WiFi.begin();

  unsigned long start = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - start < 15000) {
    delay(500);
    Serial.print(".");
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("WIFI OK - IP: %s\n", WiFi.localIP().toString().c_str());

    if (syncNTP()) g_ntpSynced = true;

    beepOk();
    queueFlush();

  } else {
    Serial.println("WIFI OFFLINE");
    g_wifiOffline = true;
    beepErr();
  }

  ds.online = !g_wifiOffline;
  showIdle();
}

/*
────────────────────────────────────
LOOP
────────────────────────────────────
*/

void taskResult() {
  if (g_resultTimer == 0) return;
  if (millis() - g_resultTimer >= g_resultTimeout) {
    g_resultTimer = 0;
    showIdle();
  }
}

void loop() {
  taskSerial();
  taskWifi();
  updateClock();
  taskResult();
  taskRfid();
  sendHeartbeat();
  delay(10);
}