# 🔄 NFC TAG READING WORKFLOW - VISUAL SUMMARY

**Status:** Debugging guide for presence record creation issue
**Target:** Understand and fix why tag reads don't create database records

---

## 📊 SIMPLIFIED ARCHITECTURE

```
┌──────────────────────────────────────────────────────────────────────┐
│                                                                      │
│  ARDUINO ESP32 + RC522 RFID READER                                  │
│  ├─ File: /contaore/arduino/arduino.ino                             │
│  ├─ Line 780: httpPost("/api/hardware/tag", payload)                │
│  └─ Sends: { uid, reader_id, company_id, timestamp, offline }      │
│                                                                      │
└─────────────────────────┬──────────────────────────────────────────┘
                          │
                          │ HTTP POST
                          │
┌─────────────────────────▼──────────────────────────────────────────┐
│                                                                      │
│  FASTIFY BACKEND                                                    │
│  ├─ File: /contaore/backend/routes/hardware.js                     │
│  ├─ Route: POST /api/hardware/tag (lines 109-294)                  │
│  ├─ Validates uid, reader_id, company_id                           │
│  ├─ Queries dipendenti by badge_uid                                │
│  ├─ Loads fasce_orarie (time ranges)                               │
│  ├─ Determines tipo (ENTRATA/USCITA)                               │
│  └─ Inserts into presenza table                                    │
│                                                                      │
└─────────────────────────┬──────────────────────────────────────────┘
                          │
                          │ INSERT
                          │
┌─────────────────────────▼──────────────────────────────────────────┐
│                                                                      │
│  SUPABASE PostgreSQL DATABASE                                       │
│  ├─ Table: dipendenti                                              │
│  │  └─ Lookup by badge_uid = uid (must match!)                     │
│  ├─ Table: fasce_orarie                                            │
│  │  └─ Lookup by company_id                                        │
│  ├─ Table: presenza                                                │
│  │  ├─ company_id (UUID, foreign key)                              │
│  │  ├─ tag_uid (TEXT, from request uid)                            │
│  │  ├─ tipo (TEXT, ENTRATA or USCITA)                              │
│  │  ├─ created_at (TIMESTAMP, readDate)                            │
│  │  ├─ timestamp (TIMESTAMP, readDate) ← CRITICAL!                 │
│  │  └─ reader_id (TEXT, from request)                              │
│  │                                                                  │
│  └─ Result: New attendance record                                   │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 🔑 CRITICAL CODE SECTIONS

### 1. Arduino Hardware (arduino.ino)

**Location:** `/contaore/arduino/arduino.ino:780`

```javascript
// Arduino sends NFC tag to backend
int code = httpPost("/api/hardware/tag", g_payload);

// g_payload structure:
// {
//   "uid": "3605CA06",              // NFC tag UID (8 hex digits)
//   "reader_id": "reader123",        // Unique reader identifier
//   "company_id": "uuid-xxx",        // Company UUID
//   "timestamp": "2026-05-31...",   // ISO timestamp (for offline)
//   "offline": false                 // Was this offline read?
// }
```

**What can go wrong:**
- ❌ WiFi connection lost → POST never reaches backend
- ❌ Wrong endpoint URL → Hardware misconfigured
- ❌ reader_id or company_id mismatch → Invalid credentials

---

### 2. Backend Hardware Route (hardware.js)

**Location:** `/contaore/backend/routes/hardware.js:109-294`

#### A. Request Validation (lines 115-124)
```javascript
const { uid, reader_id, company_id, timestamp } = request.body

if (!uid || !reader_id || !company_id) {
  return reply.send({ success: false, error: 'MISSING_FIELDS' })
}
```
**Check:** Are all three fields provided?

#### B. Employee Lookup (lines 138-143)
```javascript
const { data: dipendente } = await supabase
  .from('dipendenti')
  .select('id, nome, cognome')
  .eq('badge_uid', uid)              // ← uid MUST match this field
  .eq('company_id', company_id)
  .maybeSingle()
```
**Critical:** If dipendente is NULL → `TAG_NOT_REGISTERED` error
**Requirement:** `dipendenti.badge_uid` must equal the tag UID

#### C. Time Range Lookup (lines 177-181)
```javascript
const { data: fasce } = await supabase
  .from('fasce_orarie')
  .select('*')
  .eq('company_id', company_id)
  .order('ora_inizio', { ascending: true })
