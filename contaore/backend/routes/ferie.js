import { supabase }          from '../services/supabase.js'
import { authenticateOwner }  from '../middleware/auth.js'
import { sendEsitoFerie }     from '../services/email.js'

export default async function ferieRoutes(fastify) {

  /*
    GET /api/ferie
    Tutte le richieste ferie dell'azienda (con filtro opzionale per stato)
    query: ?stato=in_attesa | approvata | rifiutata
  */
  fastify.get(
    '/api/ferie',
    { preHandler: authenticateOwner },
    async (request, reply) => {
      try {
        const company_id = request.user.company_id
        const { stato }  = request.query

        let query = supabase
          .from('richieste_ferie')
          .select('*, dipendenti(nome, cognome, email)')
          .eq('company_id', company_id)
          .order('created_at', { ascending: false })

        if (stato) query = query.eq('stato', stato)

        const { data, error } = await query

        if (error) {
          console.log(error)
          return reply.status(500).send({ error: 'SERVER_ERROR' })
        }

        return reply.send({ success: true, ferie: data || [] })

      } catch (err) {
        console.log(err)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    }
  )

  /*
    PUT /api/ferie/:id/approva
    Il titolare approva una richiesta ferie
  */
  fastify.put(
    '/api/ferie/:id/approva',
    { preHandler: authenticateOwner },
    async (request, reply) => {
      try {
        const { id }         = request.params
        const company_id     = request.user.company_id
        const approvato_da   = request.user.id

        const { data: richiesta, error: fetchError } = await supabase
          .from('richieste_ferie')
          .select('*, dipendenti(nome, cognome, email)')
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
          .from('richieste_ferie')
          .update({
            stato:         'approvata',
            approvato_da,
            approvato_il:  new Date().toISOString()
          })
          .eq('id', id)
          .select()
          .single()

        if (error) {
          console.log(error)
          return reply.status(500).send({ error: 'SERVER_ERROR' })
        }

        // manda email al dipendente
        const emailDip = richiesta.dipendenti?.email
        if (emailDip) {
          await sendEsitoFerie({
            emailDipendente: emailDip,
            nome:            richiesta.dipendenti.nome,
            dataInizio:      richiesta.data_inizio,
            dataFine:        richiesta.data_fine,
            approvata:       true
          })
        }

        return reply.send({ success: true, richiesta: updated })

      } catch (err) {
        console.log(err)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    }
  )

  /*
    PUT /api/ferie/:id/rifiuta
    Il titolare rifiuta una richiesta ferie
    body: { motivazione: '...' }  (opzionale)
  */
  fastify.put(
    '/api/ferie/:id/rifiuta',
    { preHandler: authenticateOwner },
    async (request, reply) => {
      try {
        const { id }       = request.params
        const company_id   = request.user.company_id
        const approvato_da = request.user.id

        const { data: richiesta, error: fetchError } = await supabase
          .from('richieste_ferie')
          .select('*, dipendenti(nome, cognome, email)')
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
          .from('richieste_ferie')
          .update({
            stato:        'rifiutata',
            approvato_da,
            approvato_il: new Date().toISOString()
          })
          .eq('id', id)
          .select()
          .single()

        if (error) {
          console.log(error)
          return reply.status(500).send({ error: 'SERVER_ERROR' })
        }

        const emailDip = richiesta.dipendenti?.email
        if (emailDip) {
          await sendEsitoFerie({
            emailDipendente: emailDip,
            nome:            richiesta.dipendenti.nome,
            dataInizio:      richiesta.data_inizio,
            dataFine:        richiesta.data_fine,
            approvata:       false
          })
        }

        return reply.send({ success: true, richiesta: updated })

      } catch (err) {
        console.log(err)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    }
  )

  // ══════════════════════════════════════════════════════════════════════════
  //  GIUSTIFICAZIONI
  // ══════════════════════════════════════════════════════════════════════════

  /*
    GET /api/giustificazioni
    Tutte le giustificazioni dell'azienda
    query: ?stato=in_attesa | approvata | rifiutata
  */
  fastify.get(
    '/api/giustificazioni',
    { preHandler: authenticateOwner },
    async (request, reply) => {
      try {
        const company_id = request.user.company_id
        const { stato }  = request.query

        let query = supabase
          .from('giustificazioni')
          .select('*, dipendenti(nome, cognome)')
          .eq('company_id', company_id)
          .order('data', { ascending: false })

        if (stato) query = query.eq('stato', stato)

        const { data, error } = await query

        if (error) {
          console.log(error)
          return reply.status(500).send({ error: 'SERVER_ERROR' })
        }

        return reply.send({ success: true, giustificazioni: data || [] })

      } catch (err) {
        console.log(err)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    }
  )

  /*
    PUT /api/giustificazioni/:id/approva
  */
  fastify.put(
    '/api/giustificazioni/:id/approva',
    { preHandler: authenticateOwner },
    async (request, reply) => {
      try {
        const { id }       = request.params
        const company_id   = request.user.company_id
        const approvato_da = request.user.id

        const { data: existing } = await supabase
          .from('giustificazioni')
          .select('id, stato')
          .eq('id', id)
          .eq('company_id', company_id)
          .single()

        if (!existing) return reply.status(404).send({ error: 'NOT_FOUND' })
        if (existing.stato !== 'in_attesa') {
          return reply.status(400).send({ error: 'ALREADY_PROCESSED' })
        }

        const { data: updated, error } = await supabase
          .from('giustificazioni')
          .update({ stato: 'approvata', approvato_da, approvato_il: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single()

        if (error) {
          console.log(error)
          return reply.status(500).send({ error: 'SERVER_ERROR' })
        }

        return reply.send({ success: true, giustificazione: updated })

      } catch (err) {
        console.log(err)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    }
  )

  /*
    PUT /api/giustificazioni/:id/rifiuta
  */
  fastify.put(
    '/api/giustificazioni/:id/rifiuta',
    { preHandler: authenticateOwner },
    async (request, reply) => {
      try {
        const { id }       = request.params
        const company_id   = request.user.company_id
        const approvato_da = request.user.id

        const { data: existing } = await supabase
          .from('giustificazioni')
          .select('id, stato')
          .eq('id', id)
          .eq('company_id', company_id)
          .single()

        if (!existing) return reply.status(404).send({ error: 'NOT_FOUND' })
        if (existing.stato !== 'in_attesa') {
          return reply.status(400).send({ error: 'ALREADY_PROCESSED' })
        }

        const { data: updated, error } = await supabase
          .from('giustificazioni')
          .update({ stato: 'rifiutata', approvato_da, approvato_il: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single()

        if (error) {
          console.log(error)
          return reply.status(500).send({ error: 'SERVER_ERROR' })
        }

        return reply.send({ success: true, giustificazione: updated })

      } catch (err) {
        console.log(err)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    }
  )

  // ══════════════════════════════════════════════════════════════════════════
  //  DASHBOARD RICHIESTE (raggruppamento)
  // ══════════════════════════════════════════════════════════════════════════

  /*
    GET /api/requests/dashboard
    Il titolare visualizza tutte le richieste pendenti: ferie, giustificazioni, timbratura, permessi, modifica turni
    Utilizzato per la sezione richieste della dashboard
  */
  fastify.get(
    '/api/requests/dashboard',
    { preHandler: authenticateOwner },
    async (request, reply) => {
      try {
        const company_id = request.user.company_id
        const { stato }  = request.query

        // Recupera le richieste di ferie
        let queryFerie = supabase
          .from('richieste_ferie')
          .select('*, dipendenti(nome, cognome, email)')
          .eq('company_id', company_id)
          .order('created_at', { ascending: false })
        if (stato) queryFerie = queryFerie.eq('stato', stato)
        const { data: ferie } = await queryFerie

        // Recupera le giustificazioni
        let queryGiust = supabase
          .from('giustificazioni')
          .select('*, dipendenti(nome, cognome)')
          .eq('company_id', company_id)
          .order('created_at', { ascending: false })
        if (stato) queryGiust = queryGiust.eq('stato', stato)
        const { data: giustificazioni } = await queryGiust

        // Recupera le richieste di timbratura mancata
        let queryTimb = supabase
          .from('richieste_timbratura')
          .select('*, dipendenti(nome, cognome, badge_uid)')
          .eq('company_id', company_id)
          .order('created_at', { ascending: false })
        if (stato) queryTimb = queryTimb.eq('stato', stato)
        const { data: richieste_timbratura } = await queryTimb

        // Recupera le richieste di permessi (uscita/entrata)
        let queryPermessi = supabase
          .from('richieste_permessi')
          .select('*, dipendenti(nome, cognome)')
          .eq('company_id', company_id)
          .order('created_at', { ascending: false })
        if (stato) queryPermessi = queryPermessi.eq('stato', stato)
        const { data: richieste_permessi } = await queryPermessi

        // Recupera le richieste di modifica turni
        let queryModTurni = supabase
          .from('richieste_turni')
          .select('*, dipendenti(nome, cognome)')
          .eq('company_id', company_id)
          .order('created_at', { ascending: false })
        if (stato) queryModTurni = queryModTurni.eq('stato', stato)
        const { data: richieste_turni } = await queryModTurni

        return reply.send({
          success: true,
          richieste: {
            ferie:                 ferie || [],
            giustificazioni:       giustificazioni || [],
            richieste_timbratura:  richieste_timbratura || [],
            richieste_permessi:    richieste_permessi || [],
            richieste_turni:       richieste_turni || []
          },
          counts: {
            ferie_in_attesa:           (ferie || []).filter(f => f.stato === 'in_attesa').length,
            giustificazioni_in_attesa: (giustificazioni || []).filter(g => g.stato === 'in_attesa').length,
            timbratura_in_attesa:      (richieste_timbratura || []).filter(t => t.stato === 'in_attesa').length,
            permessi_in_attesa:        (richieste_permessi || []).filter(p => p.stato === 'in_attesa').length,
            turni_in_attesa:           (richieste_turni || []).filter(t => t.stato === 'in_attesa').length,
            totali_in_attesa:          (ferie || []).filter(f => f.stato === 'in_attesa').length +
                                        (giustificazioni || []).filter(g => g.stato === 'in_attesa').length +
                                        (richieste_timbratura || []).filter(t => t.stato === 'in_attesa').length +
                                        (richieste_permessi || []).filter(p => p.stato === 'in_attesa').length +
                                        (richieste_turni || []).filter(t => t.stato === 'in_attesa').length
          }
        })

      } catch (err) {
        console.log(err)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    }
  )

  /*
    DELETE /api/ferie/:id/admin
    Il titolare elimina definitivamente una richiesta ferie (qualsiasi stato)
    Se era approvata, il dipendente tornerà ad essere segnato assente in quei giorni
  */
  fastify.delete(
    '/api/ferie/:id/admin',
    { preHandler: authenticateOwner },
    async (request, reply) => {
      try {
        const { id }     = request.params
        const company_id = request.user.company_id

        const { data: richiesta } = await supabase
          .from('richieste_ferie')
          .select('id')
          .eq('id', id)
          .eq('company_id', company_id)
          .single()

        if (!richiesta) return reply.status(404).send({ error: 'NOT_FOUND' })

        await supabase.from('richieste_ferie').delete().eq('id', id)

        return reply.send({ success: true })

      } catch (err) {
        console.log(err)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    }
  )

}