# 🔍 NFC TAG READING DEBUG GUIDE

**Data:** 31 Maggio 2026
**Status:** ❌ Tag reads not creating presence records
**Diagnosis:** Complete workflow analysis and debugging checklist

---

## 📡 WORKFLOW ARCHITECTURE

### 1️⃣ HARDWARE FLOW (Arduino → Backend)

```
┌─────────────────────────────────────────────────────────────────┐
│                         ARDUINO (ESP32)                         │
│                                                                 │
│  1. RC522 reads NFC tag → UID extracted                         │
│  2. Creates JSON payload:                                        │
│     {                                                            │
│       "uid": "3605CA06",                                         │
│       "reader_id": "reader123",                                  │
│       "company_id": "uuid-xxx",                                  │
│       "timestamp": "2026-05-31T12:34:56Z",                       │
│       "offline": false                                           │
│     }                                                            │
│  3. HTTP POST to Backend                                         │
│     POST /api/hardware/tag                                       │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│              BACKEND (Fastify) - hardware.js                    │
│                                                                 │
│  Route: POST /api/hardware/tag                                   │
│  Location: routes/hardware.js:109-294                            │
│                                                                 │
│  Processing Steps:                                               │
│  ✅ 1. Validate request (uid, reader_id, company_id)            │
│  ✅ 2. Get read date (timestamp or now)                         │
│  ✅ 3. Query dipendenti table by badge_uid                      │
│  ✅ 4. Load company fasce_orarie (time ranges)                  │
│  ✅ 5. Get last presence for this tag                           │
│  ✅ 6. Determine tipo (ENTRATA/USCITA)                          │
│  ✅ 7. INSERT into presenza table                               │
│  ✅ 8. UPDATE dispositivo (reader status)                       │
└────────────────────┬───────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE (Supabase)                          │
│                                                                 │
│  Table: presenza                                                │
│  Columns: id, company_id, tag_uid, tipo, created_at,           │
│           updated_at, timestamp, reader_id                      │
│                                                                 │
│  ✅ New presence record created with:                           │
│     - company_id (from request)                                 │
│     - tag_uid (from request uid)                                │
│     - tipo (calculated: ENTRATA or USCITA)                      │
│     - created_at (readDate.toISOString())                       │
│     - timestamp (readDate.toISOString())                        │
│     - reader_id (from request)                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔴 CRITICAL REQUIREMENTS FOR SUCCESS

### 1. Tag Must Be Associated with Employee
**File:** `hardware.js:138-143`

```javascript
const { data: dipendente } = await supabase
  .from('dipendenti')
  .select('id, nome, cognome')
  .eq('badge_uid', uid)  // ← uid must match this field
  .eq('company_id', company_id)
  .maybeSingle()
```

**Database Check:**
```sql
-- Check if tag UID is registered to an employee
SELECT id, badge_uid, nome, cognome
FROM dipendenti
WHERE badge_uid = '3605CA06'  -- Use your actual tag UID
AND company_id = 'your-company-id';

-- If empty → TAG NOT REGISTERED
-- If found → OK to proceed
```

**Fix (if tag not registered):**
```sql
UPDATE dipendenti
SET badge_uid = '3605CA06'
WHERE id = 'employee-id'
AND company_id = 'your-company-id';
```

---

### 2. Employee Must Belong to Correct Company
**File:** `hardware.js:138-143`

The query checks BOTH:
- ✅ `badge_uid` matches the tag UID
- ✅ `company_id` matches the reader's company_id

**If company_id mismatch:**
- Arduino sends company_id = "company-abc"
- Employee's company_id = "company-xyz"
- Result: `dipendente` will be NULL → "TAG_NOT_REGISTERED" error

**Debug:**
```sql
-- Check Arduino's company_id matches
SELECT * FROM dipendenti WHERE badge_uid = '3605CA06';
-- Compare the company_id field with what Arduino is sending
```

---

### 3. Time Ranges (Fasce Orarie) Must Exist
**File:** `hardware.js:177-181`

```javascript
const { data: fasce } = await supabase
  .from('fasce_orarie')
  .select('*')
  .eq('company_id', company_id)
  .order('ora_inizio', { ascending: true })
