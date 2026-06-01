# 📚 NFC TAG READING - DEBUG GUIDES INDEX

**Created:** 31 Maggio 2026
**Purpose:** Complete documentation for fixing "tag reads don't create presence records" issue

---

## 📖 Documentation Files

### 🚀 START HERE

#### 1. **QUICK_TROUBLESHOOT.md** ⚡
- **Time:** 5-10 minutes
- **For:** Quick problem identification and fixes
- **Contains:**
  - Issue #1: TAG_NOT_REGISTERED → Register tag to employee
  - Issue #2: No Presence Records → Add timestamp column
  - Issue #3: Wrong Type → Check fasce_orarie
  - Issue #4: Arduino Can't Connect → Network troubleshooting
  - Verification checklist

**→ Read this first if system is not working**

---

### 📊 DETAILED GUIDES

#### 2. **COMPLETE_ANALYSIS.md** 📋
- **Time:** 10-15 minutes
- **For:** Understanding the complete system
- **Contains:**
  - Executive summary
  - Detailed analysis of all components
  - Root cause analysis (4 causes identified)
  - Verification procedure
  - Step-by-step fix guide
  - File locations
  - Troubleshooting decision tree

**→ Read this for comprehensive understanding**

---

#### 3. **TAG_READING_WORKFLOW_SUMMARY.md** 🔄
- **Time:** 10 minutes
- **For:** Visual understanding of the workflow
- **Contains:**
  - ASCII diagram of complete flow
  - Hardware → Backend → Database
  - Critical code sections with line numbers
  - Database schema requirements
  - Decision flow chart
  - Common failure points
  - Debugging workflow with examples
  - Quick reference table

**→ Read this to understand how everything connects**

---

#### 4. **NFC_TAG_READING_DEBUG.md** 🔍
- **Time:** 15-20 minutes
- **For:** Deep technical debugging
- **Contains:**
  - Complete workflow architecture
  - Critical requirements (4 major ones)
  - Common failure points (3 detailed)
  - Complete debugging checklist
  - Step-by-step fix guide
  - Expected database state
  - Next steps for production

**→ Read this for technical deep-dive**

---

### 🗄️ DATABASE DIAGNOSTICS

#### 5. **DIAGNOSE_TAG_READING.sql** 🔧
- **Time:** 5 minutes to run
- **For:** Database state verification
- **Contains:**
  - Section 1: Database structure checks
  - Section 2: Data existence checks
  - Section 3: Cross-validation checks
  - Section 4: Company-specific diagnostics
  - Section 5: Timestamp validation
  - Section 6: Foreign key validation
  - Summary & recommendations

**→ Run this in Supabase SQL Editor to diagnose database issues**

**How to use:**
1. Go to Supabase SQL Editor
2. Copy entire DIAGNOSE_TAG_READING.sql
3. Paste and execute
4. Review results for any ❌ marks
5. Fix issues based on results

---

## 🎯 PROBLEM-SOLVING WORKFLOW

### Scenario 1: System Not Working At All

1. Open **QUICK_TROUBLESHOOT.md**
2. Run **DIAGNOSE_TAG_READING.sql** in database
3. Look for:
   - ❌ TAG_NOT_REGISTERED → Register tag to employee
   - ❌ timestamp missing → Apply FIX_DATABASE.sql
   - ❌ No employees → Create employee records
   - ❌ Network issues → Check connectivity

---

### Scenario 2: Tag Reads Successfully, But No Records

1. Open **COMPLETE_ANALYSIS.md** → Part 4: Database Insert Mechanism
2. Check backend logs for INSERT errors
3. Run **DIAGNOSE_TAG_READING.sql** section 1-2
4. Verify:
   - Employee-tag association
   - timestamp column exists
   - Database constraints

---

### Scenario 3: Wrong ENTRATA/USCITA Logic

1. Open **TAG_READING_WORKFLOW_SUMMARY.md** → Decision Flow
2. Run **DIAGNOSE_TAG_READING.sql** section 9: Time Ranges
3. Check `fasce_orarie` table
4. Verify last presence records alternating correctly

---

### Scenario 4: Arduino Can't Connect

1. Open **TAG_READING_WORKFLOW_SUMMARY.md** → Section 3.C
2. Test endpoint with curl:
   ```bash
   curl -X POST http://backend-ip:3000/api/hardware/tag \
     -H "Content-Type: application/json" \
     -d '{"uid":"TEST","reader_id":"r1","company_id":"c1"}'
   ```
3. Check:
   - Backend is running
   - Endpoint is accessible
   - Firewall allows connection
   - Arduino has correct URL

---

## 🗂️ FILE STRUCTURE

