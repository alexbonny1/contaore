-- ═══════════════════════════════════════════════════════════════════════════════
-- NFC TAG READING DIAGNOSTIC SCRIPT
-- Run this to identify why presence records aren't being created
-- ═══════════════════════════════════════════════════════════════════════════════

-- SECTION 1: DATABASE STRUCTURE CHECKS
-- ═══════════════════════════════════════════════════════════════════════════════

SELECT '═══ 1. PRESENCE TABLE STRUCTURE ═══' as section;

SELECT COUNT(*) as table_exists FROM information_schema.tables
WHERE table_name = 'presenza';

SELECT column_name as column,
       data_type as type,
       is_nullable as nullable
FROM information_schema.columns
WHERE table_name = 'presenza'
ORDER BY ordinal_position;

-- ─────────────────────────────────────────────────────────────────────────────

SELECT '═══ 2. CRITICAL: timestamp COLUMN ═══' as section;

SELECT COUNT(*) as timestamp_exists FROM information_schema.columns
WHERE table_name = 'presenza' AND column_name = 'timestamp';
-- Expected: 1 (if 0 → TIMESTAMP MISSING!)

-- ─────────────────────────────────────────────────────────────────────────────

SELECT '═══ 3. DIPENDENTI TABLE STRUCTURE ═══' as section;

SELECT column_name as column,
       data_type as type
FROM information_schema.columns
WHERE table_name = 'dipendenti'
ORDER BY ordinal_position;

-- ─────────────────────────────────────────────────────────────────────────────

SELECT '═══ 4. COMPANY TABLE STRUCTURE ═══' as section;

SELECT column_name as column,
       data_type as type
FROM information_schema.columns
WHERE table_name = 'company'
ORDER BY ordinal_position;

-- ─────────────────────────────────────────────────────────────────────────────

SELECT '═══ 5. FASCE_ORARIE TABLE STRUCTURE ═══' as section;

SELECT column_name as column,
       data_type as type
FROM information_schema.columns
WHERE table_name = 'fasce_orarie'
ORDER BY ordinal_position;

-- SECTION 2: DATA EXISTENCE CHECKS
-- ═══════════════════════════════════════════════════════════════════════════════

SELECT '═══ 6. COMPANY DATA ═══' as section;

SELECT COUNT(*) as companies_exist FROM company;

SELECT id, name FROM company LIMIT 5;

-- ─────────────────────────────────────────────────────────────────────────────

SELECT '═══ 7. EMPLOYEES WITH TAG ASSIGNMENTS ═══' as section;

SELECT COUNT(*) as employees_total FROM dipendenti;

SELECT COUNT(*) as employees_with_badge_uid FROM dipendenti
WHERE badge_uid IS NOT NULL AND badge_uid != '';

SELECT id, nome, cognome, badge_uid, company_id
FROM dipendenti
WHERE badge_uid IS NOT NULL AND badge_uid != ''
LIMIT 10;

-- ─────────────────────────────────────────────────────────────────────────────

SELECT '═══ 8. EMPLOYEES WITHOUT TAG ASSIGNMENTS ═══' as section;

SELECT COUNT(*) as unregistered_employees FROM dipendenti
WHERE badge_uid IS NULL OR badge_uid = '';

SELECT id, nome, cognome, company_id
FROM dipendenti
WHERE badge_uid IS NULL OR badge_uid = ''
LIMIT 10;

-- ─────────────────────────────────────────────────────────────────────────────

SELECT '═══ 9. TIME RANGES (FASCE ORARIE) ═══' as section;

SELECT COUNT(*) as total_fasce FROM fasce_orarie;

SELECT company_id, COUNT(*) as fasce_per_company
FROM fasce_orarie
GROUP BY company_id;

SELECT id, company_id, nome, ora_inizio, ora_fine, tipo
FROM fasce_orarie
LIMIT 10;

-- ─────────────────────────────────────────────────────────────────────────────

SELECT '═══ 10. RECENT PRESENCE RECORDS ═══' as section;

SELECT COUNT(*) as total_presenza FROM presenza;

SELECT company_id, COUNT(*) as records_per_company
FROM presenza
GROUP BY company_id;

SELECT id, company_id, tag_uid, reader_id, tipo, created_at, timestamp
FROM presenza
ORDER BY created_at DESC
LIMIT 20;

-- ─────────────────────────────────────────────────────────────────────────────

SELECT '═══ 11. PRESENCE BY TAG UID ═══' as section;

SELECT tag_uid, COUNT(*) as total_scans
FROM presenza
GROUP BY tag_uid
ORDER BY total_scans DESC
LIMIT 20;

-- ─────────────────────────────────────────────────────────────────────────────

SELECT '═══ 12. PRESENCE BY READER ═══' as section;

SELECT reader_id, COUNT(*) as total_scans, COUNT(DISTINCT tag_uid) as unique_tags
FROM presenza
GROUP BY reader_id
ORDER BY total_scans DESC;

-- SECTION 3: CROSS-VALIDATION CHECKS
-- ═══════════════════════════════════════════════════════════════════════════════

SELECT '═══ 13. VALIDATE: Tag UIDs match employee registrations ═══' as section;

