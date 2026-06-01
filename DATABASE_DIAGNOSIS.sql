-- ═══════════════════════════════════════════════════════════════════════════════
-- DATABASE DIAGNOSIS
-- Ispeziona il database attuale e mostra cosa c'è e cosa manca
-- ═══════════════════════════════════════════════════════════════════════════════

-- QUERY 1: Lista tutte le tabelle che esistono
SELECT
  tablename as tabella,
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_name = t.tablename) as num_colonne
FROM pg_tables t
WHERE schemaname = 'public'
ORDER BY tablename;

-- QUERY 2: Dettagli user_account
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'user_account'
ORDER BY ordinal_position;

-- QUERY 3: Dettagli dipendenti
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'dipendenti'
ORDER BY ordinal_position;

-- QUERY 4: Dettagli presenza
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'presenza'
ORDER BY ordinal_position;

-- QUERY 5: Dettagli turni
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'turni'
ORDER BY ordinal_position;

-- QUERY 6: Dettagli tag (se esiste)
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'tag'
ORDER BY ordinal_position;

-- QUERY 7: Dettagli richieste_ferie
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'richieste_ferie'
ORDER BY ordinal_position;

-- QUERY 8: Dettagli company
SELECT
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'company'
ORDER BY ordinal_position;

-- QUERY 9: Foreign Keys
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS referenced_table_name,
  ccu.column_name AS referenced_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'public'
ORDER BY tc.table_name, tc.constraint_name;

-- QUERY 10: Constraints (CHECK, UNIQUE, ecc)
SELECT
  constraint_name,
  table_name,
  constraint_type
FROM information_schema.table_constraints
WHERE table_schema = 'public'
  AND constraint_type IN ('PRIMARY KEY', 'UNIQUE', 'CHECK')
ORDER BY table_name, constraint_name;

-- QUERY 11: Indici
SELECT
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- QUERY 12: Row count per tabella
SELECT
  schemaname,
  relname as table_name,
  n_live_tup as num_righe
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY relname;

-- QUERY 13: Controlla colonne critiche per il backend
SELECT
  'reset_token in user_account' as control,
  CASE WHEN EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_account'
    AND column_name = 'reset_token'
  ) THEN 'OK' ELSE 'MANCA' END as status

UNION ALL

SELECT 'timestamp in presenza',
  CASE WHEN EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'presenza'
    AND column_name = 'timestamp'
  ) THEN 'OK' ELSE 'MANCA' END

UNION ALL

SELECT 'uid in tag',
  CASE WHEN EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tag'
    AND column_name = 'uid'
  ) THEN 'OK' ELSE 'MANCA' END

UNION ALL

SELECT 'badge_uid in dipendenti',
  CASE WHEN EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dipendenti'
    AND column_name = 'badge_uid'
  ) THEN 'OK' ELSE 'MANCA' END

UNION ALL

SELECT 'company_id in user_account',
  CASE WHEN EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_account'
    AND column_name = 'company_id'
  ) THEN 'OK' ELSE 'MANCA' END

UNION ALL

SELECT 'company_id in dipendenti',
  CASE WHEN EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'dipendenti'
    AND column_name = 'company_id'
  ) THEN 'OK' ELSE 'MANCA' END;

-- QUERY 14: Dettagli ALL tabelle
SELECT
  table_name,
  COUNT(*) as num_colonne
FROM information_schema.columns
WHERE table_schema = 'public'
GROUP BY table_name
ORDER BY table_name;