```
**Optional:** If empty, defaults to last-presence toggle logic

#### D. Last Presence Query (lines 188-196)
```javascript
const { data: lastPresence } = await supabase
  .from('presenza')
  .select('tipo, created_at')
  .eq('tag_uid', uid)
  .eq('company_id', company_id)
  .lt('created_at', readDate.toISOString())
  .order('created_at', { ascending: false })
  .limit(1)
  .maybeSingle()
```
**Purpose:** Determine whether this is ENTRATA or USCITA

#### E. Type Determination Logic (lines 203-241)
```javascript
let tipo = 'ENTRATA'

// If fasce_orarie exists, use its tipo
if (fasciaAttiva) {
  tipo = fasciaAttiva.tipo

  // If last read was same tipo in same time range, invert
  if (lastPresence && lastPresence.tipo === fasciaAttiva.tipo) {
    if (eraInFascia) {
      tipo = tipo === 'ENTRATA' ? 'USCITA' : 'ENTRATA'
    }
  }
} else {
  // No time ranges, just toggle from last presence
  if (lastPresence?.tipo === 'ENTRATA') {
    tipo = 'USCITA'
  } else {
    tipo = 'ENTRATA'
  }
}
```
**Logic:** Intelligently determines ENTRATA or USCITA

#### F. Database Insert (lines 251-260)
```javascript
const { data: insertedPresence, error: insertError } = await supabase
  .from('presenza')
  .insert({
    company_id,                    // From request
    tag_uid: uid,                  // From request
    reader_id,                     // From request
    tipo,                          // Calculated
    created_at: readDate.toISOString(),    // Request timestamp or now
    timestamp: readDate.toISOString()      // ← CRITICAL!
  })
  .select()

if (insertError) {
  console.log('insert presenza error:', insertError)
  return reply.send({ success: false, error: insertError.message })
}
```
**Critical:** Both `created_at` and `timestamp` must be set

#### G. Response (lines 279-284)
```javascript
return reply.send({
  success: true,
  tipo,                                    // ENTRATA or USCITA
  fascia: fasciaAttiva?.nome || null,     // Active time range name
  dipendente: `${dipendente.nome} ${dipendente.cognome}`
})
```

---

## 🗄️ DATABASE SCHEMA REQUIREMENTS

### Presence Table (presenza)

**Location:** Supabase PostgreSQL

**Required Columns:**
```sql
CREATE TABLE presenza (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES company(id),
  tag_uid TEXT NOT NULL,                          -- Match dipendenti.badge_uid
  reader_id TEXT NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('ENTRATA', 'USCITA')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP   -- ← ADDED IN FIX
);
```

**Indexes:**
```sql
-- For efficient queries
CREATE INDEX idx_presenza_tag_uid ON presenza(tag_uid);
CREATE INDEX idx_presenza_company_id ON presenza(company_id);
CREATE INDEX idx_presenza_created_at ON presenza(created_at DESC);
CREATE INDEX idx_presenza_timestamp ON presenza(timestamp DESC);
```

### Employee Table (dipendenti)

**Critical Field:** `badge_uid`

```sql
CREATE TABLE dipendenti (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES company(id),
  badge_uid TEXT UNIQUE,  -- ← Must match tag UID!
  nome TEXT NOT NULL,
  cognome TEXT NOT NULL,
  -- ... other fields
);
```

**Key Point:** Hardware.js searches `dipendenti` by `badge_uid = request.uid`
- If tag UID is "3605CA06"
- Employee's `badge_uid` must be "3605CA06"
- **Case-sensitive comparison!**

### Time Ranges Table (fasce_orarie)

**Optional but recommended:**

```sql
CREATE TABLE fasce_orarie (
  id UUID PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES company(id),
  nome TEXT NOT NULL,        -- e.g., "Turno Mattino"
  ora_inizio TIME NOT NULL,  -- e.g., "06:00"
  ora_fine TIME NOT NULL,    -- e.g., "14:00"
  tipo TEXT NOT NULL,        -- ENTRATA or USCITA
);
```

**Purpose:** Defines work shift patterns
- If employee reads tag during "Turno Mattino" (ENTRATA), it's marked as ENTRATA
- If they read again in same timeframe, it toggles to USCITA
- If no fasce_orarie exist, logic defaults to toggling based on last presence

---

## 🎯 DECISION FLOW

```
Tag Read Received
    ↓
[1] Validate uid, reader_id, company_id exist?
    ├─ NO → Return 'MISSING_FIELDS' error
    └─ YES ↓
[2] Query dipendenti where badge_uid = uid?
    ├─ NULL → Return 'TAG_NOT_REGISTERED' error (success: true)
    └─ FOUND → Proceed ↓
