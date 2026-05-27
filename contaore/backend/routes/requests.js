/*
  RICHIESTE DIPENDENTI
  - Richieste di timbratura mancata (dipendente non ha timbrato l'uscita)
  - Gestite dal titolare dell'azienda
*/

import { supabase }              from '../services/supabase.js'
import { authenticateDipendente } from '../middleware/auth.js'
import { authenticateOwner }      from '../middleware/auth.js'

export default async function requestsRoutes(fastify) {

  /*
    POST /api/requests/missing-scan
    Il dipendente richiede l'aggiunta di una timbratura mancata
    body: { data: '2025-01-15', tipo: 'USCITA', ora: '17:30', motivo: 'Ho dimenticato di timbrare' }
  */
  fastify.post(
    '/api/requests/missing-scan',
    { preHandler: authenticateDipendente },
    async (request, reply) => {
      try {
        const { dipendente_id, company_id } = request.user
        const { data, tipo, ora_uscita, ora, motivo } = request.body

        // supporta sia ora che ora_uscita per retrocompatibilità
        const oraFinal = ora || ora_uscita
        const tipoFinal = tipo || 'USCITA'

        if (!data || !oraFinal || !motivo) {
          return reply.status(400).send({ error: 'MISSING_FIELDS' })
        }

        if (!['ENTRATA', 'USCITA'].includes(tipoFinal)) {
          return reply.status(400).send({ error: 'INVALID_TIPO' })
        }

        if (motivo.trim().length < 3) {
          return reply.status(400).send({ error: 'MOTIVO_TOO_SHORT' })
        }

        if (!/^\d{2}:\d{2}$/.test(oraFinal)) {
          return reply.status(400).send({ error: 'INVALID_TIME_FORMAT' })
        }

        // controlla che non esista già una richiesta per lo stesso giorno e stesso tipo
        const { data: existing } = await supabase
          .from('richieste_timbratura')
          .select('id, stato')
          .eq('dipendente_id', dipendente_id)
          .eq('data', data)
          .eq('tipo', tipoFinal)
          .maybeSingle()

        if (existing) {
          return reply.status(400).send({
            error:   'ALREADY_EXISTS',
            message: `Hai già inviato una richiesta di ${tipoFinal} per questo giorno (stato: ${existing.stato})`
          })
        }

        // massimo 4 richieste totali al giorno (es. 2 entrate + 2 uscite per chi timbra due volte)
        const { count } = await supabase
          .from('richieste_timbratura')
          .select('id', { count: 'exact', head: true })
          .eq('dipendente_id', dipendente_id)
          .eq('data', data)

        if (count >= 4) {
          return reply.status(400).send({
            error:   'DAILY_LIMIT',
            message: 'Hai raggiunto il limite massimo di 4 richieste per questo giorno'
          })
        }

        const { data: result, error } = await supabase
          .from('richieste_timbratura')
          .insert({
            company_id,
            dipendente_id,
            data,
            tipo:      tipoFinal,
            ora_uscita: oraFinal,
            motivo: motivo.trim(),
            stato:  'in_attesa'
          })
          .select()
          .single()

        if (error) {
          console.log(error)
          return reply.status(500).send({ error: 'SERVER_ERROR' })
        }

        return reply.send({ success: true, richiesta: result })

      } catch (err) {
        console.log(err)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    }
  )

  /*
    GET /api/requests/missing-scans
    Il dipendente visualizza le proprie richieste di timbratura
  */
  fastify.get(
    '/api/requests/missing-scans',
    { preHandler: authenticateDipendente },
    async (request, reply) => {
      try {
        const { dipendente_id } = request.user

        const { data, error } = await supabase
          .from('richieste_timbratura')
          .select('*')
          .eq('dipendente_id', dipendente_id)
          .order('created_at', { ascending: false })

        if (error) {
          console.log(error)
          return reply.status(500).send({ error: 'SERVER_ERROR' })
        }

        return reply.send({ success: true, richieste: data || [] })

      } catch (err) {
        console.log(err)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    }
  )

  /*
    DELETE /api/requests/missing-scans/:id
    Il dipendente cancella una richiesta (solo se in_attesa)
  */
  fastify.delete(
    '/api/requests/missing-scans/:id',
    { preHandler: authenticateDipendente },
    async (request, reply) => {
      try {
        const { id }            = request.params
        const { dipendente_id } = request.user

        const { data: richiesta } = await supabase
          .from('richieste_timbratura')
          .select('id, stato')
          .eq('id', id)
          .eq('dipendente_id', dipendente_id)
          .single()

        if (!richiesta) {
          return reply.status(404).send({ error: 'NOT_FOUND' })
        }

        if (richiesta.stato !== 'in_attesa') {
          return reply.status(400).send({
            error:   'CANNOT_DELETE',
            message: 'Puoi cancellare solo le richieste ancora in attesa'
          })
        }

        await supabase.from('richieste_timbratura').delete().eq('id', id)

        return reply.send({ success: true })

      } catch (err) {
        console.log(err)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    }
  )

  // ══════════════════════════════════════════════════════════════════════════
  //  TITOLARE - GESTIONE RICHIESTE DI TIMBRATURA
  // ══════════════════════════════════════════════════════════════════════════

  /*
    GET /api/requests/missing-scans/admin
    Il titolare visualizza tutte le richieste di timbratura dell'azienda
    query: ?stato=in_attesa | approvata | rifiutata
  */
  fastify.get(
    '/api/requests/missing-scans/admin',
    { preHandler: authenticateOwner },
    async (request, reply) => {
      try {
        const company_id = request.user.company_id
        const { stato }  = request.query

        let query = supabase
          .from('richieste_timbratura')
          .select('*, dipendenti(nome, cognome, badge_uid)')
          .eq('company_id', company_id)
          .order('created_at', { ascending: false })

        if (stato) query = query.eq('stato', stato)

        const { data, error } = await query

        if (error) {
          console.log(error)
          return reply.status(500).send({ error: 'SERVER_ERROR' })
        }

        return reply.send({ success: true, richieste: data || [] })

      } catch (err) {
        console.log(err)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    }
  )

  /*
    PUT /api/requests/missing-scans/:id/approva
    Il titolare approva una richiesta di timbratura mancata
    Aggiunge la timbratura come USCITA nel sistema
  */
  fastify.put(
    '/api/requests/missing-scans/:id/approva',
    { preHandler: authenticateOwner },
    async (request, reply) => {
      try {
        const { id }       = request.params
        const company_id   = request.user.company_id

        const { data: richiesta, error: fetchError } = await supabase
          .from('richieste_timbratura')
          .select('*, dipendenti(badge_uid)')
          .eq('id', id)
          .eq('company_id', company_id)
          .single()

        if (fetchError || !richiesta) {
          return reply.status(404).send({ error: 'NOT_FOUND' })
        }

        if (richiesta.stato !== 'in_attesa') {
          return reply.status(400).send({
            error:   'ALREADY_PROCESSED',
            message: `La richiesta è già stata ${richiesta.stato}`
          })
        }

        // Crea la timbratura (ENTRATA o USCITA in base al tipo della richiesta)
        const tipoTimbratura = richiesta.tipo || 'USCITA'
        const [ora, minuti] = richiesta.ora_uscita.split(':')
        const dataCompleta = new Date(`${richiesta.data}T${ora}:${minuti}:00`)

        const { data: newPresenza, error: presenzaError } = await supabase
          .from('presenza')
          .insert({
            company_id,
            tag_uid: richiesta.dipendenti.badge_uid,
            tipo: tipoTimbratura,
            created_at: dataCompleta.toISOString()
          })
          .select()
          .single()

        if (presenzaError) {
          console.log(presenzaError)
          return reply.status(500).send({ error: 'PRESENCE_INSERT_ERROR' })
        }

        // Aggiorna lo stato della richiesta
        const { data: updated, error } = await supabase
          .from('richieste_timbratura')
          .update({
            stato: 'approvata',
            approvato_da: request.user.id,
            approvato_il: new Date().toISOString()
          })
          .eq('id', id)
          .select()
          .single()

        if (error) {
          console.log(error)
          return reply.status(500).send({ error: 'SERVER_ERROR' })
        }

        return reply.send({ success: true, richiesta: updated })

      } catch (err) {
        console.log(err)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    }
  )

  /*
    PUT /api/requests/missing-scans/:id/rifiuta
    Il titolare rifiuta una richiesta di timbratura mancata
  */
  fastify.put(
    '/api/requests/missing-scans/:id/rifiuta',
    { preHandler: authenticateOwner },
    async (request, reply) => {
      try {
        const { id }       = request.params
        const company_id   = request.user.company_id

        const { data: richiesta, error: fetchError } = await supabase
          .from('richieste_timbratura')
          .select('id, stato')
          .eq('id', id)
          .eq('company_id', company_id)
          .single()

        if (fetchError || !richiesta) {
          return reply.status(404).send({ error: 'NOT_FOUND' })
        }

        if (richiesta.stato !== 'in_attesa') {
          return reply.status(400).send({
            error:   'ALREADY_PROCESSED',
            message: `La richiesta è già stata ${richiesta.stato}`
          })
        }

        const { data: updated, error } = await supabase
          .from('richieste_timbratura')
          .update({
            stato: 'rifiutata',
            approvato_da: request.user.id,
            approvato_il: new Date().toISOString()
          })
          .eq('id', id)
          .select()
          .single()

        if (error) {
          console.log(error)
          return reply.status(500).send({ error: 'SERVER_ERROR' })
        }

        return reply.send({ success: true, richiesta: updated })

      } catch (err) {
        console.log(err)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    }
  )

  /*
    DELETE /api/requests/missing-scans/:id/admin
    Il titolare elimina definitivamente una richiesta di timbratura (qualsiasi stato)
  */
  fastify.delete(
    '/api/requests/missing-scans/:id/admin',
    { preHandler: authenticateOwner },
    async (request, reply) => {
      try {
        const { id }     = request.params
        const company_id = request.user.company_id

        const { data: richiesta } = await supabase
          .from('richieste_timbratura')
          .select('id')
          .eq('id', id)
          .eq('company_id', company_id)
          .single()

        if (!richiesta) return reply.status(404).send({ error: 'NOT_FOUND' })

        await supabase.from('richieste_timbratura').delete().eq('id', id)

        return reply.send({ success: true })

      } catch (err) {
        console.log(err)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    }
  )

}