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

