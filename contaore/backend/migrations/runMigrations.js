import { createClient } from '@supabase/supabase-js'
import pg from 'pg'
import { readFileSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY
const DATABASE_URL = process.env.DATABASE_URL

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

    // Esegui il file SQL 011_complete_schema_fix.sql
    if (DATABASE_URL) {
      try {
        await runSQLMigrations(DATABASE_URL)
      } catch (err) {
        console.warn('[Migrations] ⚠️  Error running SQL migrations:', err.message)
        console.warn('[Migrations] ⏭️  Continuing anyway - some features may not work')
      }
    } else {
      console.warn('[Migrations] ⚠️  DATABASE_URL not set, skipping DDL migrations')
    }

    // Reload schema cache di PostgREST
    await supabase.rpc('exec', {
      sql: `NOTIFY pgrst, 'reload schema';`
    }).catch(() => ({}))

    console.log('[Migrations] ✅ Complete')
    return
  } catch (err) {
    console.warn('[Migrations] ⚠️  Error during migrations:', err.message)
    console.warn('[Migrations] ⏭️  Continuing anyway - server will start')
  }
}

async function runSQLMigrations(databaseUrl) {
  const client = new pg.Client({ connectionString: databaseUrl })

  try {
    await client.connect()
    console.log('[Migrations] 📝 Executing 011_complete_schema_fix.sql...')

    const sqlPath = join(__dirname, '011_complete_schema_fix.sql')
    const sql = readFileSync(sqlPath, 'utf-8')

    // Esegui il file SQL in un'unica transazione
    await client.query('BEGIN')
    try {
      await client.query(sql)
      await client.query('COMMIT')
      console.log('[Migrations] ✅ SQL migration executed successfully')
    } catch (err) {
      await client.query('ROLLBACK')
      throw err
    }
  } finally {
    await client.end()
  }
}

