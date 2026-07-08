import { supabase } from '../services/supabase.js'
import { authenticate } from '../middleware/auth.js'
import { getVapidPublicKey } from '../services/webpush.js'

export default async function pushRoutes(fastify) {

  /* GET /api/push/vapid-public-key — pubblica, serve al frontend per PushManager.subscribe */
  fastify.get('/api/push/vapid-public-key', async (request, reply) => {
    const publicKey = getVapidPublicKey()
    if (!publicKey) return reply.status(503).send({ success: false, error: 'PUSH_NOT_CONFIGURED' })
    return reply.send({ success: true, publicKey })
  })

  /* POST /api/push/subscribe — salva/aggiorna la subscription del dispositivo corrente */
  fastify.post('/api/push/subscribe', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { endpoint, keys } = request.body || {}
      if (!endpoint || !keys?.p256dh || !keys?.auth) {
        return reply.status(400).send({ success: false, error: 'INVALID_SUBSCRIPTION' })
      }

      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_account_id: request.user.id,
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          user_agent: request.headers['user-agent'] || null
        }, { onConflict: 'endpoint' })

      if (error) {
        request.log.error(error)
        return reply.status(500).send({ success: false, error: error.message })
      }

      return reply.send({ success: true })
    } catch (err) {
      request.log.error(err)
      return reply.status(500).send({ success: false })
    }
  })

  /* DELETE /api/push/subscribe — rimuove la subscription (es. l'utente disabilita le notifiche) */
  fastify.delete('/api/push/subscribe', { preHandler: authenticate }, async (request, reply) => {
    try {
      const { endpoint } = request.body || {}
      if (!endpoint) return reply.status(400).send({ success: false, error: 'MISSING_ENDPOINT' })

      await supabase
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', endpoint)
        .eq('user_account_id', request.user.id)

      return reply.send({ success: true })
    } catch (err) {
      request.log.error(err)
      return reply.status(500).send({ success: false })
    }
  })
}
