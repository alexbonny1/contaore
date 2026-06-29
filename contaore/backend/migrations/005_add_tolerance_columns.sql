-- Aggiunge colonna tolleranza in difetto per il calcolo ore mensili
ALTER TABLE company ADD COLUMN IF NOT EXISTS tolleranza_difetto_minuti integer DEFAULT 15;
