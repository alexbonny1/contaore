ALTER TABLE dipendenti ADD COLUMN IF NOT EXISTS promemoria_entrata_minuti integer DEFAULT NULL;
ALTER TABLE dipendenti ADD COLUMN IF NOT EXISTS promemoria_uscita_minuti integer DEFAULT NULL;
