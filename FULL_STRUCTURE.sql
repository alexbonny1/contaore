-- ═══════════════════════════════════════════════════════════════════════════════
-- FULL DATABASE STRUCTURE & ANALYSIS
-- Estrae TUTTA la struttura del database
-- ═══════════════════════════════════════════════════════════════════════════════

-- COMPANY
SELECT 'COMPANY' as t, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name = 'company' ORDER BY ordinal_position;

-- DEVICE_CLAIM
SELECT 'DEVICE_CLAIM' as t, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name = 'device_claim' ORDER BY ordinal_position;

-- DIPENDENTI
SELECT 'DIPENDENTI' as t, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name = 'dipendenti' ORDER BY ordinal_position;

-- DISPOSITIVO
SELECT 'DISPOSITIVO' as t, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name = 'dispositivo' ORDER BY ordinal_position;

-- FASCE_ORARIE
SELECT 'FASCE_ORARIE' as t, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name = 'fasce_orarie' ORDER BY ordinal_position;

-- GIUSTIFICAZIONI
SELECT 'GIUSTIFICAZIONI' as t, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name = 'giustificazioni' ORDER BY ordinal_position;

-- PAUSE_AZIENDALI
SELECT 'PAUSE_AZIENDALI' as t, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name = 'pause_aziendali' ORDER BY ordinal_position;

-- PRESENZA
SELECT 'PRESENZA' as t, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name = 'presenza' ORDER BY ordinal_position;

-- RICHIESTE_FERIE
SELECT 'RICHIESTE_FERIE' as t, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name = 'richieste_ferie' ORDER BY ordinal_position;

-- RICHIESTE_LETTURA
SELECT 'RICHIESTE_LETTURA' as t, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name = 'richieste_lettura' ORDER BY ordinal_position;

-- RICHIESTE_TIMBRATURA
SELECT 'RICHIESTE_TIMBRATURA' as t, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name = 'richieste_timbratura' ORDER BY ordinal_position;

-- TAG
SELECT 'TAG' as t, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name = 'tag' ORDER BY ordinal_position;

-- TURNI
SELECT 'TURNI' as t, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name = 'turni' ORDER BY ordinal_position;

-- USER_ACCOUNT
SELECT 'USER_ACCOUNT' as t, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name = 'user_account' ORDER BY ordinal_position;

-- FOREIGN KEYS
SELECT
  'FOREIGN KEYS' as info,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS referenced_table,
  ccu.column_name AS referenced_column
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'
ORDER BY tc.table_name;

-- INDICI
SELECT
  'INDICI' as info,
  schemaname,
  tablename,
  indexname
FROM pg_indexes
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
