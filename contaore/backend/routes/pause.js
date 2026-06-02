/*
  PAUSA AZIENDALE PER FERIE
  - Il titolare mette l'azienda in pausa (tutti i dipendenti vanno in ferie automaticamente)
  - Può annullare la pausa se necessario
*/

import { supabase }         from '../services/supabase.js'
import { authenticateOwner } from '../middleware/auth.js'

export default async function pauseRoutes(fastify) {

  /*
    POST /api/pausa-aziendale
    Il titolare crea una pausa aziendale per ferie
    body: { data_inizio: '2025-08-01', data_fine: '2025-08-20', motivo: 'Ferie estive' }
  */
  fastify.post(
    '/api/pausa-aziendale',
    { preHandler: authenticateOwner },
    async (request, reply) => {
      try {
        const company_id   = request.user.company_id
        const { data_inizio, data_fine, motivo } = request.body

        if (!data_inizio || !data_fine || !motivo) {
          return reply.status(400).send({ error: 'MISSING_FIELDS' })
        }

        if (data_inizio > data_fine) {
          return reply.status(400).send({ error: 'DATE_INVALID', message: 'La data di inizio deve essere prima della data di fine' })
        }

        // Controlla se c'è già una pausa in quell'intervallo
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
          console.log(error)
          return reply.status(500).send({ error: 'INSERT_ERROR', detail: error.message })
        }

        return reply.send({ success: true, pausa })

      } catch (err) {
        console.log(err)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    }
  )

  /*
    GET /api/pausa-aziendale
    Il titolare visualizza la pausa aziendale attiva (se esiste)
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
          .maybeSingle()

        if (error) {
          console.log(error)
          return reply.status(500).send({ error: 'SERVER_ERROR' })
        }

        return reply.send({ success: true, pausa: data || null })

      } catch (err) {
        console.log(err)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    }
  )

  /*
    PUT /api/pausa-aziendale/:id/annulla
    Il titolare annulla la pausa aziendale
  */
  fastify.put(
    '/api/pausa-aziendale/:id/annulla',
    { preHandler: authenticateOwner },
    async (request, reply) => {
      try {
        const { id }       = request.params
        const company_id   = request.user.company_id

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
          return reply.status(400).send({
            error:   'ALREADY_INACTIVE',
            message: 'Questa pausa è già stata annullata'
          })
        }

        const { data: updated, error } = await supabase
          .from('pausa_aziendale')
          .update({ attiva: false })
          .eq('id', id)
          .select()
          .single()

        if (error) {
          console.log(error)
          return reply.status(500).send({ error: 'UPDATE_ERROR' })
        }

        return reply.send({ success: true, pausa: updated })

      } catch (err) {
        console.log(err)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    }
  )

}
