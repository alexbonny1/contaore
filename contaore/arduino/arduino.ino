/*
 * ContaOre NFC Reader Firmware
 * ESP8266 NodeMCU + RC522
 * v10.0.0
 */

#include <Arduino.h>
#include <ESP8266WiFi.h>
#include <ESP8266HTTPClient.h>
#include <WiFiClientSecure.h>
#include <WiFiManager.h>
#include <LittleFS.h>
#include <ArduinoJson.h>
#include <SPI.h>
#include <MFRC522.h>
#include <time.h>

/*
────────────────────────────────────
PIN
────────────────────────────────────
*/

#define SS_PIN    D4
#define RST_PIN   D3
#define LED_OK    D1
#define LED_ERR   D2
#define PIN_RESET D0

/*
────────────────────────────────────
CONFIG
────────────────────────────────────
*/

#define FW_VERSION       "10.0.0"
#define CONFIG_FILE      "/config.json"
#define QUEUE_FILE       "/queue.txt"
#define QUEUE_TMP        "/queue_tmp.txt"
#define WIFI_TIMEOUT_MS  20000UL
#define HEARTBEAT_MS     60000UL
#define DEBOUNCE_MS      5000UL
#define QUEUE_MAX        100
#define RECONNECT_MS     10000UL   // riprova WiFi ogni 10s

/*
────────────────────────────────────
NTP
────────────────────────────────────
*/

#define NTP_SERVER   "pool.ntp.org"
#define TZ_OFFSET    3600          // UTC+1 (ora solare)
#define TZ_DST       3600          // +1 ora legale

bool g_ntpSynced = false;

/*
────────────────────────────────────
STRUCT
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
RFID
────────────────────────────────────
*/

MFRC522 rfid(SS_PIN, RST_PIN);

/*
────────────────────────────────────
GLOBALS
────────────────────────────────────
*/

char g_uid[64];
char g_payload[600];
char g_url[256];

unsigned long g_lastHeartbeat = 0;
unsigned long g_lastRead      = 0;
unsigned long g_lastReconnect = 0;

uint32_t g_lastHash = 0;

bool g_wifiOffline = false;

int g_queueSize = 0;

/*
────────────────────────────────────
LED
────────────────────────────────────
*/

void ledOk(int timeMs = 120) {
  digitalWrite(LED_OK, HIGH);
  delay(timeMs);
  digitalWrite(LED_OK, LOW);
}

void ledErr(int timeMs = 250) {
  digitalWrite(LED_ERR, HIGH);
  delay(timeMs);
  digitalWrite(LED_ERR, LOW);
}

void ledDouble() {
  ledOk(80); delay(80); ledOk(80);
}

/*
────────────────────────────────────
HASH
────────────────────────────────────
*/

uint32_t fnv1a(const char* s) {
  uint32_t h = 0x811c9dc5;
  while (*s) {
    h ^= (uint8_t)*s++;
    h *= 0x01000193;
  }
  return h;
}

/*
────────────────────────────────────
NTP - OTTIENI TIMESTAMP ISO
────────────────────────────────────
*/

bool syncNTP() {
  configTime(TZ_OFFSET, TZ_DST, NTP_SERVER);
  Serial.print("NTP sync");
  unsigned long start = millis();
  while (time(nullptr) < 1000000000UL) {
    if (millis() - start > 5000) {
      Serial.println(" FAIL");
      return false;
    }
    delay(200);
    Serial.print(".");
  }
  Serial.println(" OK");
  return true;
}

/*
  Ritorna timestamp ISO 8601 UTC dell'ora attuale
  es: "2026-05-20T10:30:00Z"
*/
String getISOTimestamp() {
  time_t now = time(nullptr);
  if (now < 1000000000UL) {
    return "";  // NTP non sincronizzato
  }
  struct tm* t = gmtime(&now);
  char buf[32];
  snprintf(
    buf, sizeof(buf),
    "%04d-%02d-%02dT%02d:%02d:%02dZ",
    t->tm_year + 1900,
    t->tm_mon + 1,
    t->tm_mday,
    t->tm_hour,
    t->tm_min,
    t->tm_sec
  );
  return String(buf);
}

/*
────────────────────────────────────
LOAD CONFIG
────────────────────────────────────
*/

bool loadConfig() {

  if (!LittleFS.exists(CONFIG_FILE)) return false;

  File f = LittleFS.open(CONFIG_FILE, "r");
  if (!f) return false;

  StaticJsonDocument<512> doc;
  DeserializationError err = deserializeJson(doc, f);
  f.close();

  if (err) return false;

  strlcpy(cfg.backend,   doc["backend"]   | "", sizeof(cfg.backend));
  strlcpy(cfg.readerId,  doc["readerId"]  | "", sizeof(cfg.readerId));
  strlcpy(cfg.companyId, doc["companyId"] | "", sizeof(cfg.companyId));

  cfg.valid =
    strlen(cfg.backend)   > 3 &&
    strlen(cfg.readerId)  > 1 &&
    strlen(cfg.companyId) > 10;

  return cfg.valid;

}

