# ⚡ QUICK TROUBLESHOOT - NFC TAG NOT WORKING

**Problem:** "When I read a tag, nothing happens. No presence record is created."

**Solution Time:** 5-10 minutes to identify the issue

---

## 🔴 ISSUE #1: TAG_NOT_REGISTERED Error

**Symptom:**
- Arduino logs show successful POST
- Backend logs: `TAG NON ASSOCIATO A NESSUN DIPENDENTE: 3605CA06`
- No presence record created

**Root Cause:**
Tag UID is not assigned to any employee in the `dipendenti.badge_uid` field

**Quick Fix (2 min):**

```bash
# 1. Get your tag UID from Arduino logs
# Example: 3605CA06

# 2. SSH to database or use Supabase UI
# Run this SQL:
```

```sql
-- Check if tag exists
SELECT * FROM dipendenti WHERE badge_uid = '3605CA06';

-- If empty, assign tag to an employee
UPDATE dipendenti
SET badge_uid = '3605CA06'
WHERE id = (SELECT id FROM dipendenti LIMIT 1)
AND company_id = (SELECT company_id FROM dipendenti LIMIT 1);

-- Verify
SELECT badge_uid, nome, cognome FROM dipendenti WHERE badge_uid = '3605CA06';
```

**Expected:** Row with employee name and badge_uid matching your tag

---

## 🔴 ISSUE #2: No Presence Records After Successful Response

**Symptom:**
- Backend returns success: `{ "success": true, "tipo": "ENTRATA", "dipendente": "Mario Rossi" }`
- But no record appears in `presenza` table

**Root Cause:**
Missing `timestamp` column in database (or other database error)

**Quick Fix (2 min):**

```sql
-- Add missing timestamp column
ALTER TABLE presenza
ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Verify it was added
SELECT COUNT(*) FROM information_schema.columns
WHERE table_name = 'presenza' AND column_name = 'timestamp';
-- Expected: 1

-- Now try reading tag again
-- It should work!
```

---

## 🔴 ISSUE #3: Wrong ENTRATA/USCITA (Always Shows Same Type)

**Symptom:**
- Every read shows ENTRATA (or always USCITA)
- Not alternating correctly

**Root Cause:**
Either fasce_orarie not configured, or logic misinterpreting time ranges

**Quick Fix (3 min):**

```sql
-- Check if fasce_orarie exists for your company
SELECT * FROM fasce_orarie WHERE company_id = 'YOUR_COMPANY_ID';

-- If empty, the system uses "last presence toggle" logic
-- Check last few records
SELECT tag_uid, tipo, created_at FROM presenza
ORDER BY created_at DESC LIMIT 10;

-- If all same tipo:
-- Either:
-- 1. First time this tag is being read (OK, defaults to ENTRATA)
-- 2. Time ranges not matching current time
-- 3. Bug in logic (unlikely)

-- Try reading tag again, it should toggle
```

---

## 🔴 ISSUE #4: Arduino Can't Reach Backend

**Symptom:**
- Arduino logs show "Failed to POST" or connection timeout
- No logs on backend

**Root Cause:**
Network connectivity issue

**Quick Fix (5 min):**

```bash
# 1. Check Arduino config
# - Verify WiFi SSID and password are correct
# - Check backend URL in Arduino code

# 2. Test network from Arduino
# - Arduino logs should show WiFi IP address
# - Try pinging backend from same network:
ping backend-server-ip

# 3. Check backend is running
curl http://backend-ip:3000
# Should return: { "status": "ok" }

# 4. Check backend endpoint
curl -X POST http://backend-ip:3000/api/hardware/tag \
  -H "Content-Type: application/json" \
  -d '{"uid":"TEST","reader_id":"r1","company_id":"c1"}'

# Should return some response (not "Connection refused")
```

---

## 🟢 VERIFICATION CHECKLIST (2 min)

```bash
# 1. Database has timestamp column?
# Run in Supabase SQL Editor:
SELECT COUNT(*) FROM information_schema.columns
WHERE table_name = 'presenza' AND column_name = 'timestamp';
# Result should be: 1

# 2. Employees have tags assigned?
SELECT COUNT(*) FROM dipendenti WHERE badge_uid IS NOT NULL;
# Result should be: > 0

# 3. Backend is running?
curl http://localhost:3000
# Result should be: { "status": "ok" }

# 4. Can backend create presence records?
curl -X POST http://localhost:3000/api/hardware/tag \
  -H "Content-Type: application/json" \
  -d '{
    "uid": "3605CA06",
    "reader_id": "test",
    "company_id": "'$(uuidgen)'"
  }'

# Check last presence record was created:
SELECT * FROM presenza ORDER BY created_at DESC LIMIT 1;
```

---

## 🚨 NUCLEAR OPTION: Complete Reset

If all else fails and nothing is working:

```bash
# 1. Make sure backend can access database
# Check .env file has correct SUPABASE credentials

# 2. Restart backend
cd contaore/backend
npm run dev
# Watch for any error messages

# 3. Restart Arduino
# Push new firmware or reset ESP32

# 4. Test step by step
# - Read a known tag
# - Check Arduino logs
# - Check backend logs
# - Check database
```

---

## 📊 EXPECTED DATABASE STATE

After successful tag read:

```sql
-- This should show recent presence records
SELECT tag_uid, tipo, created_at, timestamp
FROM presenza
ORDER BY created_at DESC
LIMIT 5;

-- Result should look like:
-- tag_uid  | tipo    | created_at              | timestamp
-- ─────────────────────────────────────────────────────────
-- 3605CA06 | USCITA  | 2026-05-31 14:45:00     | 2026-05-31 14:45:00
-- 3605CA06 | ENTRATA | 2026-05-31 12:30:00     | 2026-05-31 12:30:00
-- 3605CA06 | ENTRATA | 2026-05-31 08:00:00     | 2026-05-31 08:00:00
```

If you see records → **System is working!** ✅
If empty → **Presence not being created** ❌

---

## 🔗 DETAILED GUIDES

For more detailed information, read:
- `NFC_TAG_READING_DEBUG.md` - Complete diagnostic guide
- `TAG_READING_WORKFLOW_SUMMARY.md` - Visual workflow documentation
- `DIAGNOSE_TAG_READING.sql` - Comprehensive SQL diagnostics

---

## 🆘 STILL NOT WORKING?

1. **Run DIAGNOSE_TAG_READING.sql** in Supabase editor
   - Copy entire file and execute
   - Check results for any ❌ marks

2. **Check backend logs:**
   ```bash
   cd contaore/backend
   npm run dev
   # Watch console for error messages
   ```

3. **Check Arduino logs:**
   - Open Arduino IDE
   - Tools → Serial Monitor
   - Watch for HTTP response codes (should be 200)

4. **Verify database:**
   ```sql
   -- Run all checks in DIAGNOSE_TAG_READING.sql
   -- Look for any NULL or missing values
   ```

5. **Contact Support:**
   - Share backend logs
   - Share database diagnostic results
   - Share Arduino serial monitor output

---

**Last Updated:** 31 Maggio 2026
**Priority:** HIGH - System Not Working
