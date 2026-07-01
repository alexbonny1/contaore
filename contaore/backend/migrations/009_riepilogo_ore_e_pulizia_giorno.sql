-- Migration 009: pulizia automatica su giorno preciso + coda invio riepilogo ore

-- Giorno del mese in cui eseguire la pulizia automatica dello storico presenze
ALTER TABLE IF EXISTS company ADD COLUMN IF NOT EXISTS auto_cleanup_giorno integer DEFAULT 15;

-- Guardia "YYYY-MM" per non ripetere la pulizia più volte nello stesso mese
ALTER TABLE IF EXISTS company ADD COLUMN IF NOT EXISTS auto_cleanup_last_run varchar(7);

-- Coda di riepiloghi ore generati per l'invio via email (automatico o in attesa di approvazione)
CREATE TABLE IF NOT EXISTS riepilogo_ore_invii (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  periodo varchar(100) NOT NULL,
  dipendente_ids jsonb,
  formato varchar(10) NOT NULL,
  destinatario_email varchar(255) NOT NULL,
  stato varchar(20) DEFAULT 'in_attesa',
  approvato_da uuid REFERENCES user_account(id) ON DELETE SET NULL,
  inviato_il timestamptz,
  created_at timestamptz DEFAULT now()
);
