import { supabase } from '../services/supabase.js'

export function generatePassword(length = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let pwd = ''
  for (let i = 0; i < length; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length))
  return pwd
}

export function buildUsername(nome, cognome) {
  const normalize = s =>
    (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
  return `${normalize(nome)}.${normalize(cognome)}`
}

export async function findAvailableUsername(base) {
  let username = base
  let attempt  = 1
  while (true) {
    const { data } = await supabase.from('user_account').select('id').eq('username', username).maybeSingle()
    if (!data) return username
    attempt++
    username = `${base}${attempt}`
  }
}
