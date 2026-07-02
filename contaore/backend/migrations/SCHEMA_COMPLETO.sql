-- ═══════════════════════════════════════════════════════════════════════
-- SCHEMA COMPLETO — vista unificata di sola consultazione
-- ═══════════════════════════════════════════════════════════════════════
--
-- Questo file NON viene eseguito automaticamente da nessuno script.
-- Serve solo a dare una vista d'assieme leggibile di tutto lo schema del
-- database, unendo in ordine (000 → 010) tutte le istruzioni SQL dei file
-- di migration presenti in questa cartella.
--
-- Le migration vere vengono applicate automaticamente all'avvio del server
-- da backend/migrations/runMigrations.js (SQL scritto direttamente in quel
-- file JS, idempotente: CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
--
-- Per verificare se il database reale ha tutte le tabelle/colonne previste,
-- usa invece backend/migrations/check_schema.sql (script diagnostico di
-- sola lettura, da eseguire manualmente in Supabase Studio -> SQL Editor).
--
-- I file numerati 000_...sql -> 010_...sql restano al loro posto come
-- archivio storico e NON sono stati modificati.

-- ═══════════════════════════════════════════════════════════════════════
-- Migration 000 — Schema iniziale (tabelle core)
-- File originale: 000_initial_schema.sql
-- ═══════════════════════════════════════════════════════════════════════
-- Schema iniziale Contaore
-- Tutte le istruzioni usano CREATE TABLE IF NOT EXISTS: sicuro su DB già popolato.
-- Ordine rispetta le dipendenze FK.

-- 1. company (nessuna dipendenza)
CREATE TABLE IF NOT EXISTS company (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome varchar(255) NOT NULL,
  slug varchar(255) UNIQUE,
  portale_dipendenti boolean DEFAULT false,
  tolleranza_straordinario_minuti integer DEFAULT 0,
  arrotonda_ore_al_turno boolean DEFAULT false,
  auto_cleanup_enabled boolean DEFAULT false,
  auto_cleanup_retention_months integer DEFAULT 12,
  created_at timestamptz DEFAULT now()
);

-- 2. dipendenti (dipende da company)
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
  created_at timestamptz DEFAULT now()
);

-- 3. user_account (dipende da company e dipendenti)
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
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 4. dispositivo (dipende da company)
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

-- 5. tag (dipende da company, dipendenti)
CREATE TABLE IF NOT EXISTS tag (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  uid varchar(255) NOT NULL,
  dipendente_id uuid REFERENCES dipendenti(id) ON DELETE SET NULL,
  stato varchar(50),
  created_at timestamptz DEFAULT now()
);

-- 6. turni (dipende da company, dipendenti)
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

-- 7. fasce_orarie (dipende da company)
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

-- 8. presenza (dipende da company)
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

-- 9. richieste_ferie (dipende da company, dipendenti, user_account)
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

-- 10. richieste_timbratura (dipende da company, dipendenti, presenza, user_account)
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

-- 11. giustificazioni (dipende da company, dipendenti, user_account)
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