```

**If no fasce_orarie exist:**
- `fasce` will be empty array
- Logic defaults to toggle based on last presence
- **Still works** but less intelligent

**Debug:**
```sql
SELECT * FROM fasce_orarie
WHERE company_id = 'your-company-id';
```

---

### 4. Presence Table Structure
**File:** `hardware.js:251-260`

The INSERT statement requires:
```javascript
{
  company_id,      // ✅ Required
  tag_uid,         // ✅ Required (from uid)
  reader_id,       // ✅ Required
  tipo,            // ✅ Required (ENTRATA/USCITA)
  created_at,      // ✅ Required (readDate.toISOString())
  timestamp        // ✅ Required (readDate.toISOString())
}
```

**Database check:**
```sql
-- Verify presenza table structure
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'presenza'
ORDER BY ordinal_position;

-- Expected columns:
-- id (uuid)
-- company_id (uuid)
-- tag_uid (text)
-- tipo (text: ENTRATA or USCITA)
-- created_at (timestamp)
-- updated_at (timestamp)
-- timestamp (timestamp)
-- reader_id (text)
```

**Verify fix applied:**
```sql
-- timestamp column should exist
SELECT COUNT(*) FROM information_schema.columns
WHERE table_name = 'presenza' AND column_name = 'timestamp';
-- Expected: 1 (if 0, timestamp is missing!)
```

---

## ⚠️ COMMON FAILURE POINTS

### ❌ Failure 1: "TAG_NOT_REGISTERED"

**Response from hardware.js:163-167:**
```json
{
  "success": true,
  "tipo": null,
  "error": "TAG_NOT_REGISTERED"
}
```

**Causes:**
1. ❌ Tag UID not in `dipendenti.badge_uid` field
2. ❌ Employee's company_id ≠ Arduino's company_id
3. ❌ Employee deleted or marked as inactive

**Debug Steps:**
```sql
-- 1. Check if tag exists in any employee
SELECT * FROM dipendenti WHERE badge_uid = '3605CA06';

-- 2. Check company match
SELECT company_id FROM dipendenti WHERE badge_uid = '3605CA06';

-- 3. Check Arduino's company_id (look at recent logs)
-- Should match the company_id above
```

**Fix:**
```sql
-- Register tag to employee
UPDATE dipendenti
SET badge_uid = '3605CA06'
WHERE id = 'employee-uuid'
AND company_id = (
  -- Get correct company_id
  SELECT company_id FROM dipendenti LIMIT 1
);
```

---

### ❌ Failure 2: No Presence Record Created

**Symptoms:**
- Hardware.js returns success but no record in `presenza` table
- Error logs show: `insert presenza error: ...`

**Likely Causes:**
1. ❌ Foreign key constraint violation
   - tag_uid doesn't exist in `tag` table
   - company_id doesn't exist in `company` table
2. ❌ Column type mismatch
   - tipo value not ENTRATA/USCITA
   - Timestamp format invalid
3. ❌ Database connection issue

**Debug:**
```sql
-- Check if foreign keys exist
-- 1. Check company exists
SELECT id FROM company WHERE id = 'company-id';

-- 2. Check tag exists (if using tag table)
SELECT * FROM tag WHERE uid = '3605CA06';

