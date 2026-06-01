-- ═══════════════════════════════════════════════════════════════════════════════
-- DATABASE FIXES
-- Script per aggiustare i 2 problemi identificati
-- ═══════════════════════════════════════════════════════════════════════════════

-- FIX 1: Aggiungere colonna TIMESTAMP a PRESENZA
-- Problema: Backend (presenze.js line 28) ordina per 'timestamp' ma la colonna non esiste
-- Soluzione: Aggiungere la colonna
ALTER TABLE presenza
ADD COLUMN IF NOT EXISTS timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Verifica FIX 1
SELECT 'FIX 1: timestamp in presenza' as check_name,
  CASE WHEN EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'presenza' AND column_name = 'timestamp'
  ) THEN '✅ OK' ELSE '❌ FAILED' END as status;

-- ─────────────────────────────────────────────────────────────────────────────
-- FIX 2: Verificare colonna ORA in RICHIESTE_TIMBRATURA
-- Problema: Tabella ha 'ora_uscita' ma il backend potrebbe cercare 'ora'
-- Nota: Verificare il backend prima di applicare
--
-- Se il backend cerca 'ora', aggiungere:
-- ALTER TABLE richieste_timbratura
-- ADD COLUMN IF NOT EXISTS ora TIME;
--
-- Se il backend va bene con 'ora_uscita', non fare nulla

-- Verifica FIX 2: Mostra quali colonne ha richieste_timbratura
SELECT 'Colonne in richieste_timbratura:' as info;
SELECT column_name FROM information_schema.columns
WHERE table_name = 'richieste_timbratura'
ORDER BY ordinal_position;

-- ─────────────────────────────────────────────────────────────────────────────
-- OPTIONAL: Rimuovere tabella RICHIESTE_LETTURA se non usata
-- Commentato per sicurezza - decommentare solo se sicuri
--
-- DROP TABLE IF EXISTS richieste_lettura;

-- ─────────────────────────────────────────────────────────────────────────────
-- VERIFICA FINALE
-- ─────────────────────────────────────────────────────────────────────────────

SELECT '=== DATABASE FIX SUMMARY ===' as status;

SELECT 'presence.timestamp' as control,
  CASE WHEN EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'presenza' AND column_name = 'timestamp'
  ) THEN '✅ FIXED' ELSE '❌ MISSING' END as result

UNION ALL

SELECT 'richieste_timbratura.ora_uscita',
  CASE WHEN EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'richieste_timbratura' AND column_name = 'ora_uscita'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END

UNION ALL

SELECT 'richieste_timbratura.ora',
  CASE WHEN EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'richieste_timbratura' AND column_name = 'ora'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END

UNION ALL

SELECT 'user_account.reset_token',
  CASE WHEN EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_account' AND column_name = 'reset_token'
  ) THEN '✅ EXISTS' ELSE '❌ MISSING' END;