/*
────────────────────────────────────
SAVE CONFIG
────────────────────────────────────
*/

void saveConfig() {

  StaticJsonDocument<512> doc;
  doc["backend"]   = cfg.backend;
  doc["readerId"]  = cfg.readerId;
  doc["companyId"] = cfg.companyId;

  File f = LittleFS.open(CONFIG_FILE, "w");
  if (!f) return;

  serializeJson(doc, f);
  f.close();

}

/*
────────────────────────────────────
LOAD QUEUE SIZE
────────────────────────────────────
*/

void loadQueueSize() {

  g_queueSize = 0;

  if (!LittleFS.exists(QUEUE_FILE)) return;

  File f = LittleFS.open(QUEUE_FILE, "r");
  if (!f) return;

  while (f.available()) {
    String line = f.readStringUntil('\n');
    line.trim();
    if (line.length() > 2) g_queueSize++;
  }

  f.close();

}

/*
────────────────────────────────────
PROVISIONING
────────────────────────────────────
*/

void startProvisioning() {

  WiFiManager wm;
  wm.setConfigPortalTimeout(300);

  char apName[32];
  snprintf(apName, sizeof(apName), "ContaOre-%06X", ESP.getChipId());

  WiFiManagerParameter p_backend(
    "backend", "Backend URL (es: https://xxx.railway.app)",
    cfg.backend, 127
  );
  WiFiManagerParameter p_reader(
    "reader", "Reader ID (es: lettore-1)",
    cfg.readerId, 63
  );
  WiFiManagerParameter p_company(
    "company", "Company ID (UUID dal pannello admin)",
    cfg.companyId, 63
  );

  wm.addParameter(&p_backend);
  wm.addParameter(&p_reader);
  wm.addParameter(&p_company);

  digitalWrite(LED_ERR, HIGH);
  bool ok = wm.startConfigPortal(apName);
  digitalWrite(LED_ERR, LOW);

  if (!ok) {
    ESP.restart();
    return;
  }

  strlcpy(cfg.backend,   p_backend.getValue(),  sizeof(cfg.backend));
  strlcpy(cfg.readerId,  p_reader.getValue(),   sizeof(cfg.readerId));
  strlcpy(cfg.companyId, p_company.getValue(),  sizeof(cfg.companyId));

  int len = strlen(cfg.backend);
  if (len > 0 && cfg.backend[len - 1] == '/') {
    cfg.backend[len - 1] = '\0';
  }

  saveConfig();
  delay(1000);
  ESP.restart();

}

/*
────────────────────────────────────
HTTP POST
────────────────────────────────────
*/

int httpPost(const char* path, const char* payload) {

  if (WiFi.status() != WL_CONNECTED || WiFi.localIP() == INADDR_NONE) {
    return -1;
  }

  snprintf(g_url, sizeof(g_url), "%s%s", cfg.backend, path);

  Serial.print("POST ");
  Serial.println(g_url);

  HTTPClient http;
  int code = -1;

  bool isHttps = strncmp(cfg.backend, "https", 5) == 0;

  if (isHttps) {
    WiFiClientSecure client;
    client.setInsecure();
    if (!http.begin(client, g_url)) return -1;
    http.setTimeout(8000);
    http.setReuse(false);
    http.addHeader("Content-Type", "application/json");
    code = http.POST(payload);
    http.end();
  } else {
    WiFiClient client;
    if (!http.begin(client, g_url)) return -1;
    http.setTimeout(8000);
    http.setReuse(false);
    http.addHeader("Content-Type", "application/json");
    code = http.POST(payload);
    http.end();
  }

  Serial.print("CODE: ");
  Serial.println(code);

  return code;

}

/*
────────────────────────────────────
QUEUE ADD
salva uid + timestamp ISO
────────────────────────────────────
*/

void queueAdd(const char* uid, const char* isoTimestamp) {

  if (g_queueSize >= QUEUE_MAX) {
    Serial.println("QUEUE FULL");
    return;
  }

  const char* mode = LittleFS.exists(QUEUE_FILE) ? "a" : "w";

  File f = LittleFS.open(QUEUE_FILE, mode);
  if (!f) return;

  // formato riga: "UID|2026-05-20T10:30:00Z"
  f.print(uid);
  f.print("|");
  f.println(isoTimestamp);
  f.close();

  g_queueSize++;
  Serial.print("QUEUE +1 (tot: ");
  Serial.print(g_queueSize);
  Serial.println(")");

}

/*
────────────────────────────────────
QUEUE FLUSH
────────────────────────────────────
*/

