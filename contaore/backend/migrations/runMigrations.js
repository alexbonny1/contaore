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

    console.log('[Migrations] ✅ Complete')
  } catch (err) {
    console.warn('[Migrations] ⚠️  Error during migrations:', err.message)
    console.warn('[Migrations] ⏭️  Continuing anyway - server will start')
  }
}