-- 3. Try manual insert to see error
INSERT INTO presenza (company_id, tag_uid, reader_id, tipo, created_at, timestamp)
VALUES ('company-id', '3605CA06', 'reader1', 'ENTRATA', NOW(), NOW());
-- If error, check what it says
```

---

### ❌ Failure 3: Wrong "tipo" (ENTRATA/USCITA)

**Symptoms:**
- All reads show ENTRATA or all show USCITA
- Logic not alternating correctly

**Logic (hardware.js:203-241):**
1. Check if fasce_orarie exist and find active one
2. If active fascia exists:
   - Use fascia.tipo as default
   - If last presence was same tipo AND in same fascia → invert it
3. If no active fascia:
   - Invert based on last presence tipo

**Debug:**
```sql
-- 1. Check fasce_orarie
SELECT * FROM fasce_orarie
WHERE company_id = 'company-id'
ORDER BY ora_inizio;

-- 2. Check last presence for tag
SELECT * FROM presenza
WHERE tag_uid = '3605CA06'
AND company_id = 'company-id'
ORDER BY created_at DESC
LIMIT 5;

-- 3. Check current time against fasce
-- If no fasce covers current time, last presence determines tipo
```

---

## ✅ COMPLETE DEBUGGING CHECKLIST

### Step 1: Verify Database Structure
```sql
-- ✅ Check presence table exists with all columns
SELECT COUNT(*) FROM information_schema.tables
WHERE table_name = 'presenza';
-- Expected: 1

-- ✅ Check timestamp column exists
SELECT COUNT(*) FROM information_schema.columns
WHERE table_name = 'presenza' AND column_name = 'timestamp';
-- Expected: 1

-- ✅ Check all critical columns
SELECT column_name FROM information_schema.columns
WHERE table_name = 'presenza'
ORDER BY ordinal_position;
-- Expected: id, company_id, tag_uid, reader_id, tipo, created_at, updated_at, timestamp
```

### Step 2: Verify Employee-Tag Association
```sql
-- ✅ Tag registered to employee?
SELECT dipendente_id, badge_uid, nome, cognome, company_id
FROM dipendenti
WHERE badge_uid = 'YOUR_TAG_UID';
-- Expected: 1 row with correct company_id

-- ✅ Get company info
SELECT * FROM company;
-- Verify company_id exists
```

### Step 3: Verify Time Ranges
```sql
-- ✅ Company has fasce_orarie?
SELECT * FROM fasce_orarie
WHERE company_id = 'YOUR_COMPANY_ID';
-- Expected: 1+ rows or can be empty (falls back to toggle logic)
```

### Step 4: Check Recent Attempts
```sql
-- ✅ Are recent presence records appearing?
SELECT * FROM presenza
WHERE company_id = 'YOUR_COMPANY_ID'
ORDER BY created_at DESC
LIMIT 20;
-- Should show recent tag reads

-- ✅ For specific tag
SELECT * FROM presenza
WHERE tag_uid = 'YOUR_TAG_UID'
ORDER BY created_at DESC
LIMIT 10;
```

### Step 5: Test Backend Manually
```bash
# ✅ Test the /api/hardware/tag endpoint directly
curl -X POST http://localhost:3000/api/hardware/tag \
  -H "Content-Type: application/json" \
  -d '{
    "uid": "3605CA06",
    "reader_id": "test-reader",
    "company_id": "YOUR_COMPANY_ID",
    "timestamp": "2026-05-31T12:34:56Z"
  }'

# Expected response (if tag registered):
# {
#   "success": true,
#   "tipo": "ENTRATA",
#   "fascia": "Turno Mattino",
#   "dipendente": "Nome Cognome"
# }

