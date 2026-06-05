-- ============================================================
-- Migrazione GDPR — Timbry
-- Data: giugno 2025
-- Descrizione: aggiunge colonne per tracciamento consenso
--              informativa privacy dipendenti (art. 13 GDPR)
-- ============================================================
-- Eseguire nel dashboard Supabase:
--   Database → SQL Editor → incollare ed eseguire
-- ============================================================

ALTER TABLE dipendenti
  ADD COLUMN IF NOT EXISTS informativa_consegnata    BOOLEAN    DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS informativa_consegnata_il TIMESTAMPTZ;

-- Indice opzionale per query filtrate sul flag
CREATE INDEX IF NOT EXISTS idx_dipendenti_informativa
  ON dipendenti (informativa_consegnata)
  WHERE informativa_consegnata = FALSE;

-- Commento sulla colonna
COMMENT ON COLUMN dipendenti.informativa_consegnata    IS 'TRUE se il datore di lavoro ha consegnato al dipendente l’informativa privacy ex art. 13 GDPR';
COMMENT ON COLUMN dipendenti.informativa_consegnata_il IS 'Timestamp della consegna dell’informativa privacy';