SELECT
  p.tag_uid,
  COUNT(p.id) as presence_count,
  COUNT(DISTINCT d.id) as registered_employees,
  COUNT(DISTINCT d.nome) as employee_names
FROM presenza p
LEFT JOIN dipendenti d ON p.tag_uid = d.badge_uid
GROUP BY p.tag_uid
ORDER BY presence_count DESC
LIMIT 20;

-- ─────────────────────────────────────────────────────────────────────────────

SELECT '═══ 14. INVALID: Presence with unregistered tags ═══' as section;

SELECT DISTINCT
  p.tag_uid,
  p.company_id,
  COUNT(p.id) as orphan_records
FROM presenza p
LEFT JOIN dipendenti d ON p.tag_uid = d.badge_uid AND p.company_id = d.company_id
WHERE d.id IS NULL
GROUP BY p.tag_uid, p.company_id;

-- ─────────────────────────────────────────────────────────────────────────────

SELECT '═══ 15. INVALID: Presence with non-existent company ═══' as section;

SELECT DISTINCT
  p.company_id,
  COUNT(p.id) as orphan_records
FROM presenza p
LEFT JOIN company c ON p.company_id = c.id
WHERE c.id IS NULL
GROUP BY p.company_id;

-- SECTION 4: COMPANY-SPECIFIC DIAGNOSTICS
-- ═══════════════════════════════════════════════════════════════════════════════

SELECT '═══ 16. FOR EACH COMPANY: Complete Status ═══' as section;

SELECT
  c.id as company_id,
  c.name as company_name,
  COUNT(DISTINCT d.id) as total_employees,
  COUNT(DISTINCT CASE WHEN d.badge_uid IS NOT NULL THEN d.id END) as employees_with_badges,
  COUNT(DISTINCT f.id) as fasce_orarie_count,
  COUNT(DISTINCT p.id) as total_presence_records
FROM company c
LEFT JOIN dipendenti d ON c.id = d.company_id
LEFT JOIN fasce_orarie f ON c.id = f.company_id
LEFT JOIN presenza p ON c.id = p.company_id
GROUP BY c.id, c.name;

-- ─────────────────────────────────────────────────────────────────────────────

SELECT '═══ 17. PRESENCE ENTRY/EXIT PATTERN ═══' as section;

SELECT
  tag_uid,
  company_id,
  COUNT(CASE WHEN tipo = 'ENTRATA' THEN 1 END) as entries,
  COUNT(CASE WHEN tipo = 'USCITA' THEN 1 END) as exits,
  COUNT(*) as total
FROM presenza
GROUP BY tag_uid, company_id
ORDER BY total DESC
LIMIT 20;

-- SECTION 5: TIMESTAMP VALIDATION
-- ═══════════════════════════════════════════════════════════════════════════════

SELECT '═══ 18. TIMESTAMP COLUMN ANALYSIS ═══' as section;

SELECT
  COUNT(*) as total_records,
  COUNT(CASE WHEN timestamp IS NOT NULL THEN 1 END) as with_timestamp,
  COUNT(CASE WHEN timestamp IS NULL THEN 1 END) as without_timestamp,
  COUNT(CASE WHEN timestamp = created_at THEN 1 END) as timestamp_equals_created_at
FROM presenza;

SELECT
  id,
  tag_uid,
  created_at,
  timestamp,
  (timestamp = created_at) as same_value
FROM presenza
ORDER BY created_at DESC
LIMIT 20;

-- SECTION 6: FOREIGN KEY VALIDATION
-- ═══════════════════════════════════════════════════════════════════════════════

SELECT '═══ 19. PRESENCE FK: company_id references ═══' as section;

SELECT
  COUNT(*) as presence_total,
  COUNT(DISTINCT c.id) as valid_company_refs,
  COUNT(DISTINCT CASE WHEN c.id IS NULL THEN p.company_id END) as invalid_company_refs
FROM presenza p
LEFT JOIN company c ON p.company_id = c.id;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SUMMARY & RECOMMENDATIONS
-- ═══════════════════════════════════════════════════════════════════════════════

SELECT '═══ DIAGNOSTIC COMPLETE ═══' as section;

SELECT
  CASE
    WHEN (SELECT COUNT(*) FROM information_schema.columns
          WHERE table_name = 'presenza' AND column_name = 'timestamp') = 0
    THEN '❌ CRITICAL: timestamp column missing from presenza table'
    ELSE '✅ timestamp column exists'
  END as check_1,

  CASE
    WHEN (SELECT COUNT(*) FROM dipendenti WHERE badge_uid IS NOT NULL AND badge_uid != '') = 0
    THEN '❌ WARNING: No employees have badge UIDs assigned'
    ELSE '✅ Employees have badge UIDs assigned'
  END as check_2,

  CASE
    WHEN (SELECT COUNT(*) FROM presence) > 0
    THEN '✅ Presence records exist in database'
    ELSE '❌ WARNING: No presence records found'
  END as check_3,

  CASE
    WHEN (SELECT COUNT(*) FROM presence WHERE timestamp IS NULL) > 0
    THEN '❌ WARNING: Some presence records have NULL timestamp'
    ELSE '✅ All presence records have timestamp'
  END as check_4;

-- ═══════════════════════════════════════════════════════════════════════════════