# Expected response (if tag NOT registered):
# {
#   "success": true,
#   "tipo": null,
#   "error": "TAG_NOT_REGISTERED"
# }
```

---

## 🔧 STEP-BY-STEP FIX GUIDE

### Problem: "TAG_NOT_REGISTERED"

**Step 1: Get your tag UID**
- Read tag with Arduino
- Check Arduino logs or serial monitor
- Example: `3605CA06`

**Step 2: Verify employee exists**
```sql
SELECT id, nome, cognome, company_id FROM dipendenti LIMIT 5;
-- Note: an employee id and company_id
```

**Step 3: Register tag to employee**
```sql
UPDATE dipendenti
SET badge_uid = '3605CA06'  -- Your tag UID
WHERE id = 'EMPLOYEE_ID'
AND company_id = 'COMPANY_ID';
```

**Step 4: Verify registration**
```sql
SELECT badge_uid, nome, cognome FROM dipendenti
WHERE badge_uid = '3605CA06';
-- Should return the employee
```

**Step 5: Test reading tag again**
- Use Arduino or curl POST to `/api/hardware/tag`
- Should now return success with `tipo` and employee name

---

### Problem: No Presence Records Being Created

**Step 1: Check database structure**
```sql
-- Run the complete verification
ALTER TABLE presenza
ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Verify fix
SELECT COUNT(*) FROM information_schema.columns
WHERE table_name = 'presenza' AND column_name = 'timestamp';
-- Expected: 1
```

**Step 2: Manually insert test record**
```sql
INSERT INTO presenza (company_id, tag_uid, reader_id, tipo, created_at, timestamp)
VALUES (
  'YOUR_COMPANY_ID',
  'YOUR_TAG_UID',
  'test-reader',
  'ENTRATA',
  NOW(),
  NOW()
);

-- Check if it worked
SELECT * FROM presenza WHERE tag_uid = 'YOUR_TAG_UID' ORDER BY created_at DESC LIMIT 1;
```

**Step 3: If manual insert fails**
- Check foreign keys: company_id must exist in company table
- Check column types match (no unexpected constraints)
- Look for detailed error message

**Step 4: Test hardware endpoint**
```bash
curl -X POST http://localhost:3000/api/hardware/tag \
  -H "Content-Type: application/json" \
  -d '{
    "uid": "YOUR_TAG_UID",
    "reader_id": "test",
    "company_id": "YOUR_COMPANY_ID"
  }'
```

Check backend logs for any error messages

---

## 📋 CHECKLIST FOR SUCCESSFUL TAG READING

- [ ] Database table `presenza` has `timestamp` column
- [ ] Tag UID is registered in `dipendenti.badge_uid` field
- [ ] Employee's company_id matches Arduino's company_id
- [ ] `fasce_orarie` exist (or accept default toggle logic)
- [ ] Arduino can reach backend endpoint (network connectivity)
- [ ] Backend receiving POST requests to `/api/hardware/tag`
- [ ] Backend logs show successful processing
- [ ] Presence records appearing in database after tag reads
- [ ] tipo (ENTRATA/USCITA) alternating correctly

---

## 📊 EXPECTED DATABASE STATE

After successful tag read, `presenza` table should show:

```sql
SELECT
  id,
  company_id,
  tag_uid,
  reader_id,
  tipo,
  created_at,
  timestamp
FROM presenza
WHERE tag_uid = 'YOUR_TAG_UID'
ORDER BY created_at DESC
LIMIT 3;
```

Expected output:
```
id                   company_id              tag_uid    reader_id    tipo     created_at                timestamp
─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
uuid-3               uuid-company-1          3605CA06   reader123    USCITA   2026-05-31 14:45:00      2026-05-31 14:45:00
uuid-2               uuid-company-1          3605CA06   reader123    ENTRATA  2026-05-31 12:30:00      2026-05-31 12:30:00
uuid-1               uuid-company-1          3605CA06   reader123    ENTRATA  2026-05-31 08:00:00      2026-05-31 08:00:00
```

Notice:
- ✅ ENTRATA and USCITA alternating
- ✅ created_at and timestamp matching
- ✅ Same company_id and tag_uid

---

## 🚀 NEXT STEPS

1. **Immediate:** Run database verification steps above
2. **Short-term:** Register all employee tag UIDs to `dipendenti.badge_uid`
3. **Testing:** Use curl to test `/api/hardware/tag` endpoint
4. **Verification:** Check presence records appearing in database
5. **Production:** Verify Arduino can communicate with backend server

---

**Last Updated:** 31 Maggio 2026
**Author:** System Analysis