-- 12. pausa_aziendale (dipende da company)
CREATE TABLE IF NOT EXISTS pausa_aziendale (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  data_inizio date NOT NULL,
  data_fine date NOT NULL,
  motivo text NOT NULL,
  attiva boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 13. notifiche_settings (dipende da company; UNIQUE su company_id+tipo necessario per upsert)
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

-- 14. ota_release (nessuna dipendenza; riga singola con id = 1)
CREATE TABLE IF NOT EXISTS ota_release (
  id integer PRIMARY KEY,
  version varchar(50) NOT NULL,
  url text NOT NULL,
  attivo boolean DEFAULT true,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- 15. device_claim (dipende da company)
CREATE TABLE IF NOT EXISTS device_claim (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token varchar(255) NOT NULL UNIQUE,
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- 16. admin_settings (nessuna dipendenza; riga singola con id = 1)
CREATE TABLE IF NOT EXISTS admin_settings (
  id integer PRIMARY KEY,
  alert_email varchar(255),
  offline_minuti integer DEFAULT 15,
  alert_attivo boolean DEFAULT false,
  alert_companies jsonb,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- Le seguenti tabelle sono gestite dalle migration 001-003 e runMigrations.js:
-- two_factor_attempts, two_factor_audit (001)
-- richieste_permessi, richieste_turni (002)
-- audit_log (003)
-- user_sessions (runMigrations.js)

-- ═══════════════════════════════════════════════════════════════════════
-- Migration 001 — Supporto 2FA
-- File originale: 001_add_2fa_support.sql
-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Add 2FA Support to Contaore
-- Date: 2026-06-18
-- Purpose: Add columns for 2FA and create tracking table for 2FA attempts
-- Safety: Uses IF NOT EXISTS - idempotent, safe to run multiple times, no data deletion

-- ============================================================================
-- 1. Extend user_account table with 2FA columns
-- ============================================================================

ALTER TABLE user_account
  ADD COLUMN IF NOT EXISTS phone_number varchar(20);

ALTER TABLE user_account
  ADD COLUMN IF NOT EXISTS two_factor_enabled boolean DEFAULT false;

ALTER TABLE user_account
  ADD COLUMN IF NOT EXISTS two_factor_method varchar(10) DEFAULT 'email';
  -- Allowed values: 'email', 'sms', 'whatsapp'

-- ============================================================================
-- 2. Create two_factor_attempts table for tracking 2FA verification attempts
-- ============================================================================

CREATE TABLE IF NOT EXISTS two_factor_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
  code varchar(6) NOT NULL,
  method varchar(10) NOT NULL,
  -- Method: 'email', 'sms', 'whatsapp'
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '10 minutes',
  verified boolean DEFAULT false,
  attempts_count integer DEFAULT 0
);

-- Index per query veloci
CREATE INDEX IF NOT EXISTS idx_two_factor_attempts_user_expires
  ON two_factor_attempts(user_id, expires_at);

CREATE INDEX IF NOT EXISTS idx_two_factor_attempts_user_verified
  ON two_factor_attempts(user_id, verified, expires_at);

-- ============================================================================
-- 3. Add columns for password reset (if not already present)
-- ============================================================================

ALTER TABLE user_account
  ADD COLUMN IF NOT EXISTS reset_token text;

ALTER TABLE user_account
  ADD COLUMN IF NOT EXISTS reset_token_expires_at timestamptz;

-- Index per cercare token di reset
CREATE INDEX IF NOT EXISTS idx_user_account_reset_token
  ON user_account(reset_token);

-- ============================================================================
-- 4. Optional: Create audit log table for 2FA events (for security tracking)
-- ============================================================================

CREATE TABLE IF NOT EXISTS two_factor_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
  event_type varchar(50) NOT NULL,
  -- Event types: 'login_2fa_sent', 'login_2fa_verified', 'login_2fa_failed',
  --              'reset_2fa_sent', 'reset_2fa_verified', 'reset_2fa_failed',
  --              'method_changed', '2fa_enabled', '2fa_disabled'
  method varchar(10),
  -- 'email', 'sms', 'whatsapp'
  ip_address inet,
  user_agent text,
  status varchar(20),
  -- 'success', 'failed', 'expired', 'rate_limited'
  error_reason text,
  created_at timestamptz DEFAULT now()
);

-- Index per ricerche audit
CREATE INDEX IF NOT EXISTS idx_two_factor_audit_user_date
  ON two_factor_audit(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_two_factor_audit_event_type
  ON two_factor_audit(event_type, created_at);

-- ============================================================================
-- 5. Data preservation check (read-only)
-- ============================================================================

-- Verify no data was deleted during migration
-- SELECT COUNT(*) as total_users FROM user_account;
-- Expected: Same count before and after migration

-- ============================================================================
-- Migration Status: COMPLETE
-- All changes are additive (no columns deleted, no data modified)
-- Safe to rollback by dropping the new tables and columns if needed
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════
-- Migration 002 — Tabelle richieste permessi/turni
-- File originale: 002_add_requests_tables.sql
-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Add Requests Tables for Permessi and Turni Modifications
-- Date: 2026-06-19
-- Purpose: Create tables for employee permission requests and shift modification requests
-- Safety: Uses IF NOT EXISTS - idempotent, safe to run multiple times

-- ============================================================================
-- 1. Create richieste_permessi table for permission requests (exit/entry)
-- ============================================================================

CREATE TABLE IF NOT EXISTS richieste_permessi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  dipendente_id uuid NOT NULL REFERENCES dipendenti(id) ON DELETE CASCADE,

  -- Permission details
  data_uscita date,
  ora_uscita time,
  data_entrata date,
  ora_entrata time,
  tipo varchar(50) DEFAULT 'personale',
  -- Allowed: 'personale', 'medico', 'altro'

  motivo text NOT NULL,

  -- Status tracking
  stato varchar(20) DEFAULT 'in_attesa',
  -- Allowed: 'in_attesa', 'approvata', 'rifiutata'

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES user_account(id) ON DELETE SET NULL
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_richieste_permessi_company
  ON richieste_permessi(company_id);

CREATE INDEX IF NOT EXISTS idx_richieste_permessi_dipendente
  ON richieste_permessi(dipendente_id);

CREATE INDEX IF NOT EXISTS idx_richieste_permessi_stato
  ON richieste_permessi(stato);

CREATE INDEX IF NOT EXISTS idx_richieste_permessi_created
  ON richieste_permessi(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_richieste_permessi_dipendente_stato
  ON richieste_permessi(dipendente_id, stato);

-- ============================================================================
-- 2. Create richieste_turni table for shift modification requests
-- ============================================================================

CREATE TABLE IF NOT EXISTS richieste_turni (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  dipendente_id uuid NOT NULL REFERENCES dipendenti(id) ON DELETE CASCADE,

  -- Period and days affected
  data_dal date NOT NULL,
  data_al date NOT NULL,
  giorni varchar(255) NOT NULL,
  -- Comma-separated day names: 'lunedi,martedi,mercoledi,...'

  orari jsonb,
  -- JSON structure: { "lunedi": { "ingresso": "09:00", "uscita": "17:00" }, ... }

  motivo text NOT NULL,

  -- Status tracking
  stato varchar(20) DEFAULT 'in_attesa',
  -- Allowed: 'in_attesa', 'approvata', 'rifiutata'

  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  approved_at timestamptz,
  approved_by uuid REFERENCES user_account(id) ON DELETE SET NULL
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_richieste_turni_company
  ON richieste_turni(company_id);

CREATE INDEX IF NOT EXISTS idx_richieste_turni_dipendente
  ON richieste_turni(dipendente_id);

CREATE INDEX IF NOT EXISTS idx_richieste_turni_stato
  ON richieste_turni(stato);

CREATE INDEX IF NOT EXISTS idx_richieste_turni_created
  ON richieste_turni(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_richieste_turni_dipendente_stato
  ON richieste_turni(dipendente_id, stato);

CREATE INDEX IF NOT EXISTS idx_richieste_turni_period
  ON richieste_turni(data_dal, data_al);

-- ============================================================================
-- Migration Status: COMPLETE
-- All changes are additive (creating new tables only)
-- Safe to rollback by dropping the tables if needed
-- ============================================================================

-- ═══════════════════════════════════════════════════════════════════════
-- Migration 003 — Tabella audit log
-- File originale: 003_create_audit_log.sql
-- ═══════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES user_account(id) ON DELETE SET NULL,

  action varchar(50) NOT NULL,
  resource_type varchar(50),
  resource_id uuid,

  old_state jsonb,
  new_state jsonb,

  ip_address inet,
  user_agent text,

  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_audit_log_company ON audit_log(company_id, created_at DESC);
CREATE INDEX idx_audit_log_user ON audit_log(user_id, created_at DESC);
CREATE INDEX idx_audit_log_action ON audit_log(action, created_at DESC);
CREATE INDEX idx_audit_log_resource ON audit_log(resource_type, resource_id);

-- ═══════════════════════════════════════════════════════════════════════
-- Migration 004 — Credenziali temporanee nuovo owner
-- File originale: 004_add_temporary_credentials.sql
-- ═══════════════════════════════════════════════════════════════════════
-- Add temporary credentials tracking to user_account table
ALTER TABLE user_account
ADD COLUMN IF NOT EXISTS is_temporary_credentials boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS temporary_credentials_used_at timestamptz DEFAULT null;

-- Comment for clarity
COMMENT ON COLUMN user_account.is_temporary_credentials IS 'When true, credentials work only on first login then auto-expire';
COMMENT ON COLUMN user_account.temporary_credentials_used_at IS 'Timestamp when temporary credentials were first used (marks them as expired)';

-- ═══════════════════════════════════════════════════════════════════════
-- Migration 005 — Colonne tolleranza calcolo ore
-- File originale: 005_add_tolerance_columns.sql
-- ═══════════════════════════════════════════════════════════════════════
-- Aggiunge colonna tolleranza in difetto per il calcolo ore mensili
ALTER TABLE company ADD COLUMN IF NOT EXISTS tolleranza_difetto_minuti integer DEFAULT 15;

-- ═══════════════════════════════════════════════════════════════════════
-- Migration 006 — Promemoria timbratura dipendente
-- File originale: 006_promemoria_timbratura.sql
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE dipendenti ADD COLUMN IF NOT EXISTS promemoria_entrata_minuti integer DEFAULT NULL;
ALTER TABLE dipendenti ADD COLUMN IF NOT EXISTS promemoria_uscita_minuti integer DEFAULT NULL;

-- ═══════════════════════════════════════════════════════════════════════
-- Migration 007 — Permessi admin granulari
-- File originale: 007_admin_permissions.sql
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE user_account ADD COLUMN IF NOT EXISTS permissions jsonb DEFAULT '{}';

-- ═══════════════════════════════════════════════════════════════════════
-- Migration 008 — Tariffa oraria dipendente
-- File originale: 008_importo_orario.sql
-- ═══════════════════════════════════════════════════════════════════════
ALTER TABLE dipendenti ADD COLUMN IF NOT EXISTS importo_orario numeric(10,2) DEFAULT NULL;

-- ═══════════════════════════════════════════════════════════════════════
-- Migration 009 — Pulizia automatica + coda invio riepilogo ore
-- File originale: 009_riepilogo_ore_e_pulizia_giorno.sql
-- ═══════════════════════════════════════════════════════════════════════
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

-- ═══════════════════════════════════════════════════════════════════════
-- Migration 010 — Restrizione accesso admin a sottoinsieme dipendenti
-- File originale: 010_admin_employee_scope.sql
-- ═══════════════════════════════════════════════════════════════════════
-- Migration 010: restrizione dell'accesso admin a un sottoinsieme di dipendenti

-- null/vuoto = accesso a tutti i dipendenti della company (comportamento attuale, invariato)
-- array di id = l'admin vede/gestisce solo questi dipendenti
ALTER TABLE IF EXISTS user_account ADD COLUMN IF NOT EXISTS assigned_dipendente_ids jsonb;
