-- Migration 011: Complete Schema Fix
-- Purpose: Create missing exec() function, tables, and columns without losing data
-- Safety: All operations use IF NOT EXISTS or ADD COLUMN IF NOT EXISTS
-- Date: 2026-07-04

-- ============================================================================
-- 1. CREATE FUNCTION exec() — RPC per eseguire SQL dinamico (CRITICA)
-- ============================================================================

CREATE OR REPLACE FUNCTION exec(sql text) RETURNS void AS $$
BEGIN
  EXECUTE sql;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 2. TABELLE CORE (Schema iniziale)
-- ============================================================================

CREATE TABLE IF NOT EXISTS company (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome varchar(255) NOT NULL,
  slug varchar(255) UNIQUE,
  portale_dipendenti boolean DEFAULT false,
  tolleranza_straordinario_minuti integer DEFAULT 0,
  arrotonda_ore_al_turno boolean DEFAULT false,
  auto_cleanup_enabled boolean DEFAULT false,
  auto_cleanup_retention_months integer DEFAULT 12,
  tolleranza_difetto_minuti integer DEFAULT 15,
  auto_cleanup_giorno integer DEFAULT 15,
  auto_cleanup_last_run varchar(7),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dipendenti (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  nome varchar(255) NOT NULL,
  cognome varchar(255) NOT NULL,
  badge_uid varchar(255),
  email varchar(255),
  turni_attivi boolean DEFAULT false,
  turni_attivati_il timestamptz,
  informativa_consegnata boolean DEFAULT false,
  informativa_consegnata_il timestamptz,
  data_inizio date,
  promemoria_entrata_minuti integer DEFAULT NULL,
  promemoria_uscita_minuti integer DEFAULT NULL,
  importo_orario numeric(10,2) DEFAULT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_account (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES company(id) ON DELETE CASCADE,
  username varchar(255) UNIQUE NOT NULL,
  email varchar(255),
  password varchar(255) NOT NULL,
  role varchar(50) DEFAULT 'dipendente',
  dipendente_id uuid REFERENCES dipendenti(id) ON DELETE SET NULL,
  phone_number varchar(20),
  two_factor_enabled boolean DEFAULT false,
  two_factor_method varchar(10) DEFAULT 'email',
  reset_token text,
  reset_token_expires_at timestamptz,
  password_changed_at timestamptz,
  is_temporary_credentials boolean DEFAULT false,
  temporary_credentials_used_at timestamptz,
  nome varchar(100),
  cognome varchar(100),
  permissions jsonb DEFAULT '{}',
  assigned_dipendente_ids jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS dispositivo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  reader_id varchar(255) NOT NULL UNIQUE,
  stato varchar(50) DEFAULT 'offline',
  ultimo_ping timestamptz,
  nome varchar(100),
  firmware_version varchar(50),
  sede varchar(100),
  nfc_ok boolean,
  display_ok boolean,
  ota_pending boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tag (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  uid varchar(255) NOT NULL,
  dipendente_id uuid REFERENCES dipendenti(id) ON DELETE SET NULL,
  stato varchar(50),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS turni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  dipendente_id uuid NOT NULL REFERENCES dipendenti(id) ON DELETE CASCADE,
  turno_nome varchar(255),
  giorno_settimana varchar(20) NOT NULL,
  ingresso_1 time,
  uscita_1 time,
  ingresso_2 time,
  uscita_2 time,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS fasce_orarie (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  nome varchar(255),
  ora_inizio time NOT NULL,
  ora_fine time NOT NULL,
  tipo varchar(20) NOT NULL,
  reader_id varchar(255),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS presenza (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  tag_uid varchar(255) NOT NULL,
  reader_id varchar(255),
  tipo varchar(20) NOT NULL,
  manuale boolean DEFAULT false,
  automatica boolean DEFAULT false,
  timestamp timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS richieste_ferie (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  dipendente_id uuid NOT NULL REFERENCES dipendenti(id) ON DELETE CASCADE,
  data_inizio date NOT NULL,
  data_fine date NOT NULL,
  note text,
  stato varchar(20) DEFAULT 'in_attesa',
  approvato_da uuid REFERENCES user_account(id) ON DELETE SET NULL,
  approvato_il timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS richieste_timbratura (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  dipendente_id uuid NOT NULL REFERENCES dipendenti(id) ON DELETE CASCADE,
  data date NOT NULL,
  tipo varchar(20) NOT NULL,
  ora_uscita time,
  motivo text NOT NULL,
  stato varchar(20) DEFAULT 'in_attesa',
  presenza_id uuid REFERENCES presenza(id) ON DELETE SET NULL,
  nuovo_datetime timestamptz,
  approvato_da uuid REFERENCES user_account(id) ON DELETE SET NULL,
  approvato_il timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS giustificazioni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  dipendente_id uuid NOT NULL REFERENCES dipendenti(id) ON DELETE CASCADE,
  data date NOT NULL,
  motivo text NOT NULL,
  stato varchar(20) DEFAULT 'in_attesa',
  approvato_da uuid REFERENCES user_account(id) ON DELETE SET NULL,
  approvato_il timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS pausa_aziendale (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  data_inizio date NOT NULL,
  data_fine date NOT NULL,
  motivo text NOT NULL,
  attiva boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notifiche_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  tipo varchar(100) NOT NULL,
  attiva boolean DEFAULT false,
  parametri jsonb DEFAULT '{}',
  target_ids jsonb,
  email_destinatario varchar(255),
  last_triggered_at timestamptz,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, tipo)
);

CREATE TABLE IF NOT EXISTS ota_release (
  id integer PRIMARY KEY,
  version varchar(50) NOT NULL,
  url text NOT NULL,
  attivo boolean DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS device_claim (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token varchar(255) NOT NULL UNIQUE,
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_settings (
  id integer PRIMARY KEY,
  alert_email varchar(255),
  offline_minuti integer DEFAULT 15,
  alert_attivo boolean DEFAULT false,
  alert_companies jsonb,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- ============================================================================
-- 3. TABELLE 2FA E AUDIT
-- ============================================================================

CREATE TABLE IF NOT EXISTS two_factor_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
  code varchar(6) NOT NULL,
  method varchar(10) NOT NULL,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '10 minutes',
  verified boolean DEFAULT false,
  attempts_count integer DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_two_factor_attempts_user_expires
  ON two_factor_attempts(user_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_two_factor_attempts_user_verified
  ON two_factor_attempts(user_id, verified, expires_at);

CREATE TABLE IF NOT EXISTS two_factor_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
  event_type varchar(50) NOT NULL,
  method varchar(10),
  ip_address inet,
  user_agent text,
  status varchar(20),
  error_reason text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_two_factor_audit_user_date
  ON two_factor_audit(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_two_factor_audit_event_type
  ON two_factor_audit(event_type, created_at);

CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  user_id uuid REFERENCES user_account(id) ON DELETE SET NULL,
  azione varchar(100) NOT NULL,
  entita_tipo varchar(50) NOT NULL,
  entita_id uuid,
  dettagli jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_log_company_date
  ON audit_log(company_id, created_at);

CREATE INDEX IF NOT EXISTS idx_audit_log_user_date
  ON audit_log(user_id, created_at);

-- ============================================================================
-- 4. TABELLE RICHIESTE (Permessi, Turni, etc.)
-- ============================================================================

CREATE TABLE IF NOT EXISTS richieste_permessi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  dipendente_id uuid NOT NULL REFERENCES dipendenti(id) ON DELETE CASCADE,
  data_uscita date,
  ora_uscita time,
  data_entrata date,
  ora_entrata time,
  tipo varchar(50) DEFAULT 'personale',
  motivo text NOT NULL,
  stato varchar(20) DEFAULT 'in_attesa',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES user_account(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS richieste_turni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  dipendente_id uuid NOT NULL REFERENCES dipendenti(id) ON DELETE CASCADE,
  data_dal date NOT NULL,
  data_al date NOT NULL,
  giorni varchar(255) NOT NULL,
  orari jsonb,
  motivo text NOT NULL,
  stato varchar(20) DEFAULT 'in_attesa',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES user_account(id) ON DELETE SET NULL
);

-- ============================================================================
-- 5. TABELLE SESSIONI E INVII
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
  token_hash text NOT NULL UNIQUE,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expires ON user_sessions(expires_at);

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

CREATE INDEX IF NOT EXISTS idx_riepilogo_ore_invii_company ON riepilogo_ore_invii(company_id);
CREATE INDEX IF NOT EXISTS idx_riepilogo_ore_invii_stato ON riepilogo_ore_invii(stato);

-- ============================================================================
-- 6. AGGIUNGI COLONNE MANCANTI (se non esistono già)
-- ============================================================================

-- user_account
ALTER TABLE IF EXISTS user_account ADD COLUMN IF NOT EXISTS phone_number varchar(20);
ALTER TABLE IF EXISTS user_account ADD COLUMN IF NOT EXISTS two_factor_enabled boolean DEFAULT false;
ALTER TABLE IF EXISTS user_account ADD COLUMN IF NOT EXISTS two_factor_method varchar(10) DEFAULT 'email';
ALTER TABLE IF EXISTS user_account ADD COLUMN IF NOT EXISTS reset_token text;
ALTER TABLE IF EXISTS user_account ADD COLUMN IF NOT EXISTS reset_token_expires_at timestamptz;
ALTER TABLE IF EXISTS user_account ADD COLUMN IF NOT EXISTS is_temporary_credentials boolean DEFAULT false;
ALTER TABLE IF EXISTS user_account ADD COLUMN IF NOT EXISTS temporary_credentials_used_at timestamptz;
ALTER TABLE IF EXISTS user_account ADD COLUMN IF NOT EXISTS nome varchar(100);
ALTER TABLE IF EXISTS user_account ADD COLUMN IF NOT EXISTS cognome varchar(100);
ALTER TABLE IF EXISTS user_account ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;
ALTER TABLE IF EXISTS user_account ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '{}';
ALTER TABLE IF EXISTS user_account ADD COLUMN IF NOT EXISTS assigned_dipendente_ids jsonb;

-- company
ALTER TABLE IF EXISTS company ADD COLUMN IF NOT EXISTS auto_cleanup_enabled boolean DEFAULT false;
ALTER TABLE IF EXISTS company ADD COLUMN IF NOT EXISTS auto_cleanup_retention_months integer DEFAULT 12;
ALTER TABLE IF EXISTS company ADD COLUMN IF NOT EXISTS tolleranza_difetto_minuti integer DEFAULT 15;
ALTER TABLE IF EXISTS company ADD COLUMN IF NOT EXISTS auto_cleanup_giorno integer DEFAULT 15;
ALTER TABLE IF EXISTS company ADD COLUMN IF NOT EXISTS auto_cleanup_last_run varchar(7);

-- dispositivo
ALTER TABLE IF EXISTS dispositivo ADD COLUMN IF NOT EXISTS nome varchar(100);
ALTER TABLE IF EXISTS dispositivo ADD COLUMN IF NOT EXISTS firmware_version varchar(50);
ALTER TABLE IF EXISTS dispositivo ADD COLUMN IF NOT EXISTS sede varchar(100);
ALTER TABLE IF EXISTS dispositivo ADD COLUMN IF NOT EXISTS nfc_ok boolean;
ALTER TABLE IF EXISTS dispositivo ADD COLUMN IF NOT EXISTS display_ok boolean;
ALTER TABLE IF EXISTS dispositivo ADD COLUMN IF NOT EXISTS ota_pending boolean DEFAULT false;

-- dipendenti
ALTER TABLE IF EXISTS dipendenti ADD COLUMN IF NOT EXISTS promemoria_entrata_minuti integer DEFAULT NULL;
ALTER TABLE IF EXISTS dipendenti ADD COLUMN IF NOT EXISTS promemoria_uscita_minuti integer DEFAULT NULL;
ALTER TABLE IF EXISTS dipendenti ADD COLUMN IF NOT EXISTS importo_orario numeric(10,2) DEFAULT NULL;

-- ============================================================================
-- 7. INDICI AGGIUNTIVI PER PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_user_account_reset_token ON user_account(reset_token);
CREATE INDEX IF NOT EXISTS idx_dipendenti_company ON dipendenti(company_id);
CREATE INDEX IF NOT EXISTS idx_dispositivo_company ON dispositivo(company_id);
CREATE INDEX IF NOT EXISTS idx_tag_company ON tag(company_id);
CREATE INDEX IF NOT EXISTS idx_turni_company_dipendente ON turni(company_id, dipendente_id);
CREATE INDEX IF NOT EXISTS idx_presenza_company ON presenza(company_id);
CREATE INDEX IF NOT EXISTS idx_presenza_tag_reader ON presenza(tag_uid, reader_id);
CREATE INDEX IF NOT EXISTS idx_richieste_ferie_company ON richieste_ferie(company_id, dipendente_id);
CREATE INDEX IF NOT EXISTS idx_richieste_timbratura_company ON richieste_timbratura(company_id, dipendente_id);
CREATE INDEX IF NOT EXISTS idx_giustificazioni_company ON giustificazioni(company_id, dipendente_id);

-- ============================================================================
-- 8. NOTIFICHE PUSH (web-push / VAPID)
-- ============================================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_account_id uuid NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
  endpoint text NOT NULL UNIQUE,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_account_id);

-- company: interruttore "invia anche via email" per le notifiche passate a push
ALTER TABLE IF EXISTS company ADD COLUMN IF NOT EXISTS notifiche_anche_email boolean DEFAULT false;

-- ============================================================================
-- Migration complete: nessun dato cancellato, tutte le operazioni idempotenti
-- ============================================================================
