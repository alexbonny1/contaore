import stripe from '../services/stripe.js'
import { authenticate } from '../middleware/auth.js'

export default async function billingRoutes(fastify) {

  /*
    POST /api/billing/create-checkout-session
    Crea una Stripe Checkout Session per l'abbonamento.
    Configurare STRIPE_SECRET_KEY e STRIPE_PRICE_ID nelle variabili d'ambiente.
    Il modello pricing (mensile/annuale) verrà definito in una fase successiva.
  */
  fastify.post('/api/billing/create-checkout-session', { preHandler: authenticate }, async (request, reply) => {
    if (!stripe) {
      return reply.status(503).send({ error: 'BILLING_NOT_CONFIGURED', message: 'Stripe non è configurato.' })
    }

    try {
      const { price_id, success_url, cancel_url } = request.body
      const priceId = price_id || process.env.STRIPE_PRICE_ID

      if (!priceId) {
        return reply.status(400).send({ error: 'MISSING_PRICE_ID' })
      }

      const session = await stripe.checkout.sessions.create({
        mode:        'subscription',
        line_items:  [{ price: priceId, quantity: 1 }],
        success_url: success_url || `${process.env.FRONTEND_URL}/impostazioni/abbonamento?success=1`,
        cancel_url:  cancel_url  || `${process.env.FRONTEND_URL}/impostazioni/abbonamento?canceled=1`,
        metadata:    { company_id: request.user.company_id },
      })

      return reply.send({ success: true, url: session.url })
    } catch (err) {
      request.log.error(err)
      return reply.status(500).send({ error: 'STRIPE_ERROR', message: err.message })
    }
  })

  /*
    POST /api/billing/webhook
    Riceve gli eventi Stripe (subscription created/updated/deleted, payment failed).
    Configurare il webhook secret in STRIPE_WEBHOOK_SECRET.
  */
  fastify.post('/api/billing/webhook', {
    config: { rawBody: true }
  }, async (request, reply) => {
    if (!stripe) {
      return reply.status(503).send({ error: 'BILLING_NOT_CONFIGURED' })
    }

    const sig    = request.headers['stripe-signature']
    const secret = process.env.STRIPE_WEBHOOK_SECRET

    if (!secret) {
      request.log.warn('STRIPE_WEBHOOK_SECRET not set — skipping signature verification')
      return reply.send({ received: true })
    }

    let event
    try {
      event = stripe.webhooks.constructEvent(request.rawBody, sig, secret)
    } catch (err) {
      request.log.error(`Webhook signature verification failed: ${err.message}`)
      return reply.status(400).send({ error: 'INVALID_SIGNATURE' })
    }

    request.log.info({ type: event.type }, 'Stripe webhook received')

    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        // TODO: aggiornare lo stato abbonamento dell'azienda nel DB
        break
      case 'customer.subscription.deleted':
        // TODO: disattivare l'accesso quando l'abbonamento scade
        break
      case 'invoice.payment_failed':
        // TODO: notificare il titolare del pagamento fallito
        break
    }

    return reply.send({ received: true })
  })

}
