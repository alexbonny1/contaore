import { supabase }         from '../services/supabase.js'
import { authenticateOwner, requirePermission } from '../middleware/auth.js'
import { generatePdfBuffer, generateExcelBuffer } from './export.js'
import { sendRiepilogoOreAllegato } from '../services/email.js'

const TIPI_VALIDI = [
  'assente', 'ritardo', 'straordinario_mensile',
  'lettore_offline', 'riepilogo_giornaliero', 'riepilogo_settimanale',
  'badge_non_riconosciuto', 'timbratura_mancante', 'riepilogo_ore_mensile'
]

const DEFAULTS = {
  assente:                { minuti_tolleranza: 30 },
  ritardo:                { minuti_tolleranza: 5  },
  straordinario_mensile:  { ore_soglia: 10 },
  lettore_offline:        { minuti_assenza: 60 },
  riepilogo_giornaliero:  { ora_invio: '18:00' },
  riepilogo_settimanale:  { ora_invio: '08:00' },
  badge_non_riconosciuto: {},
  timbratura_mancante:    { ore_soglia: 10 },
  riepilogo_ore_mensile:  { giorno_invio: 5, formato: 'pdf', modalita: 'automatico' }
}

export default async function notificheRoutes(fastify) {

  /* GET /api/notifications/settings */
  fastify.get('/api/notifications/settings', { preHandler: [authenticateOwner, requirePermission('can_manage_employees')] }, async (req, reply) => {
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
      request.log.error(err)
      return reply.send({ success: false })
    }
  })

  /* PUT /api/notifications/settings/:tipo */
  fastify.put('/api/notifications/settings/:tipo', { preHandler: [authenticateOwner, requirePermission('can_manage_employees')] }, async (req, reply) => {
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
        request.log.error(error)
        return reply.send({ success: false, error: error.message })
      }

      return reply.send({ success: true, setting: data })
    } catch (err) {
      request.log.error(err)
      return reply.send({ success: false })
    }
  })

  /* GET /api/notifications/riepilogo-ore/pending — riepiloghi in attesa di approvazione */
  fastify.get('/api/notifications/riepilogo-ore/pending', { preHandler: [authenticateOwner, requirePermission('can_manage_employees')] }, async (req, reply) => {
    try {
      const companyId = req.user.company_id
      const { data } = await supabase
        .from('riepilogo_ore_invii')
        .select('*')
        .eq('company_id', companyId)
        .eq('stato', 'in_attesa')
        .order('created_at', { ascending: false })
      return reply.send({ success: true, pending: data || [] })
    } catch (err) {
      req.log.error(err)
      return reply.send({ success: false })
    }
  })

  /* POST /api/notifications/riepilogo-ore/:id/approve — genera il file e lo invia via email */
  fastify.post('/api/notifications/riepilogo-ore/:id/approve', { preHandler: [authenticateOwner, requirePermission('can_manage_employees')] }, async (req, reply) => {
    try {
      const companyId = req.user.company_id
      const { id }    = req.params

      const { data: invio } = await supabase
        .from('riepilogo_ore_invii')
        .select('*')
        .eq('id', id).eq('company_id', companyId).eq('stato', 'in_attesa')
        .maybeSingle()
      if (!invio) return reply.send({ success: false, error: 'NOT_FOUND' })

      let employeeIds = invio.dipendente_ids
      if (!Array.isArray(employeeIds) || !employeeIds.length) {
        const { data: allEmp } = await supabase.from('dipendenti').select('id').eq('company_id', companyId)
        employeeIds = (allEmp || []).map(e => e.id)
      }
      if (!employeeIds.length) return reply.send({ success: false, error: 'NO_EMPLOYEES' })

      const buffer = invio.formato === 'excel'
        ? await generateExcelBuffer(employeeIds, invio.periodo, companyId)
        : await generatePdfBuffer(employeeIds, invio.periodo, companyId)
      if (!buffer) return reply.send({ success: false, error: 'NO_DATA' })

      const { data: company } = await supabase.from('company').select('nome').eq('id', companyId).single()
      const ext  = invio.formato === 'excel' ? 'xlsx' : 'pdf'
      const sent = await sendRiepilogoOreAllegato({
        email:       invio.destinatario_email,
        companyNome: company?.nome || '',
        periodo:     invio.periodo,
        formato:     invio.formato,
        buffer,
        filename:    `ContaOre_${invio.periodo.replace(/\s/g, '_')}.${ext}`
      })
      if (!sent) return reply.send({ success: false, error: 'EMAIL_FAILED' })

      await supabase.from('riepilogo_ore_invii')
        .update({ stato: 'inviato', inviato_il: new Date().toISOString(), approvato_da: req.user.id })
        .eq('id', id)

      return reply.send({ success: true })
    } catch (err) {
      req.log.error(err)
      return reply.status(500).send({ success: false })
    }
  })

  /* POST /api/notifications/riepilogo-ore/:id/reject */
  fastify.post('/api/notifications/riepilogo-ore/:id/reject', { preHandler: [authenticateOwner, requirePermission('can_manage_employees')] }, async (req, reply) => {
    try {
      const companyId = req.user.company_id
      const { id }    = req.params
      const { error } = await supabase
        .from('riepilogo_ore_invii')
        .update({ stato: 'rifiutato' })
        .eq('id', id).eq('company_id', companyId).eq('stato', 'in_attesa')
      if (error) return reply.send({ success: false, error: error.message })
      return reply.send({ success: true })
    } catch (err) {
      req.log.error(err)
      return reply.status(500).send({ success: false })
    }
  })
}
