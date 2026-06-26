import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY

export async function runMigrations() {
  // Se non ci sono credenziali Supabase, skippa le migrazioni
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.log('[Migrations] ⏭️  Skipped (Supabase credentials not found)')
    return
  }

  console.log('[Migrations] 🚀 Starting migrations...')

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

    // Test connessione
    const { data, error: testError } = await supabase
      .from('user_account')
      .select('count', { count: 'exact' })
      .limit(1)

    if (testError) {
      console.warn('[Migrations] ⚠️  Database connection test failed:', testError.message)
      console.warn('[Migrations] ⏭️  Continuing without migrations (database may be unreachable)')
      return
    }

    console.log('[Migrations] ✅ Database connection successful')

    // ─── Schema iniziale: tabelle core (IF NOT EXISTS — sicuro su DB esistente) ──
    await supabase.rpc('exec', {
      sql: `CREATE TABLE IF NOT EXISTS company (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        nome varchar(255) NOT NULL,
        slug varchar(255) UNIQUE,
        portale_dipendenti boolean DEFAULT false,
        tolleranza_straordinario_minuti integer DEFAULT 0,
        arrotonda_ore_al_turno boolean DEFAULT false,
        auto_cleanup_enabled boolean DEFAULT false,
        auto_cleanup_retention_months integer DEFAULT 12,
        created_at timestamptz DEFAULT now()
      );`
    }).catch(() => ({}))

    await supabase.rpc('exec', {
      sql: `CREATE TABLE IF NOT EXISTS dipendenti (
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
      );`
    }).catch(() => ({}))

    await supabase.rpc('exec', {
      sql: `CREATE TABLE IF NOT EXISTS user_account (
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
      );`
    }).catch(() => ({}))

    await supabase.rpc('exec', {
      sql: `CREATE TABLE IF NOT EXISTS dispositivo (
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
      );`
    }).catch(() => ({}))

    await supabase.rpc('exec', {
      sql: `CREATE TABLE IF NOT EXISTS tag (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
        uid varchar(255) NOT NULL,
        dipendente_id uuid REFERENCES dipendenti(id) ON DELETE SET NULL,
        stato varchar(50),
        created_at timestamptz DEFAULT now()
      );`
    }).catch(() => ({}))

    await supabase.rpc('exec', {
      sql: `CREATE TABLE IF NOT EXISTS turni (
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
      );`
    }).catch(() => ({}))

    await supabase.rpc('exec', {
      sql: `CREATE TABLE IF NOT EXISTS fasce_orarie (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
        nome varchar(255),
        ora_inizio time NOT NULL,
        ora_fine time NOT NULL,
        tipo varchar(20) NOT NULL,
        reader_id varchar(255),
        created_at timestamptz DEFAULT now()
      );`
    }).catch(() => ({}))

    await supabase.rpc('exec', {
      sql: `CREATE TABLE IF NOT EXISTS presenza (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
        tag_uid varchar(255) NOT NULL,
        reader_id varchar(255),
        tipo varchar(20) NOT NULL,
        manuale boolean DEFAULT false,
        automatica boolean DEFAULT false,
        timestamp timestamptz,
        created_at timestamptz DEFAULT now()
      );`
    }).catch(() => ({}))

    await supabase.rpc('exec', {
      sql: `CREATE TABLE IF NOT EXISTS richieste_ferie (
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
      );`
    }).catch(() => ({}))

    await supabase.rpc('exec', {
      sql: `CREATE TABLE IF NOT EXISTS richieste_timbratura (
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
      );`
    }).catch(() => ({}))

    await supabase.rpc('exec', {
      sql: `CREATE TABLE IF NOT EXISTS giustificazioni (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
        dipendente_id uuid NOT NULL REFERENCES dipendenti(id) ON DELETE CASCADE,
        data date NOT NULL,
        motivo text NOT NULL,
        stato varchar(20) DEFAULT 'in_attesa',
        approvato_da uuid REFERENCES user_account(id) ON DELETE SET NULL,
        approvato_il timestamptz,
        created_at timestamptz DEFAULT now()
      );`
    }).catch(() => ({}))

    await supabase.rpc('exec', {
      sql: `CREATE TABLE IF NOT EXISTS pausa_aziendale (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
        data_inizio date NOT NULL,
        data_fine date NOT NULL,
        motivo text NOT NULL,
        attiva boolean DEFAULT true,
        created_at timestamptz DEFAULT now()
      );`
    }).catch(() => ({}))

    await supabase.rpc('exec', {
      sql: `CREATE TABLE IF NOT EXISTS notifiche_settings (
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
      );`
    }).catch(() => ({}))

    await supabase.rpc('exec', {
      sql: `CREATE TABLE IF NOT EXISTS ota_release (
        id integer PRIMARY KEY,
        version varchar(50) NOT NULL,
        url text NOT NULL,
        attivo boolean DEFAULT true,
        updated_at timestamptz DEFAULT now(),
        created_at timestamptz DEFAULT now()
      );`
    }).catch(() => ({}))

    await supabase.rpc('exec', {
      sql: `CREATE TABLE IF NOT EXISTS device_claim (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        token varchar(255) NOT NULL UNIQUE,
        company_id uuid NOT NULL REFERENCES company(id) ON DELETE CASCADE,
        used boolean DEFAULT false,
        created_at timestamptz DEFAULT now()
      );`
    }).catch(() => ({}))

    await supabase.rpc('exec', {
      sql: `CREATE TABLE IF NOT EXISTS admin_settings (
        id integer PRIMARY KEY,
        alert_email varchar(255),
        offline_minuti integer DEFAULT 15,
        alert_attivo boolean DEFAULT false,
        alert_companies jsonb,
        updated_at timestamptz DEFAULT now(),
        created_at timestamptz DEFAULT now()
      );`
    }).catch(() => ({}))

    // ─── ALTER TABLE / colonne aggiuntive ────────────────────────────────────────

    // Esegui una migration di test semplice
    const { error: alterError } = await supabase.rpc('exec', {
      sql: `ALTER TABLE IF EXISTS user_account ADD COLUMN IF NOT EXISTS phone_number varchar(20);`
    }).catch(() => ({ error: null })) // Ignora errore se rpc non esiste

    if (alterError) {
      console.warn('[Migrations] ⚠️  Could not add phone_number column:', alterError.message)
    } else {
      console.log('[Migrations] ✅ phone_number column added')
    }

    // Colonne per la pulizia automatica dello storico presenze
    await supabase.rpc('exec', {
      sql: `ALTER TABLE IF EXISTS company ADD COLUMN IF NOT EXISTS auto_cleanup_enabled boolean DEFAULT false;`
    }).catch(() => ({ error: null }))
    await supabase.rpc('exec', {
      sql: `ALTER TABLE IF EXISTS company ADD COLUMN IF NOT EXISTS auto_cleanup_retention_months integer DEFAULT 12;`
    }).catch(() => ({ error: null }))

    // Credenziali temporanee per nuovi owner (migration 004)
    await supabase.rpc('exec', {
      sql: `ALTER TABLE IF EXISTS user_account ADD COLUMN IF NOT EXISTS is_temporary_credentials boolean DEFAULT false;`
    }).catch(() => ({ error: null }))

    await supabase.rpc('exec', {
      sql: `ALTER TABLE IF EXISTS user_account ADD COLUMN IF NOT EXISTS temporary_credentials_used_at timestamptz DEFAULT null;`
    }).catch(() => ({ error: null }))

    // Colonne opzionali tabella dispositivo (migration 005)
    await supabase.rpc('exec', {
      sql: `ALTER TABLE IF EXISTS dispositivo ADD COLUMN IF NOT EXISTS nome varchar(100);`
    }).catch(() => ({ error: null }))
    await supabase.rpc('exec', {
      sql: `ALTER TABLE IF EXISTS dispositivo ADD COLUMN IF NOT EXISTS firmware_version varchar(50);`
    }).catch(() => ({ error: null }))
    await supabase.rpc('exec', {
      sql: `ALTER TABLE IF EXISTS dispositivo ADD COLUMN IF NOT EXISTS sede varchar(100);`
    }).catch(() => ({ error: null }))
    await supabase.rpc('exec', {
      sql: `ALTER TABLE IF EXISTS dispositivo ADD COLUMN IF NOT EXISTS nfc_ok boolean;`
    }).catch(() => ({ error: null }))
    await supabase.rpc('exec', {
      sql: `ALTER TABLE IF EXISTS dispositivo ADD COLUMN IF NOT EXISTS display_ok boolean;`
    }).catch(() => ({ error: null }))
    await supabase.rpc('exec', {
      sql: `ALTER TABLE IF EXISTS dispositivo ADD COLUMN IF NOT EXISTS ota_pending boolean DEFAULT false;`
    }).catch(() => ({ error: null }))

    // Colonne profilo personale per titolare (migration 006)
    await supabase.rpc('exec', {
      sql: `ALTER TABLE IF EXISTS user_account ADD COLUMN IF NOT EXISTS nome varchar(100);`
    }).catch(() => ({}))
    await supabase.rpc('exec', {
      sql: `ALTER TABLE IF EXISTS user_account ADD COLUMN IF NOT EXISTS cognome varchar(100);`
    }).catch(() => ({}))

    // Tabelle richieste permessi e turni (migration 002)
    await supabase.rpc('exec', {
      sql: `CREATE TABLE IF NOT EXISTS richieste_permessi (
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
      );`
    }).catch(() => ({}))

    await supabase.rpc('exec', {
      sql: `CREATE TABLE IF NOT EXISTS richieste_turni (
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
      );`
    }).catch(() => ({}))

    // Colonna per invalidazione sessioni al cambio password
    await supabase.rpc('exec', {
      sql: `ALTER TABLE IF EXISTS user_account ADD COLUMN IF NOT EXISTS password_changed_at timestamptz DEFAULT NULL;`
    }).catch(() => ({}))

    // Tabella sessioni utente (sostituzione password_version)
    await supabase.rpc('exec', {
      sql: `CREATE TABLE IF NOT EXISTS user_sessions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id uuid NOT NULL REFERENCES user_account(id) ON DELETE CASCADE,
        token_hash text NOT NULL UNIQUE,
        created_at timestamptz DEFAULT now(),
        expires_at timestamptz NOT NULL
      );`
    }).catch(() => ({}))

    await supabase.rpc('exec', {
      sql: `CREATE INDEX IF NOT EXISTS idx_user_sessions_token_hash ON user_sessions(token_hash);`
    }).catch(() => ({}))

    await supabase.rpc('exec', {
      sql: `CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);`
    }).catch(() => ({}))

    console.log('[Migrations] ✅ Complete')
  } catch (err) {
    console.warn('[Migrations] ⚠️  Error during migrations:', err.message)
    console.warn('[Migrations] ⏭️  Continuing anyway - server will start')
  }
}

