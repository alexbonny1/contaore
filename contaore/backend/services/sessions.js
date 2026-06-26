import crypto from 'crypto'
import { supabase } from './supabase.js'

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export async function createSession(userId, token) {
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
  const { error } = await supabase
    .from('user_sessions')
    .insert({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt })
  if (error) {
    console.error('[sessions] createSession error:', error.message)
    throw new Error('SESSION_CREATE_ERROR')
  }
}

export async function validateSession(token) {
  const tokenHash = hashToken(token)
  const { data, error } = await supabase
    .from('user_sessions')
    .select('id, expires_at')
    .eq('token_hash', tokenHash)
    .maybeSingle()
  if (error || !data) return false
  if (new Date(data.expires_at) < new Date()) return false
  return true
}

export async function deleteSession(token) {
  const tokenHash = hashToken(token)
  const { error } = await supabase
    .from('user_sessions')
    .delete()
    .eq('token_hash', tokenHash)
  if (error) console.error('[sessions] deleteSession error:', error.message)
}

export async function deleteUserSessions(userId) {
  const { error } = await supabase
    .from('user_sessions')
    .delete()
    .eq('user_id', userId)
  if (error) console.error('[sessions] deleteUserSessions error:', error.message)
}
