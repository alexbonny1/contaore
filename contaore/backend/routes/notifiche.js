import { supabase }         from '../services/supabase.js'
import { authenticateOwner } from '../middleware/auth.js'

const TIPI_VALIDI = [
  'assente', 'ritardo', 'straordinario_mensile',
  'lettore_offline', 'riepilogo_giornaliero', 'riepilogo_settimanale',
  'badge_non_riconosciuto', 'timbratura_mancante'
]

const DEFAULTS = {
  assente:                { minuti_tolleranza: 30 },
  ritardo:                { minuti_tolleranza: 5  },
  straordinario_mensile:  { ore_soglia: 10 },
  lettore_offline:        { minuti_assenza: 60 },
  riepilogo_giornaliero:  { ora_invio: '18:00' },
  riepilogo_settimanale:  { ora_invio: '08:00' },
  badge_non_riconosciuto: {},
  timbratura_mancante:    { ore_soglia: 10 }
}

export default async function notificheRoutes(fastify) {

  /* GET /api/notifications/settings */
  fastify.get('/api/notifications/settings', { preHandler: authenticateOwner }, async (req, reply) => {
    try {
      const companyId = req.user.company_id
      const { data } = await supabase
        .from('notifiche_settings')
        .select('*')
        .eq('company_id', companyId)

      const map = {}
      ;(data || []).forEach(s => { map[s.tipo] = s })

      const settings = TIPI_VALIDI.map(tipo => ({
        tipo,
        attiva:               map[tipo]?.attiva              ?? false,
        parametri:            map[tipo]?.parametri           ?? DEFAULTS[tipo],
        target_ids:           map[tipo]?.target_ids          ?? null,
        email_destinatario:   map[tipo]?.email_destinatario  ?? null,
        last_triggered_at:    map[tipo]?.last_triggered_at   ?? null
      }))

      return reply.send({ success: true, settings })
    } catch (err) {
      console.error(err)
      return reply.send({ success: false })
    }
  })

  /* PUT /api/notifications/settings/:tipo */
  fastify.put('/api/notifications/settings/:tipo', { preHandler: authenticateOwner }, async (req, reply) => {
    try {
      const companyId = req.user.company_id
      const { tipo }  = req.params
      const { attiva, parametri, target_ids, email_destinatario } = req.body

      if (!TIPI_VALIDI.includes(tipo)) {
        return reply.status(400).send({ success: false, error: 'TIPO_NON_VALIDO' })
      }

      const normalizedTargetIds = Array.isArray(target_ids) && target_ids.length > 0
        ? target_ids
        : null

      // basic email validation — empty string treated as null
      const normalizedEmail = typeof email_destinatario === 'string' && email_destinatario.includes('@')
        ? email_destinatario.trim()
        : null

      const { data, error } = await supabase
        .from('notifiche_settings')
        .upsert({
          company_id:         companyId,
          tipo,
          attiva:             attiva    ?? false,
          parametri:          parametri ?? DEFAULTS[tipo] ?? {},
          target_ids:         normalizedTargetIds,
          email_destinatario: normalizedEmail,
          updated_at:         new Date().toISOString()
        }, { onConflict: 'company_id,tipo' })
        .select()
        .single()

      if (error) {
        console.error(error)
        return reply.send({ success: false, error: error.message })
      }

      return reply.send({ success: true, setting: data })
    } catch (err) {
      console.error(err)
      return reply.send({ success: false })
    }
  })
}