[3] Query fasce_orarie for this company?
    ├─ EMPTY → Use lastPresence toggle logic
    └─ FOUND → Use fascia.tipo logic ↓
[4] Determine tipo (ENTRATA/USCITA)
    ↓
[5] INSERT into presenza table
    ├─ ERROR → Return error message
    └─ SUCCESS → Return tipo and employee name
```

---

## ❌ COMMON FAILURE POINTS

### Failure 1: TAG_NOT_REGISTERED
**Cause:** `badge_uid` in dipendenti doesn't match tag UID

**Hardware Response:**
```json
{
  "success": true,
  "tipo": null,
  "error": "TAG_NOT_REGISTERED"
}
```

**Fix:**
```sql
UPDATE dipendenti
SET badge_uid = '3605CA06'  -- Your tag UID
WHERE id = 'employee-id';
```

---

### Failure 2: Missing Presence Record
**Cause:** Insert statement failed (likely missing `timestamp` column)

**Backend Error Log:**
```
insert presenza error: column "timestamp" does not exist
```

**Fix:**
```sql
ALTER TABLE presenza
ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
```

---

### Failure 3: No Network Connection
**Cause:** Arduino can't reach backend endpoint

**Symptom:** No logs, no presence records

**Debug:**
```bash
# Check if Arduino can reach backend
ping backend-server-ip
curl http://backend-server-ip:3000

# Check Arduino firmware logs
# (use serial monitor, should show HTTP response code)
```

---

### Failure 4: Company ID Mismatch
**Cause:** Arduino sends wrong company_id

**Fix:** Update Arduino config with correct UUID

**Database Check:**
```sql
SELECT * FROM company;
-- Get the correct company_id and update Arduino config
```

---

## 🔍 DEBUGGING WORKFLOW

### Step 1: Check Hardware Connection
```bash
# Can Arduino reach backend?
curl -X POST http://backend-ip:3000/api/hardware/tag \
  -H "Content-Type: application/json" \
  -d '{
    "uid": "TEST1234",
    "reader_id": "debug-reader",
    "company_id": "00000000-0000-0000-0000-000000000001"
  }'

# Expected: { "success": true, "tipo": null, "error": "TAG_NOT_REGISTERED" }
```

### Step 2: Verify Employee Data
```sql
-- Does the employee exist?
SELECT * FROM dipendenti WHERE badge_uid = '3605CA06';

-- If NULL or missing:
UPDATE dipendenti
SET badge_uid = '3605CA06'
WHERE id = 'employee-id'
AND company_id = 'correct-company-id';
```

### Step 3: Check Database Structure
```sql
-- Does timestamp column exist?
SELECT COUNT(*) FROM information_schema.columns
WHERE table_name = 'presenza' AND column_name = 'timestamp';

-- If 0, apply fix:
ALTER TABLE presenza
ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
```

### Step 4: Test Complete Flow
```bash
# After registering badge_uid, test again
curl -X POST http://backend-ip:3000/api/hardware/tag \
  -H "Content-Type: application/json" \
  -d '{
    "uid": "3605CA06",
    "reader_id": "test-reader",
    "company_id": "correct-uuid"
  }'

# Expected: { "success": true, "tipo": "ENTRATA", "dipendente": "Name" }
```

### Step 5: Verify Database Record
```sql
-- Check if presence record was created
SELECT * FROM presenza
WHERE tag_uid = '3605CA06'
ORDER BY created_at DESC
LIMIT 1;

-- Should show new record with tipo and timestamp
```

---

## ✅ SUCCESS CHECKLIST

- [ ] Backend responds to `/api/hardware/tag` POST requests
- [ ] `dipendenti.badge_uid` matches all tag UIDs in use
- [ ] `presenza` table has `timestamp` column
- [ ] Company ID from Arduino matches company in database
- [ ] At least one `fasce_orarie` record exists (or accept default logic)
- [ ] Presence records appearing after successful hardware responses
- [ ] ENTRATA/USCITA alternating correctly

---

## 📞 QUICK REFERENCE

| Component | File | Key Lines | Purpose |
|-----------|------|-----------|---------|
| **Hardware** | arduino.ino | 780 | POST tag data |
| **Backend Route** | hardware.js | 109-294 | Process tag, create presence |
| **Employee Lookup** | hardware.js | 138-143 | Find employee by badge_uid |
| **Type Logic** | hardware.js | 203-241 | Determine ENTRATA/USCITA |
| **Database Insert** | hardware.js | 251-260 | Create presence record |
| **Database Table** | Supabase | - | Store attendance records |

---

**Last Updated:** 31 Maggio 2026
**Status:** Complete Workflow Documentation
