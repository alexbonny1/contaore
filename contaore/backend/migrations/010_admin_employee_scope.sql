-- Migration 010: restrizione dell'accesso admin a un sottoinsieme di dipendenti

-- null/vuoto = accesso a tutti i dipendenti della company (comportamento attuale, invariato)
-- array di id = l'admin vede/gestisce solo questi dipendenti
ALTER TABLE IF EXISTS user_account ADD COLUMN IF NOT EXISTS assigned_dipendente_ids jsonb;
