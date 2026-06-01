import { createClient } from '@supabase/supabase-js'
import ws from 'ws'
import dotenv from 'dotenv'

dotenv.config()

// Workaround for Node.js 20 WebSocket incompatibility
// Set global WebSocket before creating Supabase client
if (!globalThis.WebSocket) {
  globalThis.WebSocket = ws
}

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    global: {
      headers: {
        'User-Agent': 'Timbry/1.0.0'
      }
    }
  }
)