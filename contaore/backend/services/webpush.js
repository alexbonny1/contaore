import webpush from 'web-push'
import { supabase } from './supabase.js'

const VAPID_SUBJECT     = process.env.VAPID_SUBJECT || 'mailto:info.timbry@gmail.com'
const VAPID_PUBLIC_KEY  = process.env.VAPID_PUBLIC_KEY
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY

const vapidConfigured = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY)

if (vapidConfigured) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)
} else {
  console.warn('[webpush] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY mancanti — le notifiche push sono disabilitate')
}

export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY || null
}

// ─── invio a un singolo user_account (tutte le sue subscription/dispositivi) ──

export async function sendPushToUser(userAccountId, payload) {
  if (!vapidConfigured || !userAccountId) return

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_account_id', userAccountId)

  if (!subs?.length) return

  await Promise.all(subs.map(async sub => {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        JSON.stringify(payload)
      )
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        await supabase.from('push_subscriptions').delete().eq('id', sub.id)
      } else {
        console.error('sendPushToUser:', err.message)
      }
    }
  }))
}

export async function sendPushToUsers(userAccountIds, payload) {
  const ids = [...new Set((userAccountIds || []).filter(Boolean))]
  await Promise.all(ids.map(id => sendPushToUser(id, payload)))
}

// ─── risoluzione destinatari (analoghe a quelle usate per le email) ──────────

export async function ownerUserAccountId(companyId) {
  const { data } = await supabase
    .from('user_account').select('id')
    .eq('company_id', companyId).eq('role', 'owner').maybeSingle()
  return data?.id || null
}

export async function dipendenteUserAccountId(dipendenteId) {
  const { data } = await supabase
    .from('user_account').select('id')
    .eq('dipendente_id', dipendenteId).maybeSingle()
  return data?.id || null
}

export async function superadminUserAccountIds() {
  const { data } = await supabase
    .from('user_account').select('id').eq('role', 'superadmin')
  return (data || []).map(u => u.id)
}
