/*
 * ContaOre NFC Reader Firmware
 * ESP32-WROOM + RC522 + ILI9488 TFT 480x320 + Buzzer
 * v2.0.0
 *
 * PIN MAP:
 * ─────────────────────────────────────
 * TFT ILI9488 (SPI)
 *   MOSI → GPIO 23 / SCK → GPIO 18
 *   CS   → GPIO 15 / DC  → GPIO 2
 *   RST  → GPIO 4  / BL  → GPIO 32
 * RC522:
 *   MOSI → GPIO 23 / MISO → GPIO 19
 *   SCK  → GPIO 18 / SS   → GPIO 21 / RST → GPIO 22
 * BUZZER → GPIO 33
 * ─────────────────────────────────────
 * User_Setup.h:
 *   #define ILI9488_DRIVER
 *   #define TFT_MOSI 23 / TFT_SCLK 18 / TFT_CS 15
 *   #define TFT_DC 2 / TFT_RST 4
 *   #define SPI_FREQUENCY 27000000
 *
 * TAG ADMIN: 5F93054D78587A
 *   1a lettura → mostra config
 *   2a lettura entro 60s → RESET
 *   timeout 60s → torna normale
 *
 * COMANDI SERIALI:
 *   RESET / STATUS / FLUSH
 *   DEBOUNCE <ms>  (500-30000)
 *   DISPLAY <ms>   (500-10000)
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

// ── PIN ──────────────────────────────
#define RC522_SS    21
#define RC522_RST   22
#define BUZZER_PIN  33
#define TFT_BL_PIN  32

// ── CONFIG ───────────────────────────
#define FW_VERSION          "1.0.0"
#define PREF_NAMESPACE      "contaore"
#define QUEUE_MAX           100
#define HEARTBEAT_MS        60000UL
#define DEBOUNCE_DEFAULT    5000UL
#define RECONNECT_MS        10000UL
#define NTP_SERVER          "pool.ntp.org"
#define TZ_OFFSET           3600
#define TZ_DST              3600

// ── TAG ADMIN ────────────────────────
#define ADMIN_UID           "5F93054D78587A"
#define ADMIN_TIMEOUT_MS    60000UL

// ── LAYOUT ───────────────────────────
// size 11: char ~66px wide, HH:MM=5char → 330px
// CLK_X = (480-330)/2 = 75
// CLK_Y: header=40, footer=285, spazio=245, char_h=88 → y = 40+(245-88)/2 = 118
#define HDR_H    40
#define FTR_Y    285
#define CLK_SIZE 20
#define CLK_X    145
#define CLK_Y    118
#define CLK_W    332   // area pulizia (330 + 2 margine)
#define CLK_H    92
// data: size3, 10char*18=180px → x=(480-180)/2=150
#define DATE_SIZE 3
#define DATE_X    150
#define DATE_Y    250

// ── COLORI ───────────────────────────
#define C_BG       0x0000
#define C_WHITE    0xFFFF
#define C_GREEN    0x07E0
#define C_RED      0xF800
#define C_YELLOW   0xFFE0
#define C_ORANGE   0xFC00
#define C_GRAY     0x8410
#define C_CYAN     0x07FF
#define C_HEADER   0x1082

// ── OGGETTI ──────────────────────────
MFRC522     rfid(RC522_SS, RC522_RST);
TFT_eSPI    tft = TFT_eSPI();
Preferences prefs;

// ── STRUTTURE ────────────────────────
struct Config {
  char backend[128];
  char readerId[64];
  char companyId[64];
  bool valid;
};
Config cfg;

struct DisplayState {
  String status;
  String dipendente;
  String orario;
  String oraCorrente;
};
DisplayState ds;

struct QueueEntry {
  char uid[64];
  char timestamp[32];
};
QueueEntry g_queue[QUEUE_MAX];

// ── GLOBALS ──────────────────────────
char          g_uid[64];
char          g_payload[600];
char          g_url[256];
unsigned long g_lastHeartbeat   = 0;
unsigned long g_lastRead        = 0;
unsigned long g_lastReconnect   = 0;
unsigned long g_lastClockUpdate = 0;
uint32_t      g_lastHash        = 0;
bool          g_wifiOffline     = false;
int           g_queueSize       = 0;
bool          g_ntpSynced       = false;
unsigned long g_debouncMs       = DEBOUNCE_DEFAULT;
unsigned long g_resultTimer     = 0;
unsigned long g_resultTimeout   = 3000UL;
bool          g_adminMode       = false;
unsigned long g_adminTimer      = 0;

// ── BUZZER ───────────────────────────
void beepOk()     { tone(BUZZER_PIN, 1000, 100); delay(150); tone(BUZZER_PIN, 1200, 100); }
void beepErr()    { tone(BUZZER_PIN, 400, 400); }
void beepOffline(){ tone(BUZZER_PIN, 700, 150); }

// ── NTP ──────────────────────────────
bool syncNTP() {
  configTime(TZ_OFFSET, TZ_DST, NTP_SERVER);
  Serial.print("NTP sync");
  unsigned long s = millis();
  while (time(nullptr) < 1000000000UL) {
    if (millis() - s > 6000) { Serial.println(" FAIL"); return false; }
    delay(200); Serial.print(".");
  }
  Serial.println(" OK");

  // salva timestamp in NVS per persistenza dopo riavvio
  time_t now = time(nullptr);
  if (now > 1000000000UL) {
    prefs.begin(PREF_NAMESPACE, false);
    prefs.putULong("lastTime", (unsigned long)now);
    prefs.putULong("lastMillis", millis() / 1000);
    prefs.end();
  }

  return true;
}

String getISOTimestamp() {
  time_t now = time(nullptr);
  if (now < 1000000000UL) return "";
  struct tm* t = gmtime(&now);
  char buf[32];
  snprintf(buf, sizeof(buf), "%04d-%02d-%02dT%02d:%02d:%02dZ",
    t->tm_year+1900, t->tm_mon+1, t->tm_mday, t->tm_hour, t->tm_min, t->tm_sec);
  return String(buf);
}

String getLocalTime() {
  time_t now = time(nullptr);
  if (now < 1000000000UL) return "--:--:--";
  struct tm* t = localtime(&now);
  char buf[10];
  snprintf(buf, sizeof(buf), "%02d:%02d:%02d", t->tm_hour, t->tm_min, t->tm_sec);
  return String(buf);
}

// ── DISPLAY ──────────────────────────

void drawHeader() {
  tft.fillRect(0, 0, 480, HDR_H, C_HEADER);
  tft.setTextColor(C_WHITE, C_HEADER);
  tft.setTextSize(2);
  tft.setCursor(8, 12);
  tft.print("ContaOre");
  tft.fillCircle(355, 20, 7, g_wifiOffline ? C_RED : C_GREEN);
  tft.setTextColor(C_WHITE, C_HEADER);
  tft.setCursor(368, 12);
  tft.print(g_wifiOffline ? "OFFLINE" : "ONLINE ");
}

void drawFooter() {
  tft.fillRect(0, FTR_Y, 480, 320 - FTR_Y, C_HEADER);
  tft.setTextColor(C_GRAY, C_HEADER);
  tft.setTextSize(1);
  tft.setCursor(10, FTR_Y + 12);
  tft.print("Avvicina badge al lettore");
  if (g_queueSize > 0) {
    tft.setTextColor(C_YELLOW, C_HEADER);
    tft.setCursor(340, FTR_Y + 12);
    tft.print("In coda: ");
    tft.print(g_queueSize);
  }
}

void drawClock() {
  tft.fillRect(CLK_X, CLK_Y, CLK_W, CLK_H, C_BG);
  tft.setTextColor(C_WHITE, C_BG);
  tft.setTextSize(CLK_SIZE);
  tft.setCursor(CLK_X, CLK_Y);
  tft.print(ds.oraCorrente);
}

void drawDate() {
  if (!g_ntpSynced) return;
  time_t now = time(nullptr);
  struct tm* t = localtime(&now);
  char buf[16];
  snprintf(buf, sizeof(buf), "%02d/%02d/%04d",
    t->tm_mday, t->tm_mon + 1, t->tm_year + 1900);
  tft.fillRect(0, DATE_Y, 480, 28, C_BG);
  tft.setTextColor(C_CYAN, C_BG);
  tft.setTextSize(DATE_SIZE);
  tft.setCursor(DATE_X, DATE_Y);
  tft.print(buf);
}

void showIdle() {
  ds.status     = "ATTESA";
  ds.dipendente = "";
  ds.orario     = "";
  tft.fillRect(0, HDR_H, 480, FTR_Y - HDR_H, C_BG);
  drawHeader();
  drawClock();
  drawDate();
  drawFooter();
}

void showResult(String tipo, String nome, String orario) {
  ds.status     = tipo;
  ds.dipendente = nome;
  ds.orario     = orario;

  uint16_t bg, fg;
  if      (tipo == "ENTRATA") { bg = 0x0320; fg = C_GREEN;  }
  else if (tipo == "USCITA")  { bg = 0x4000; fg = C_RED;    }
  else if (tipo == "ERRORE")  { bg = 0x4200; fg = C_ORANGE; }
  else                         { bg = 0x2104; fg = C_YELLOW; }

  tft.fillRect(0, HDR_H, 480, FTR_Y - HDR_H, bg);

  // stato centrato grande
  tft.setTextColor(fg, bg);
  tft.setTextSize(6);
  int16_t sw = tipo.length() * 36;
  tft.setCursor(max((int16_t)10, (int16_t)((480 - sw) / 2)), HDR_H + 20);
  tft.print(tipo);

  // nome centrato
  if (nome.length() > 0) {
    tft.setTextColor(C_WHITE, bg);
    tft.setTextSize(3);
    int16_t nw = nome.length() * 18;
    tft.setCursor(max((int16_t)10, (int16_t)((480 - nw) / 2)), HDR_H + 115);
    tft.print(nome);
  }

  // orario centrato
  if (orario.length() > 0) {
    tft.setTextColor(C_YELLOW, bg);
    tft.setTextSize(3);
    int16_t ow = orario.length() * 18;
    tft.setCursor(max((int16_t)10, (int16_t)((480 - ow) / 2)), HDR_H + 168);
    tft.print(orario);
  }

  drawHeader();
  drawFooter();
  g_resultTimer = millis();
}

void drawAdmin() {
  tft.fillRect(0, HDR_H, 480, FTR_Y - HDR_H, C_BG);

  tft.setTextColor(C_YELLOW, C_BG);
  tft.setTextSize(2);
  // centra titolo: 20 char * 12 = 240px → x = 120
  tft.setCursor(120, HDR_H + 8);
  tft.print("-- CONFIG --");

  tft.setTextColor(C_WHITE, C_BG);
  tft.setTextSize(1);
  int y = HDR_H + 32;

  tft.setCursor(10, y); tft.print("Backend: "); tft.print(cfg.backend);   y += 18;
  tft.setCursor(10, y); tft.print("Reader:  "); tft.print(cfg.readerId);  y += 18;
  tft.setCursor(10, y); tft.print("Company: "); tft.print(cfg.companyId); y += 18;

  tft.setCursor(10, y); tft.print("WiFi:    ");
  if (WiFi.status() == WL_CONNECTED) {
    tft.print("OK  "); tft.print(WiFi.localIP().toString());
  } else {
    tft.print("OFFLINE");
  }
  y += 18;

  tft.setCursor(10, y); tft.print("Queue:   "); tft.print(g_queueSize);   y += 18;
  tft.setCursor(10, y); tft.print("NTP:     "); tft.print(g_ntpSynced ? "OK" : "NO SYNC"); y += 18;
  tft.setCursor(10, y); tft.print("Time:    "); tft.print(getISOTimestamp()); y += 18;
  tft.setCursor(10, y); tft.print("FW:      "); tft.print(FW_VERSION);    y += 28;

  // istruzione reset centrata
  tft.setTextColor(C_RED, C_BG);
  tft.setTextSize(2);
  tft.setCursor(60, y);
  tft.print("Ripassare per RESET");
  y += 22;

  tft.setTextColor(C_GRAY, C_BG);
  tft.setTextSize(1);
  tft.setCursor(90, y);
  tft.print("Attendi 60s per annullare");

  drawHeader();
  drawFooter();
}

void updateClock() {
  if (millis() - g_lastClockUpdate < 1000) return;
  g_lastClockUpdate = millis();

  String newOra;
  if (!g_ntpSynced) {
    newOra = "--:--";
  } else {
    time_t now = time(nullptr);
    struct tm* t = localtime(&now);
    char buf[8];
    snprintf(buf, sizeof(buf), "%02d:%02d", t->tm_hour, t->tm_min);
    newOra = String(buf);
  }

  // aggiorna header solo se cambia stato online/offline
  static bool lastWifiOffline = false;
  if (lastWifiOffline != g_wifiOffline) {
    lastWifiOffline = g_wifiOffline;
    drawHeader();
  }

  // aggiorna orologio solo se il minuto e cambiato
  if (ds.status == "ATTESA" && newOra != ds.oraCorrente) {
    ds.oraCorrente = newOra;
    drawClock();
    drawDate();

    // salva timestamp ogni minuto se sincronizzato
    if (g_ntpSynced) {
      time_t now = time(nullptr);
      if (now > 1000000000UL) {
        prefs.begin(PREF_NAMESPACE, false);
        prefs.putULong("lastTime", (unsigned long)now);
        prefs.end();
      }
    }

  } else {
    ds.oraCorrente = newOra;
  }
}

// ── CONFIG NVS ───────────────────────
bool loadConfig() {
  prefs.begin(PREF_NAMESPACE, true);
  String backend   = prefs.getString("backend",   "");
  String readerId  = prefs.getString("readerId",  "");
  String companyId = prefs.getString("companyId", "");
  prefs.end();
  if (backend.length() < 4 || readerId.length() < 2 || companyId.length() < 10) return false;
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

// ── QUEUE ────────────────────────────
void saveQueue() {
  prefs.begin(PREF_NAMESPACE, false);
  prefs.putInt("qsize", g_queueSize);
  for (int i = 0; i < g_queueSize; i++) {
    char key[16]; snprintf(key, sizeof(key), "q%d", i);
    prefs.putString(key, String(g_queue[i].uid) + "|" + String(g_queue[i].timestamp));
  }
  prefs.end();
}

void loadQueue() {
  prefs.begin(PREF_NAMESPACE, true);
  g_queueSize = min((int)prefs.getInt("qsize", 0), QUEUE_MAX);
  for (int i = 0; i < g_queueSize; i++) {
    char key[16]; snprintf(key, sizeof(key), "q%d", i);
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

// ── HTTP POST ────────────────────────
int httpPost(const char* path, const char* payload) {
  if (WiFi.status() != WL_CONNECTED) return -1;
  snprintf(g_url, sizeof(g_url), "%s%s", cfg.backend, path);
  Serial.printf("POST %s\n", g_url);

  bool   isHttps = strncmp(cfg.backend, "https", 5) == 0;
  int    code    = -1;
  String body    = "";

  if (isHttps) {
    WiFiClientSecure client; client.setInsecure();
    HTTPClient http;
    if (!http.begin(client, g_url)) return -1;
    http.setTimeout(8000); http.setReuse(false);
    http.addHeader("Content-Type", "application/json");
    code = http.POST(payload); body = http.getString(); http.end();
  } else {
    WiFiClient client; HTTPClient http;
    if (!http.begin(client, g_url)) return -1;
    http.setTimeout(8000); http.setReuse(false);
    http.addHeader("Content-Type", "application/json");
    code = http.POST(payload); body = http.getString(); http.end();
  }

  if (code == 200 && body.length() > 2) {
    StaticJsonDocument<512> doc;
    if (!deserializeJson(doc, body)) {
      String tipo    = doc["tipo"]       | "";
      String dipName = doc["dipendente"] | "";
      if (tipo.length() > 0) showResult(tipo, dipName, getLocalTime());
    }
  }

  Serial.printf("CODE: %d\n", code);
  return code;
}

// ── QUEUE FLUSH ──────────────────────
void queueFlush() {
  if (WiFi.status() != WL_CONNECTED || g_queueSize == 0) return;
  Serial.printf("FLUSH QUEUE (%d)...\n", g_queueSize);

  int sent = 0, failed = 0;
  QueueEntry rem[QUEUE_MAX];
  bool isHttps = strncmp(cfg.backend, "https", 5) == 0;
  snprintf(g_url, sizeof(g_url), "%s/api/hardware/tag", cfg.backend);

  for (int i = 0; i < g_queueSize; i++) {
    if (strlen(g_queue[i].timestamp) > 0)
      snprintf(g_payload, sizeof(g_payload),
        "{\"uid\":\"%s\",\"reader_id\":\"%s\",\"company_id\":\"%s\",\"timestamp\":\"%s\",\"offline\":true}",
        g_queue[i].uid, cfg.readerId, cfg.companyId, g_queue[i].timestamp);
    else
      snprintf(g_payload, sizeof(g_payload),
        "{\"uid\":\"%s\",\"reader_id\":\"%s\",\"company_id\":\"%s\",\"offline\":true}",
        g_queue[i].uid, cfg.readerId, cfg.companyId);

    int rc = -1;
    if (isHttps) {
      WiFiClientSecure c; c.setInsecure(); HTTPClient h;
      if (h.begin(c, g_url)) { h.setTimeout(8000); h.setReuse(false);
        h.addHeader("Content-Type","application/json"); rc = h.POST(g_payload); h.end(); }
    } else {
      WiFiClient c; HTTPClient h;
      if (h.begin(c, g_url)) { h.setTimeout(8000); h.setReuse(false);
        h.addHeader("Content-Type","application/json"); rc = h.POST(g_payload); h.end(); }
    }

    if (rc == 200 || rc == 201) sent++;
    else rem[failed++] = g_queue[i];
    delay(300);
  }

  g_queueSize = failed;
  for (int i = 0; i < failed; i++) g_queue[i] = rem[i];
  saveQueue();
  Serial.printf("FLUSH: sent=%d failed=%d\n", sent, failed);
}

// ── HEARTBEAT ────────────────────────
void sendHeartbeat() {
  if (millis() - g_lastHeartbeat < HEARTBEAT_MS) return;
  g_lastHeartbeat = millis();
  snprintf(g_payload, sizeof(g_payload),
    "{\"reader_id\":\"%s\",\"company_id\":\"%s\",\"firmware\":\"%s\",\"queue\":%d}",
    cfg.readerId, cfg.companyId, FW_VERSION, g_queueSize);
  snprintf(g_url, sizeof(g_url), "%s/api/hardware/ping", cfg.backend);
  bool isHttps = strncmp(cfg.backend, "https", 5) == 0;
  if (isHttps) {
    WiFiClientSecure c; c.setInsecure(); HTTPClient h;
    if (h.begin(c, g_url)) { h.setTimeout(6000); h.setReuse(false);
      h.addHeader("Content-Type","application/json");
      Serial.printf("PING: %d\n", h.POST(g_payload)); h.end(); }
  } else {
    WiFiClient c; HTTPClient h;
    if (h.begin(c, g_url)) { h.setTimeout(6000); h.setReuse(false);
      h.addHeader("Content-Type","application/json");
      Serial.printf("PING: %d\n", h.POST(g_payload)); h.end(); }
  }
}

// ── RFID ─────────────────────────────
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
    char hex[5]; snprintf(hex, sizeof(hex), "%02X", rfid.uid.uidByte[i]);
    strlcat(g_uid, hex, sizeof(g_uid));
  }
  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();

  uint32_t hash = fnv1a(g_uid);

  // ── TAG ADMIN ──────────────────────
  if (strcmp(g_uid, ADMIN_UID) == 0) {
    if (g_adminMode) {
      // seconda lettura → RESET
      Serial.println("ADMIN RESET!");
      beepErr();
      tft.fillRect(0, HDR_H, 480, FTR_Y - HDR_H, C_BG);
      tft.setTextColor(C_RED, C_BG);
      tft.setTextSize(4);
      // centra RESET: 5char*24=120px → x=(480-120)/2=180
      tft.setCursor(180, 140);
      tft.print("RESET");
      drawHeader(); drawFooter();
      delay(2000);
      g_adminMode = false;
      WiFi.disconnect(true);
      clearConfig();
      delay(500);
      ESP.restart();
    } else {
      // prima lettura → mostra info config
      Serial.println("ADMIN MODE attivato");
      beepOk();
      g_adminMode  = true;
      g_adminTimer = millis();
      g_lastHash   = 0; // azzera debounce per rilevare seconda lettura
      drawAdmin();
    }
    return;
  }

  // tag diverso durante admin mode → esci
  if (g_adminMode) {
    g_adminMode = false;
    showIdle();
  }

  // debounce normale
  if (hash == g_lastHash && millis() - g_lastRead < g_debouncMs) return;
  g_lastHash = hash;
  g_lastRead = millis();

  Serial.printf("TAG: %s\n", g_uid);
  beepOk();

  String isoTs = getISOTimestamp();
  if (isoTs.length() > 0)
    snprintf(g_payload, sizeof(g_payload),
      "{\"uid\":\"%s\",\"reader_id\":\"%s\",\"company_id\":\"%s\",\"timestamp\":\"%s\",\"offline\":false}",
      g_uid, cfg.readerId, cfg.companyId, isoTs.c_str());
  else
    snprintf(g_payload, sizeof(g_payload),
      "{\"uid\":\"%s\",\"reader_id\":\"%s\",\"company_id\":\"%s\",\"offline\":false}",
      g_uid, cfg.readerId, cfg.companyId);

  int code = httpPost("/api/hardware/tag", g_payload);

  if (code <= 0) {
    beepOffline();
    queueAdd(g_uid, isoTs.length() > 0 ? isoTs.c_str() : "");
    showResult("OFFLINE", "Salvato in coda",
      isoTs.length() > 0 ? isoTs.substring(11, 19) : "");
  } else if (code != 200 && code != 201) {
    beepErr();
    showResult("ERRORE", "Tag non registrato", "");
  }
}

// ── WIFI ─────────────────────────────
void taskWifi() {
  if (WiFi.status() == WL_CONNECTED) {
    if (g_wifiOffline) {
      g_wifiOffline = false;
      Serial.println("WIFI RESTORED");
      if (syncNTP()) g_ntpSynced = true;
      queueFlush();
      showIdle();
    }
    return;
  }
  if (!g_wifiOffline) {
    g_wifiOffline   = true;
    g_lastReconnect = millis();
    Serial.println("WIFI OFFLINE");
    drawHeader();
  }
  if (millis() - g_lastReconnect > RECONNECT_MS) {
    g_lastReconnect = millis();
    Serial.println("WiFi reconnect...");
    if (!WiFi.reconnect()) WiFi.begin();
  }
}

// ── PROVISIONING ─────────────────────
void startProvisioning() {
  tft.fillScreen(C_BG);
  tft.setTextColor(C_WHITE, C_BG); tft.setTextSize(2);
  tft.setCursor(20, 60);  tft.print("Modalita configurazione");
  tft.setCursor(20, 100); tft.print("Connetti al WiFi:");
  tft.setTextColor(C_CYAN, C_BG); tft.setTextSize(3);
  char apName[32];
  snprintf(apName, sizeof(apName), "ContaOre-%06X", (uint32_t)(ESP.getEfuseMac() & 0xFFFFFF));
  tft.setCursor(20, 150); tft.print(apName);
  tft.setTextColor(C_GRAY, C_BG); tft.setTextSize(1);
  tft.setCursor(20, 210); tft.print("Poi vai su: 192.168.4.1");

  WiFiManager wm; wm.setConfigPortalTimeout(300);
  WiFiManagerParameter p_b("backend", "Backend URL", cfg.backend, 127);
  WiFiManagerParameter p_r("reader",  "Reader ID",   cfg.readerId,  63);
  WiFiManagerParameter p_c("company", "Company ID",  cfg.companyId, 63);
  wm.addParameter(&p_b); wm.addParameter(&p_r); wm.addParameter(&p_c);
  if (!wm.startConfigPortal(apName)) { ESP.restart(); return; }
  strlcpy(cfg.backend,   p_b.getValue(), sizeof(cfg.backend));
  strlcpy(cfg.readerId,  p_r.getValue(), sizeof(cfg.readerId));
  strlcpy(cfg.companyId, p_c.getValue(), sizeof(cfg.companyId));
  int len = strlen(cfg.backend);
  if (len > 0 && cfg.backend[len-1] == '/') cfg.backend[len-1] = '\0';
  saveConfig(); delay(500); ESP.restart();
}

// ── SERIAL ───────────────────────────
void taskSerial() {
  if (!Serial.available()) return;
  String cmd = Serial.readStringUntil('\n');
  cmd.trim(); cmd.toUpperCase();

  if (cmd == "RESET") {
    Serial.println("RESET CONFIG");
    WiFi.disconnect(true); clearConfig(); delay(1000); ESP.restart();
  } else if (cmd == "STATUS") {
    Serial.printf("Backend:  %s\n", cfg.backend);
    Serial.printf("Reader:   %s\n", cfg.readerId);
    Serial.printf("Company:  %s\n", cfg.companyId);
    Serial.printf("Queue:    %d\n", g_queueSize);
    Serial.printf("WiFi:     %s\n", WiFi.status()==WL_CONNECTED?"OK":"OFFLINE");
    Serial.printf("IP:       %s\n", WiFi.localIP().toString().c_str());
    Serial.printf("NTP:      %s\n", g_ntpSynced?"OK":"NO SYNC");
    Serial.printf("Time:     %s\n", getISOTimestamp().c_str());
    Serial.printf("DEBOUNCE: %lu ms\n", g_debouncMs);
    Serial.printf("DISPLAY:  %lu ms\n", g_resultTimeout);
  } else if (cmd == "FLUSH") {
    queueFlush();
  } else if (cmd.startsWith("DEBOUNCE ")) {
    unsigned long ms = cmd.substring(9).toInt();
    if (ms >= 500 && ms <= 30000) { g_debouncMs = ms; Serial.printf("DEBOUNCE → %lu ms\n", g_debouncMs); }
    else Serial.println("Valore non valido (500-30000)");
  } else if (cmd.startsWith("DISPLAY ")) {
    unsigned long ms = cmd.substring(8).toInt();
    if (ms >= 500 && ms <= 10000) { g_resultTimeout = ms; Serial.printf("DISPLAY → %lu ms\n", g_resultTimeout); }
    else Serial.println("Valore non valido (500-10000)");
  }
}

// ── SETUP ────────────────────────────
void setup() {
  Serial.begin(115200);
  pinMode(TFT_BL_PIN, OUTPUT); digitalWrite(TFT_BL_PIN, HIGH);
  tft.init(); tft.setRotation(1); tft.fillScreen(C_BG);

  tft.setTextColor(C_CYAN, C_BG); tft.setTextSize(4);
  tft.setCursor(100, 100); tft.print("ContaOre");
  tft.setTextColor(C_GRAY, C_BG); tft.setTextSize(2);
  tft.setCursor(160, 165); tft.print("NFC Reader");
  tft.setCursor(195, 195); tft.print("v"); tft.print(FW_VERSION);
  delay(1500);

  SPI.begin(); rfid.PCD_Init();
  pinMode(BUZZER_PIN, OUTPUT); digitalWrite(BUZZER_PIN, LOW);
  loadQueue();

  // ripristina orologio da NVS se disponibile
  prefs.begin(PREF_NAMESPACE, true);
  unsigned long savedTime = prefs.getULong("lastTime", 0);
  prefs.end();
  if (savedTime > 1000000000UL) {
    // imposta il tempo salvato + stima deriva (millis non conta da quando era spento)
    timeval tv = { (time_t)savedTime, 0 };
    settimeofday(&tv, nullptr);
    g_ntpSynced = true;
    Serial.printf("Tempo ripristinato da NVS: %lu\n", savedTime);
  }

  Serial.println("\nCONTAORE NFC ESP32 v" FW_VERSION);

  if (!loadConfig()) { startProvisioning(); return; }

  Serial.printf("Backend: %s\nReader: %s\nCompany: %s\nQueue: %d\n",
    cfg.backend, cfg.readerId, cfg.companyId, g_queueSize);

  tft.fillScreen(C_BG);
  tft.setTextColor(C_WHITE, C_BG); tft.setTextSize(2);
  tft.setCursor(20, 100); tft.print("Connessione WiFi...");

  WiFi.mode(WIFI_STA); WiFi.begin();
  unsigned long s = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - s < 15000) { delay(500); Serial.print("."); }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED) {
    Serial.printf("WIFI OK - IP: %s\n", WiFi.localIP().toString().c_str());
    if (syncNTP()) g_ntpSynced = true;
    beepOk(); queueFlush();
  } else {
    Serial.println("WIFI OFFLINE");
    g_wifiOffline = true; beepErr();
  }

  showIdle();
}

// ── LOOP ─────────────────────────────
void taskResult() {
  if (g_resultTimer == 0) return;
  if (millis() - g_resultTimer >= g_resultTimeout) {
    g_resultTimer = 0;
    showIdle();
  }
}

void taskAdmin() {
  if (!g_adminMode) return;
  if (millis() - g_adminTimer >= ADMIN_TIMEOUT_MS) {
    g_adminMode = false;
    Serial.println("ADMIN timeout → ritorno normale");
    showIdle();
  }
}

void loop() {
  taskSerial();
  taskWifi();
  updateClock();
  taskResult();
  taskAdmin();
  taskRfid();
  sendHeartbeat();
  delay(10);
}
