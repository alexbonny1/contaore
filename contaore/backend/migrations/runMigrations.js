import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_KEY

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.warn('[Migrations] Supabase credentials missing, skipping migrations')
  process.exit(0)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

const migrations = [
  {
    name: '001_add_2fa_support',
    sql: `
      -- 1. Aggiungi colonne a user_account
      ALTER TABLE user_account ADD COLUMN IF NOT EXISTS phone_number varchar(20);
      ALTER TABLE user_account ADD COLUMN IF NOT EXISTS two_factor_enabled boolean DEFAULT true;
      ALTER TABLE user_account ADD COLUMN IF NOT EXISTS two_factor_method varchar(10) DEFAULT 'email';

      -- 2. Crea tabella two_factor_attempts
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

      CREATE INDEX IF NOT EXISTS idx_two_factor_attempts_user_expires ON two_factor_attempts(user_id, expires_at);
      CREATE INDEX IF NOT EXISTS idx_two_factor_attempts_user_verified ON two_factor_attempts(user_id, verified, expires_at);

      -- 3. Aggiungi colonne password reset
      ALTER TABLE user_account ADD COLUMN IF NOT EXISTS reset_token text;
      ALTER TABLE user_account ADD COLUMN IF NOT EXISTS reset_token_expires_at timestamptz;
      CREATE INDEX IF NOT EXISTS idx_user_account_reset_token ON user_account(reset_token);

      -- 4. Crea tabella audit
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

      CREATE INDEX IF NOT EXISTS idx_two_factor_audit_user_date ON two_factor_audit(user_id, created_at);
      CREATE INDEX IF NOT EXISTS idx_two_factor_audit_event_type ON two_factor_audit(event_type, created_at);
    `
  }
]

export async function runMigrations() {
  console.log('[Migrations] Starting...')

  for (const migration of migrations) {
    try {
      console.log(`[Migrations] Running: ${migration.name}`)

      // Esegui il SQL
      const { error } = await supabase.rpc('exec_sql', {
        sql: migration.sql
      }).catch(async () => {
        // Se rpc non esiste, prova con raw query
        return await supabase
          .from('information_schema.tables')
          .select('*')
          .then(() => {
            // Se il select funziona, il DB è connesso
            // Prova a eseguire il SQL direttamente
            return supabase.query(migration.sql)
          })
      })

      if (error) {
        console.warn(`[Migrations] Warning for ${migration.name}:`, error.message)
        // Non bloccare se la migration fallisce (potrebbe essere idempotente)
      } else {
        console.log(`[Migrations] ✓ ${migration.name} completed`)
      }
    } catch (err) {
      console.error(`[Migrations] Error running ${migration.name}:`, err.message)
      // Non bloccare il server se la migration fallisce
    }
  }

  console.log('[Migrations] Done')
}