void queueFlush() {

  if (WiFi.status() != WL_CONNECTED) return;
  if (!LittleFS.exists(QUEUE_FILE))  return;

  Serial.println("FLUSH QUEUE...");

  File src = LittleFS.open(QUEUE_FILE, "r");
  if (!src) return;

  File tmp = LittleFS.open(QUEUE_TMP, "w");
  if (!tmp) { src.close(); return; }

  int sent   = 0;
  int failed = 0;

  while (src.available()) {

    String line = src.readStringUntil('\n');
    line.trim();

    if (line.length() < 3) continue;

    // parse "UID|TIMESTAMP"
    int sep = line.indexOf('|');
    String uid       = sep > 0 ? line.substring(0, sep) : line;
    String timestamp = sep > 0 ? line.substring(sep + 1) : "";



    // costruisce payload con timestamp reale
    if (timestamp.length() > 0) {
      snprintf(
        g_payload,
        sizeof(g_payload),
        "{"
        "\"uid\":\"%s\","
        "\"reader_id\":\"%s\","
        "\"company_id\":\"%s\","
        "\"timestamp\":\"%s\","
        "\"offline\":true"
        "}",
        uid.c_str(),
        cfg.readerId,
        cfg.companyId,
        timestamp.c_str()
      );
    } else {
      // vecchio formato senza timestamp
      snprintf(
        g_payload,
        sizeof(g_payload),
        "{"
        "\"uid\":\"%s\","
        "\"reader_id\":\"%s\","
        "\"company_id\":\"%s\","
        "\"offline\":true"
        "}",
        uid.c_str(),
        cfg.readerId,
        cfg.companyId
      );
    }

    int code = httpPost("/api/hardware/tag", g_payload);

    if (code == 200 || code == 201) {
      sent++;
    } else {
      tmp.println(line);  // rimetti la riga originale
      failed++;
    }

    delay(300);

  }

  src.close();
  tmp.close();

  LittleFS.remove(QUEUE_FILE);

  if (failed > 0) {
    LittleFS.rename(QUEUE_TMP, QUEUE_FILE);
    g_queueSize = failed;
  } else {
    LittleFS.remove(QUEUE_TMP);
    g_queueSize = 0;
  }

  Serial.print("FLUSH: sent=");
  Serial.print(sent);
  Serial.print(" failed=");
  Serial.println(failed);

}

/*
────────────────────────────────────
HEARTBEAT
────────────────────────────────────
*/

void sendHeartbeat() {

  if (millis() - g_lastHeartbeat < HEARTBEAT_MS) return;

  g_lastHeartbeat = millis();

  snprintf(
    g_payload,
    sizeof(g_payload),
    "{"
    "\"reader_id\":\"%s\","
    "\"company_id\":\"%s\","
    "\"firmware\":\"%s\","
    "\"queue\":%d"
    "}",
    cfg.readerId,
    cfg.companyId,
    FW_VERSION,
    g_queueSize
  );

  int code = httpPost("/api/hardware/ping", g_payload);

  if (code == 200) {
    ledOk(60);
  }

}

/*
────────────────────────────────────
RFID
────────────────────────────────────
*/

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

  if (hash == g_lastHash && millis() - g_lastRead < DEBOUNCE_MS) {
    return;
  }

  g_lastHash = hash;
  g_lastRead = millis();

  Serial.print("TAG: ");
  Serial.println(g_uid);

  // ottieni timestamp reale
  String isoTs = getISOTimestamp();
  Serial.print("TIMESTAMP: ");
Serial.println(isoTs.length() > 0 ? isoTs : "VUOTO");

  if (isoTs.length() > 0) {
    snprintf(
      g_payload,
      sizeof(g_payload),
      "{"
      "\"uid\":\"%s\","
      "\"reader_id\":\"%s\","
      "\"company_id\":\"%s\","
      "\"timestamp\":\"%s\","
      "\"offline\":false"
      "}",
      g_uid,
      cfg.readerId,
      cfg.companyId,
      isoTs.c_str()
    );
  } else {
    snprintf(
      g_payload,
      sizeof(g_payload),
      "{"
      "\"uid\":\"%s\","
      "\"reader_id\":\"%s\","
      "\"company_id\":\"%s\","
      "\"offline\":false"
      "}",
      g_uid,
      cfg.readerId,
      cfg.companyId
    );
  }

  int code = httpPost("/api/hardware/tag", g_payload);

  if (code == 200 || code == 201) {

    ledDouble();

  } else {

    ledErr();

    if (code <= 0) {
      // salva nella queue con timestamp
      if (isoTs.length() > 0) {
        queueAdd(g_uid, isoTs.c_str());
      } else {
        queueAdd(g_uid, "");
      }
    }

  }

}

