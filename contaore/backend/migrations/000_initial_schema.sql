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
