import { supabase }         from '../services/supabase.js'
import { authenticateOwner } from '../middleware/auth.js'

export default async function pauseRoutes(fastify) {

  /*
    GET /api/pausa-aziendale
    Tutte le pause aziendali attive
  */
  fastify.get(
    '/api/pausa-aziendale',
    { preHandler: authenticateOwner },
    async (request, reply) => {
      try {
        const company_id = request.user.company_id

        const { data, error } = await supabase
          .from('pausa_aziendale')
          .select('*')
          .eq('company_id', company_id)
          .eq('attiva', true)
          .order('data_inizio', { ascending: true })

        if (error) {
          request.log.error(error)
          return reply.status(500).send({ error: 'SERVER_ERROR' })
        }

        return reply.send({ success: true, pause: data || [] })

      } catch (err) {
        request.log.error(err)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    }
  )

  /*
    POST /api/pausa-aziendale
    Crea una pausa aziendale (tutti) o ferie approvate per dipendenti specifici.
    body: { data_inizio, data_fine, motivo, dipendente_ids?: string[] }
    - dipendente_ids vuoto/assente → pausa_aziendale per tutti
    - dipendente_ids con valori   → richieste_ferie approvate per ciascun dipendente
  */
  fastify.post(
    '/api/pausa-aziendale',
    { preHandler: authenticateOwner },
    async (request, reply) => {
      try {
        const company_id = request.user.company_id
        const { data_inizio, data_fine, motivo, dipendente_ids } = request.body

        if (!data_inizio || !data_fine || !motivo) {
          return reply.status(400).send({ error: 'MISSING_FIELDS' })
        }

        if (data_inizio > data_fine) {
          return reply.status(400).send({ error: 'DATE_INVALID', message: 'La data di inizio deve essere prima della data di fine' })
        }

        const isDipendenti = Array.isArray(dipendente_ids) && dipendente_ids.length > 0

        // ── FERIE PER DIPENDENTI SPECIFICI ────────────────────────────────────
        if (isDipendenti) {
          const created  = []
          const overlaps = []

          for (const dip_id of dipendente_ids) {
            const { data: existing } = await supabase
              .from('richieste_ferie')
              .select('id, data_inizio, data_fine')
              .eq('company_id', company_id)
              .eq('dipendente_id', dip_id)
              .neq('stato', 'rifiutata')
              .lte('data_inizio', data_fine)
              .gte('data_fine', data_inizio)
              .maybeSingle()

            if (existing) {
              overlaps.push(dip_id)
              continue
            }

            const { data: feria } = await supabase
              .from('richieste_ferie')
              .insert({
                company_id,
                dipendente_id: dip_id,
                data_inizio,
                data_fine,
                note:         motivo.trim(),
                stato:        'approvata',
                approvato_da: request.user.id,
                approvato_il: new Date().toISOString()
              })
              .select()
              .single()

            if (feria) created.push(feria)
          }

          return reply.send({
            success: true,
            tipo:    'ferie_dipendenti',
            created: created.length,
            skipped: overlaps.length,
            overlaps
          })
        }

        // ── PAUSA AZIENDALE (tutti i dipendenti) ──────────────────────────────
        const { data: overlap } = await supabase
          .from('pausa_aziendale')
          .select('id, data_inizio, data_fine')
          .eq('company_id', company_id)
          .eq('attiva', true)
          .lte('data_inizio', data_fine)
          .gte('data_fine', data_inizio)
          .maybeSingle()

        if (overlap) {
          return reply.status(400).send({
            error:   'OVERLAP',
            message: `Esiste già una pausa aziendale dal ${overlap.data_inizio} al ${overlap.data_fine}`
          })
        }

        const { data: pausa, error } = await supabase
          .from('pausa_aziendale')
          .insert({
            company_id,
            data_inizio,
            data_fine,
            motivo: motivo.trim(),
            attiva: true
          })
          .select()
          .single()

        if (error) {
          request.log.error(error)
          return reply.status(500).send({ error: 'INSERT_ERROR', detail: error.message })
        }

        return reply.send({ success: true, tipo: 'pausa_aziendale', pausa })

      } catch (err) {
        request.log.error(err)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    }
  )

  /*
    PUT /api/pausa-aziendale/:id/annulla
    Il titolare annulla una pausa aziendale
  */
  fastify.put(
    '/api/pausa-aziendale/:id/annulla',
    { preHandler: authenticateOwner },
    async (request, reply) => {
      try {
        const { id }     = request.params
        const company_id = request.user.company_id

        const { data: pausa, error: fetchError } = await supabase
          .from('pausa_aziendale')
          .select('id, attiva')
          .eq('id', id)
          .eq('company_id', company_id)
          .single()

        if (fetchError || !pausa) {
          return reply.status(404).send({ error: 'NOT_FOUND' })
        }

        if (!pausa.attiva) {
          return reply.status(400).send({ error: 'ALREADY_INACTIVE', message: 'Questa pausa è già stata annullata' })
        }

        const { data: updated, error } = await supabase
          .from('pausa_aziendale')
          .update({ attiva: false })
          .eq('id', id)
          .select()
          .single()

        if (error) {
          request.log.error(error)
          return reply.status(500).send({ error: 'UPDATE_ERROR' })
        }

        return reply.send({ success: true, pausa: updated })

      } catch (err) {
        request.log.error(err)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    }
  )

}