/*
────────────────────────────────────
WIFI TASK
riprova connessione ogni RECONNECT_MS
────────────────────────────────────
*/

void taskWifi() {

  if (WiFi.status() == WL_CONNECTED) {

    if (g_wifiOffline) {

      g_wifiOffline = false;
      digitalWrite(LED_ERR, LOW);
      Serial.println("WIFI RESTORED");

      // risincronizza NTP per correggere eventuale deriva
      syncNTP();

      delay(500);
      queueFlush();

    }

    return;

  }

  // WiFi disconnesso
  if (!g_wifiOffline) {
    g_wifiOffline   = true;
    // NON resettiamo g_ntpSynced: il clock interno
    // continua a funzionare anche senza WiFi
    g_lastReconnect = millis();
    digitalWrite(LED_ERR, HIGH);
    Serial.println("WIFI OFFLINE");
  }

  // riprova ogni RECONNECT_MS senza disconnect
  if (millis() - g_lastReconnect > RECONNECT_MS) {

    g_lastReconnect = millis();

    Serial.println("WiFi reconnect...");

    // usa WiFi.reconnect() che e piu stabile di disconnect+begin
    if (!WiFi.reconnect()) {
      // se reconnect fallisce prova begin con le credenziali salvate
      WiFi.begin();
    }

  }

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
    LittleFS.remove(CONFIG_FILE);
    delay(1000);
    ESP.restart();

  } else if (cmd == "STATUS") {

    Serial.print("Backend: "); Serial.println(cfg.backend);
    Serial.print("Reader:  "); Serial.println(cfg.readerId);
    Serial.print("Company: "); Serial.println(cfg.companyId);
    Serial.print("Queue:   "); Serial.println(g_queueSize);
    Serial.print("WiFi:    "); Serial.println(WiFi.status() == WL_CONNECTED ? "OK" : "OFFLINE");
    Serial.print("IP:      "); Serial.println(WiFi.localIP());
    Serial.print("NTP:     "); Serial.println(g_ntpSynced ? "OK" : "NO SYNC");
    Serial.print("Time:    "); Serial.println(getISOTimestamp());

  } else if (cmd == "FLUSH") {

    queueFlush();

  }

}

/*
────────────────────────────────────
RESET FISICO
────────────────────────────────────
*/

void checkPhysicalReset() {

  pinMode(PIN_RESET, INPUT_PULLUP);

  if (digitalRead(PIN_RESET) == HIGH) return;

  Serial.println("PHYSICAL RESET HOLD...");

  unsigned long start = millis();

  while (digitalRead(PIN_RESET) == LOW) {

    if (millis() - start > 5000) {

      Serial.println("RESET!");

      for (int i = 0; i < 5; i++) {
        ledErr(100);
        delay(100);
      }

      WiFi.disconnect(true);
      LittleFS.remove(CONFIG_FILE);
      delay(500);
      ESP.restart();

    }

    delay(100);

  }

}

/*
────────────────────────────────────
SETUP
────────────────────────────────────
*/

void setup() {

  Serial.begin(115200);

  pinMode(LED_OK,  OUTPUT);
  pinMode(LED_ERR, OUTPUT);

  digitalWrite(LED_OK,  LOW);
  digitalWrite(LED_ERR, LOW);

  LittleFS.begin();

  checkPhysicalReset();

  loadQueueSize();

  SPI.begin();
  rfid.PCD_Init();

  Serial.println("");
  Serial.println("CONTAORE NFC");
  Serial.println(FW_VERSION);

  bool ok = loadConfig();

  if (!ok) {
    Serial.println("START PROVISIONING");
    startProvisioning();
    return;
  }

  Serial.print("Backend: "); Serial.println(cfg.backend);
  Serial.print("Reader:  "); Serial.println(cfg.readerId);
  Serial.print("Company: "); Serial.println(cfg.companyId);
  Serial.print("Queue:   "); Serial.println(g_queueSize);

  WiFi.mode(WIFI_STA);
  WiFi.begin();

  unsigned long start = millis();

  while (WiFi.status() != WL_CONNECTED && millis() - start < WIFI_TIMEOUT_MS) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("");

  if (WiFi.status() == WL_CONNECTED) {

    Serial.print("WIFI OK - IP: ");
    Serial.println(WiFi.localIP());

    // sincronizza NTP subito
    if (syncNTP()) {
      g_ntpSynced = true;
      Serial.print("TIME: ");
      Serial.println(getISOTimestamp());
    }

    ledDouble();

    queueFlush();

  } else {

    Serial.println("WIFI OFFLINE");
    g_wifiOffline = true;
    digitalWrite(LED_ERR, HIGH);

  }

}

/*
────────────────────────────────────
LOOP
────────────────────────────────────
*/

void loop() {

  taskSerial();
  taskWifi();
  taskRfid();
  sendHeartbeat();

  delay(10);

}
