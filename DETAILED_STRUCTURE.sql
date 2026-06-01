-- ═══════════════════════════════════════════════════════════════════════════════
-- DETAILED DATABASE STRUCTURE
-- Mostra la struttura completa di ogni tabella
-- ═══════════════════════════════════════════════════════════════════════════════

-- COMPANY
SELECT 'COMPANY' as tabella, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name = 'company' ORDER BY ordinal_position;

-- DEVICE_CLAIM
SELECT 'DEVICE_CLAIM' as tabella, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name = 'device_claim' ORDER BY ordinal_position;

-- DIPENDENTI
SELECT 'DIPENDENTI' as tabella, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name = 'dipendenti' ORDER BY ordinal_position;

-- DISPOSITIVO
SELECT 'DISPOSITIVO' as tabella, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name = 'dispositivo' ORDER BY ordinal_position;

-- FASCE_ORARIE
SELECT 'FASCE_ORARIE' as tabella, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name = 'fasce_orarie' ORDER BY ordinal_position;

-- GIUSTIFICAZIONI
SELECT 'GIUSTIFICAZIONI' as tabella, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name = 'giustificazioni' ORDER BY ordinal_position;

-- PAUSE_AZIENDALI
SELECT 'PAUSE_AZIENDALI' as tabella, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name = 'pause_aziendali' ORDER BY ordinal_position;

-- PRESENZA
SELECT 'PRESENZA' as tabella, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name = 'presenza' ORDER BY ordinal_position;

-- RICHIESTE_FERIE
SELECT 'RICHIESTE_FERIE' as tabella, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name = 'richieste_ferie' ORDER BY ordinal_position;

-- RICHIESTE_LETTURA
SELECT 'RICHIESTE_LETTURA' as tabella, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name = 'richieste_lettura' ORDER BY ordinal_position;

-- RICHIESTE_TIMBRATURA
SELECT 'RICHIESTE_TIMBRATURA' as tabella, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name = 'richieste_timbratura' ORDER BY ordinal_position;

-- TAG
SELECT 'TAG' as tabella, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name = 'tag' ORDER BY ordinal_position;

-- TURNI
SELECT 'TURNI' as tabella, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name = 'turni' ORDER BY ordinal_position;

-- USER_ACCOUNT
SELECT 'USER_ACCOUNT' as tabella, column_name, data_type, is_nullable, column_default
FROM information_schema.columns WHERE table_name = 'user_account' ORDER BY ordinal_position;