```
contaore/
├── README_DEBUG_GUIDES.md          ← You are here
├── QUICK_TROUBLESHOOT.md           ← Start here
├── COMPLETE_ANALYSIS.md
├── TAG_READING_WORKFLOW_SUMMARY.md
├── NFC_TAG_READING_DEBUG.md
├── DIAGNOSE_TAG_READING.sql        ← Run this in database
├── FIX_DATABASE.sql                ← Already applied
├── DATABASE_STATUS.md              ← Previous analysis
├── FINAL_ANALYSIS.md               ← Previous analysis
│
├── contaore/
│  ├── frontend/
│  │  └── src/pages/...
│  ├── backend/
│  │  ├── server.js
│  │  └── routes/
│  │     ├── hardware.js            ← Main tag processor
│  │     ├── scan.js                ← Alternative route
│  │     └── ...
│  └── arduino/
│     └── arduino.ino               ← Sends tag data
```

---

## 📋 CRITICAL CODE FILES

### Must Read (For Understanding)

1. **`/contaore/backend/routes/hardware.js`** - Lines 109-294
   - Main tag processing route
   - Employee lookup logic
   - Presence record creation

2. **`/contaore/arduino/arduino.ino`** - Line 780
   - Tag reading and POST to backend
   - Payload structure

### Database Tables (For Reference)

- `dipendenti` - Employees with badge_uid field
- `presenza` - Attendance records
- `fasce_orarie` - Time ranges for intelligent ENTRATA/USCITA
- `company` - Companies (multi-tenancy)
- `dispositivo` - Hardware readers

---

## ✅ SUCCESS CRITERIA

System is working when:

- [ ] Backend receives POST to `/api/hardware/tag`
- [ ] Backend logs show successful employee lookup
- [ ] Presence records appearing in database after tag reads
- [ ] Records have tipo (ENTRATA/USCITA) alternating correctly
- [ ] Frontend dashboard shows recent scans
- [ ] Attendance hours calculated correctly

---

## 🔗 QUICK REFERENCE

| Issue | Solution | Time | File |
|-------|----------|------|------|
| TAG_NOT_REGISTERED | Register tag to employee | 2 min | QUICK_TROUBLESHOOT.md #1 |
| No presence records | Add timestamp column | 2 min | QUICK_TROUBLESHOOT.md #2 |
| Wrong type | Check fasce_orarie | 3 min | QUICK_TROUBLESHOOT.md #3 |
| Can't connect | Test network | 5 min | QUICK_TROUBLESHOOT.md #4 |
| Understand system | Read workflow | 10 min | TAG_READING_WORKFLOW_SUMMARY.md |
| Deep debug | Run diagnostics | 10 min | DIAGNOSE_TAG_READING.sql |
| Complete overview | Read full analysis | 15 min | COMPLETE_ANALYSIS.md |

---

## 🚀 NEXT STEPS

### Immediate (Right Now)
1. Open **QUICK_TROUBLESHOOT.md**
2. Follow Issue #1 (TAG_NOT_REGISTERED)
3. Register your tag UID to an employee

### Short Term (Next Hour)
1. Run **DIAGNOSE_TAG_READING.sql**
2. Fix any issues found
3. Test tag reading again

### Medium Term (Next Day)
1. Read **COMPLETE_ANALYSIS.md**
2. Understand the complete system
3. Verify all components working

### Long Term (This Week)
1. Optimize fasce_orarie (time ranges)
2. Configure time-based ENTRATA/USCITA
3. Test offline queue system
4. Verify all employees have tag assignments

---

## 📞 SUPPORT

If stuck, provide:
1. Backend logs (from npm run dev)
2. Arduino serial logs
3. Output from DIAGNOSE_TAG_READING.sql
4. Specific error messages

---

**Last Updated:** 31 Maggio 2026
**Status:** ✅ Complete Documentation
**Author:** System Analysis & Debug

---

## 📚 READING ORDER RECOMMENDATIONS

**For Managers/Non-Technical:**
1. This file (README_DEBUG_GUIDES.md)
2. COMPLETE_ANALYSIS.md (Executive Summary)

**For Developers (First Time):**
1. QUICK_TROUBLESHOOT.md
2. TAG_READING_WORKFLOW_SUMMARY.md
3. NFC_TAG_READING_DEBUG.md

**For Developers (Debugging Live Issue):**
1. QUICK_TROUBLESHOOT.md
2. DIAGNOSE_TAG_READING.sql
3. Relevant section from NFC_TAG_READING_DEBUG.md

**For System Administrators:**
1. COMPLETE_ANALYSIS.md
2. DIAGNOSE_TAG_READING.sql
3. NFC_TAG_READING_DEBUG.md

---

🎯 **You have everything needed to fix the system.**

**Start with QUICK_TROUBLESHOOT.md now.**
