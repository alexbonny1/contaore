import bcrypt from 'bcrypt'
import { supabase }              from '../services/supabase.js'
import { authenticateDipendente } from '../middleware/auth.js'
import { sendNotificaRichiestaFerie, sendCredenziali, sendNotificaRichiestaGiustificazione } from '../services/email.js'
import { sendPushToUser, ownerUserAccountId } from '../services/webpush.js'
import { emailCcEnabled } from '../services/notifiche.js'
import { generatePassword, buildUsername, findAvailableUsername } from '../utils/userHelpers.js'
import {
  GIORNI, timeToMinutes, shiftDurationMins, shiftExpectedHours,
  getLocalDateStr, getLocalTimeMinutes, getLocalDayOfWeek,
  buildSessions, buildCoppie, computeBreakDeductionMins, isInFerie
} from '../utils/timeHelpers.js'

function groupByDay(reads = [], shifts = [], turniAttivi = false, dataInizio = null, ferieApprovate = [], giustificazioni = [], pausaAziendale = null, toleranceMins = 10, toleranceDeficitMins = 15) {

  const sessions = buildSessions(reads)

  const byDate = {}
  sessions.forEach(sess => {
    if (!byDate[sess.date]) byDate[sess.date] = []
    byDate[sess.date].push(sess)
  })

  const giustSet = new Set(
    giustificazioni.filter(g => g.stato === 'approvata').map(g => g.data)
  )

  const presentDays = Object.entries(byDate).map(([giorno, daySessions]) => {
    let oreLavorate = Number(daySessions.reduce((sum, s) => sum + s.hours, 0).toFixed(2))
    let ore_previste = 0, ore_straordinario = 0, stato = 'presente', ritardo_minuti = 0

    if (turniAttivi && shifts.length > 0) {
      const dayName   = GIORNI[getLocalDayOfWeek(giorno + 'T00:00:00Z')]
      const dayShifts = shifts.filter(s => s.giorno_settimana === dayName)
      ore_previste    = dayShifts.reduce((sum, s) => sum + shiftExpectedHours(s), 0)

      let breakDeductMins = 0
      for (const s of dayShifts) {
        if (s.uscita_1 && s.ingresso_2) {
          const bStart = timeToMinutes(s.uscita_1)
          const bEnd   = timeToMinutes(s.ingresso_2)
          if (bEnd > bStart) {
            const sorted = daySessions
              .flatMap(sess => [sess.entrata, sess.uscita].filter(Boolean))
              .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
            breakDeductMins += computeBreakDeductionMins(sorted, bStart, bEnd)
          }
        }
      }
      if (breakDeductMins > 0) {
        oreLavorate = Number(Math.max(0, oreLavorate - breakDeductMins / 60).toFixed(2))
      }

      var ore_effettive = oreLavorate
      if (ore_previste > 0) {
        const extraMins = (oreLavorate - ore_previste) * 60
        if (extraMins > 0) {
          ore_straordinario = extraMins > toleranceMins
            ? Number((extraMins / 60).toFixed(2))
            : 0
          ore_effettive = extraMins > toleranceMins ? oreLavorate : ore_previste
        } else {
          ore_straordinario = 0
          const deficitMins = -extraMins
          ore_effettive = deficitMins <= toleranceDeficitMins ? ore_previste : oreLavorate
        }
      } else {
        ore_straordinario = Number(oreLavorate.toFixed(2))
      }

      // stato hierarchy
      if (ore_straordinario > 0) {
        stato = 'straordinario'
      } else if (ore_previste > 0 && oreLavorate > 0 && oreLavorate < ore_previste) {
        const deficitMins = (ore_previste - oreLavorate) * 60
        if (deficitMins > toleranceDeficitMins) stato = 'parziale'
      }

      // ritardo: first ENTRATA vs ingresso_1 of earliest shift
      if (ore_previste > 0) {
        const firstEntrata = daySessions
          .filter(s => s.entrata)
          .map(s => s.entrata)
          .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0]
        const firstShift = dayShifts
          .filter(s => s.ingresso_1)
          .sort((a, b) => timeToMinutes(a.ingresso_1) - timeToMinutes(b.ingresso_1))[0]
        if (firstEntrata && firstShift) {
          const expectedMins = timeToMinutes(firstShift.ingresso_1)
          const actualMins   = getLocalTimeMinutes(firstEntrata.created_at)
          const delay        = actualMins - expectedMins
          if (delay > 5) {
            ritardo_minuti = delay
            if (stato === 'presente' || stato === 'parziale') stato = 'ritardo'
          }
        }
      }
    }

    // Una giustificazione approvata per questo giorno prevale sullo stato calcolato
    // dalla presenza (es. una timbratura parziale/anomala non deve nascondere il
    // fatto che il titolare ha approvato una giustificazione per quella data).
    if (giustSet.has(giorno)) stato = 'giustificata'

    return { giorno, coppie: buildCoppie(daySessions), ore_totali: oreLavorate, ore_effettive: ore_effettive ?? oreLavorate, ore_previste, ore_straordinario, stato, ritardo_minuti, assente: false }
  })

  const absentDays = []
  if (turniAttivi && shifts.length > 0) {
    const now     = new Date()
    const today   = getLocalDateStr(now.toISOString())
    const nowMins = getLocalTimeMinutes(now.toISOString())
    const start   = dataInizio ? new Date(dataInizio) : new Date()
    const endDate = new Date()
    endDate.setHours(23, 59, 59, 999)
    const presentSet = new Set(sessions.filter(s => s.entrata || s.uscita).map(s => s.date))
    const shiftDays  = new Set(shifts.map(s => s.giorno_settimana))
    const cursor     = new Date(start)
    cursor.setHours(0, 0, 0, 0)

    while (cursor <= endDate) {
      const dateStr = [
        cursor.getFullYear(),
        String(cursor.getMonth() + 1).padStart(2, '0'),
        String(cursor.getDate()).padStart(2, '0')
      ].join('-')
      const dayName = GIORNI[getLocalDayOfWeek(dateStr + 'T00:00:00Z')]
      const isToday = dateStr === today

      if (shiftDays.has(dayName) && !presentSet.has(dateStr)) {
        const dayShifts    = shifts.filter(s => s.giorno_settimana === dayName)
        const ore_previste = dayShifts.reduce((sum, s) => sum + shiftExpectedHours(s), 0)

        if (isToday) {
          const turnoIniziato = dayShifts.some(s => {
            if (!s.ingresso_1) return false
            return nowMins > timeToMinutes(s.ingresso_1)
          })
          if (!turnoIniziato) { cursor.setDate(cursor.getDate() + 1); continue }
        }

        if (pausaAziendale && pausaAziendale.attiva && dateStr >= pausaAziendale.data_inizio && dateStr <= pausaAziendale.data_fine) {
          absentDays.push({ giorno: dateStr, coppie: [], ore_totali: 0, ore_previste: 0, ore_straordinario: 0, stato: 'ferie', assente: false })
        } else if (isInFerie(dateStr, ferieApprovate)) {
          absentDays.push({ giorno: dateStr, coppie: [], ore_totali: 0, ore_previste, ore_straordinario: 0, stato: 'ferie', assente: false })
        } else if (giustSet.has(dateStr)) {
          absentDays.push({ giorno: dateStr, coppie: [], ore_totali: 0, ore_previste, ore_straordinario: 0, stato: 'giustificata', assente: true })
        } else {
          absentDays.push({ giorno: dateStr, coppie: [], ore_totali: 0, ore_previste, ore_straordinario: 0, stato: 'assente', assente: true })
        }
      }
      cursor.setDate(cursor.getDate() + 1)
    }
  }

  return [...presentDays, ...absentDays].sort((a, b) => new Date(b.giorno) - new Date(a.giorno))
}

// ─────────────────────────────────────────────────────────────────────────────

export default async function dipendenteRoutes(fastify) {

  /*
    GET /api/dipendente/me
    Profilo completo: turni, storia, stats — tutto readonly
  */
  fastify.get(
    '/api/dipendente/me',
    { preHandler: authenticateDipendente },
    async (request, reply) => {
      try {
        const { dipendente_id, company_id } = request.user

        if (!dipendente_id) {
          return reply.status(400).send({ error: 'DIPENDENTE_ID_MISSING' })
        }

        // dati dipendente
        const { data: employee, error: empError } = await supabase
          .from('dipendenti')
          .select('*')
          .eq('id', dipendente_id)
          .eq('company_id', company_id)
          .single()

        if (empError || !employee) {
          return reply.status(404).send({ error: 'NOT_FOUND' })
        }

        // turni
        const { data: shifts } = await supabase
          .from('turni')
          .select('*')
          .eq('dipendente_id', dipendente_id)
          .order('created_at', { ascending: false })

        // presenze
        const { data: reads } = await supabase
          .from('presenza')
          .select('*')
          .eq('tag_uid', employee.badge_uid)
          .eq('company_id', company_id)
          .order('created_at', { ascending: true })

        // ferie approvate
        const { data: ferieApprovate } = await supabase
          .from('richieste_ferie')
          .select('data_inizio, data_fine')
          .eq('dipendente_id', dipendente_id)
          .eq('stato', 'approvata')

        // giustificazioni
        const { data: giustificazioni } = await supabase
          .from('giustificazioni')
          .select('*')
          .eq('dipendente_id', dipendente_id)

        // pausa aziendale attiva
        const { data: pausaAziendale } = await supabase
          .from('pausa_aziendale')
          .select('*')
          .eq('company_id', company_id)
          .eq('attiva', true)
          .maybeSingle()

        // tolleranza straordinari configurabile
        const { data: companySettings } = await supabase
          .from('company')
          .select('tolleranza_straordinario_minuti, tolleranza_difetto_minuti')
          .eq('id', company_id)
          .single()
        const toleranceMins        = companySettings?.tolleranza_straordinario_minuti ?? 10
        const toleranceDeficitMins = companySettings?.tolleranza_difetto_minuti ?? 15

        const days = groupByDay(
          reads || [],
          shifts || [],
          !!employee.turni_attivi,
          employee.turni_attivati_il || employee.data_inizio,
          ferieApprovate || [],
          giustificazioni || [],
          pausaAziendale || null,
          toleranceMins,
          toleranceDeficitMins
        )

        const now       = new Date()
        const today     = getLocalDateStr(now.toISOString())
        const nowMins   = getLocalTimeMinutes(now.toISOString())
        const todayName = GIORNI[getLocalDayOfWeek(now.toISOString())]
        const thisMonth = getLocalDateStr(now.toISOString()).slice(0, 7)
        const monthReads = (reads || []).filter(r => getLocalDateStr(r.created_at).slice(0, 7) === thisMonth)

        const empSessions = buildSessions(reads || [])
        const lastSession = empSessions.length > 0 ? empSessions[empSessions.length - 1] : null
        const presente    = !!(lastSession && !lastSession.uscita && Date.now() - new Date(lastSession.entrata.created_at) < 18 * 3600000)
        let inPausa = false
        if (presente && employee.turni_attivi) {
          inPausa = (shifts || []).some(s => {
            if (s.giorno_settimana !== todayName || !s.uscita_1 || !s.ingresso_2) return false
            const pausaStart = timeToMinutes(s.uscita_1)
            const pausaEnd   = timeToMinutes(s.ingresso_2)
            return nowMins >= pausaStart && nowMins < pausaEnd
          })
        }

        return reply.send({
          success: true,
          in_pausa: inPausa,
          employee: {
            id:       employee.id,
            nome:     employee.nome,
            cognome:  employee.cognome,
            email:    employee.email,
            badge_uid: employee.badge_uid,
            turni_attivi: employee.turni_attivi,
            promemoria_entrata_minuti: employee.promemoria_entrata_minuti,
            promemoria_uscita_minuti:  employee.promemoria_uscita_minuti,
            importo_orario: employee.importo_orario
          },
          shifts:         shifts || [],
          history_days:   days,
          giustificazioni: giustificazioni || [],
          stats: {
            ore_mese_corrente: (() => {
              const currentMonth = new Date().toISOString().slice(0, 7)
              return Number(days.filter(d => d.giorno.slice(0, 7) === currentMonth)
                .reduce((s, d) => s + (d.ore_effettive ?? d.ore_totali), 0).toFixed(2))
            })(),
            giorni_assenti:    days.filter(d => d.assente).length,
            giorni_ferie:      days.filter(d => d.stato === 'ferie').length,
            ore_straordinario: (() => {
              if (!employee.turni_attivi) return 0
              const currentMonth = new Date().toISOString().slice(0, 7)
              const monthDays = days.filter(d => d.giorno.slice(0, 7) === currentMonth)
              const totLav  = monthDays.reduce((s, d) => s + (d.ore_effettive ?? d.ore_totali), 0)
              const totPrev = monthDays.reduce((s, d) => s + d.ore_previste, 0)
              return Number(Math.max(0, totLav - totPrev).toFixed(2))
            })()
          }
        })

      } catch (err) {
        request.log.error(err)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    }
  )

  /*
    POST /api/dipendente/giustifica
    Il dipendente giustifica un giorno di assenza
    body: { data: '2025-01-15', motivo: 'Visita medica' }
  */
  fastify.post(
    '/api/dipendente/giustifica',
    { preHandler: authenticateDipendente },
    async (request, reply) => {
      try {
        const { dipendente_id, company_id } = request.user
        const { data, motivo } = request.body

        if (!data || !motivo) {
          return reply.status(400).send({ error: 'MISSING_FIELDS' })
        }

        if (motivo.trim().length < 3) {
          return reply.status(400).send({ error: 'MOTIVO_TOO_SHORT' })
        }

        // controlla che non esista già una giustificazione per quel giorno
        const { data: existing } = await supabase
          .from('giustificazioni')
          .select('id, stato')
          .eq('dipendente_id', dipendente_id)
          .eq('data', data)
          .maybeSingle()

        if (existing) {
          return reply.status(400).send({
            error:   'ALREADY_EXISTS',
            message: `Hai già inviato una giustificazione per questo giorno (stato: ${existing.stato})`
          })
        }

        const { data: result, error } = await supabase
          .from('giustificazioni')
          .insert({
            company_id,
            dipendente_id,
            data,
            motivo: motivo.trim(),
            stato:  'in_attesa'
          })
          .select()
          .single()

        if (error) {
          request.log.error(error)
          return reply.status(500).send({ error: 'SERVER_ERROR' })
        }

        // notifica al titolare: push di default, email solo se la company l'ha attivata
        try {
          const { data: emp } = await supabase
            .from('dipendenti')
            .select('nome, cognome')
            .eq('id', dipendente_id)
            .single()

          const { data: company } = await supabase
            .from('company')
            .select('nome')
            .eq('id', company_id)
            .single()

          const nomeDipendente = `${emp.nome} ${emp.cognome}`

          const ownerId = await ownerUserAccountId(company_id)
          if (ownerId) {
            sendPushToUser(ownerId, {
              title: `Nuova giustificazione — ${nomeDipendente}`,
              body:  `${data} — ${motivo.trim()}`,
              url:   '/requests'
            }).catch(e => console.error('push richiesta_giustificazione:', e))
          }

          if (await emailCcEnabled(company_id)) {
            const { data: owner } = await supabase
              .from('user_account').select('email')
              .eq('company_id', company_id).eq('role', 'owner').maybeSingle()
            if (owner?.email) {
              await sendNotificaRichiestaGiustificazione({
                emailOwner:     owner.email,
                nomeDipendente,
                data,
                motivo:         motivo.trim(),
                companyNome:    company?.nome || ''
              })
            }
          }
        } catch (mailErr) {
        }

        return reply.send({ success: true, giustificazione: result })

      } catch (err) {
        request.log.error(err)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    }
  )

  /*
    GET /api/dipendente/ferie
    Lista delle proprie richieste ferie
  */
  fastify.get(
    '/api/dipendente/ferie',
    { preHandler: authenticateDipendente },
    async (request, reply) => {
      try {
        const { dipendente_id } = request.user
        let { company_id } = request.user

        if (!dipendente_id) {
          return reply.status(400).send({ error: 'MISSING_DIPENDENTE_ID' })
        }

        // se company_id manca nel token, recuperalo dalla tabella dipendenti
        if (!company_id) {
          const { data: dip } = await supabase
            .from('dipendenti')
            .select('company_id')
            .eq('id', dipendente_id)
            .single()
          company_id = dip?.company_id || null
        }

        const [ferieRes, pauseRes] = await Promise.all([
          supabase.from('richieste_ferie').select('*')
            .eq('dipendente_id', dipendente_id)
            .order('created_at', { ascending: false }),
          company_id
            ? supabase.from('pausa_aziendale').select('*')
                .eq('company_id', company_id)
                .order('data_inizio', { ascending: false })
            : Promise.resolve({ data: [], error: null })
        ])

        if (ferieRes.error) {
          console.error('ferie query error:', ferieRes.error)
          return reply.status(500).send({ error: 'SERVER_ERROR' })
        }

        return reply.send({
          success: true,
          ferie:  ferieRes.data || [],
          pause:  (pauseRes.data || []).map(p => ({
            id:          p.id,
            data_inizio: p.data_inizio,
            data_fine:   p.data_fine,
            motivo:      p.motivo || 'Chiusura aziendale',
            tipo:        'pausa_aziendale'
          }))
        })

      } catch (err) {
        request.log.error(err)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    }
  )

  /*
    POST /api/dipendente/ferie
    Il dipendente fa richiesta ferie
    body: { data_inizio: '2025-08-01', data_fine: '2025-08-10', note: '...' }
  */
  fastify.post(
    '/api/dipendente/ferie',
    { preHandler: authenticateDipendente },
    async (request, reply) => {
      try {
        const { dipendente_id, company_id } = request.user
        const { data_inizio, data_fine, note } = request.body

        if (!data_inizio || !data_fine) {
          return reply.status(400).send({ error: 'MISSING_FIELDS' })
        }

        if (data_inizio > data_fine) {
          return reply.status(400).send({ error: 'DATE_INVALID', message: 'La data di inizio deve essere prima della data di fine' })
        }

        // non si può richiedere ferie nel passato
        const today = new Date().toISOString().split('T')[0]
        if (data_fine < today) {
          return reply.status(400).send({ error: 'DATE_PAST', message: 'Non puoi richiedere ferie per date già passate' })
        }

        // controlla overlap con ferie già esistenti (in attesa o approvate)
        const { data: overlap } = await supabase
          .from('richieste_ferie')
          .select('id, data_inizio, data_fine, stato')
          .eq('dipendente_id', dipendente_id)
          .in('stato', ['in_attesa', 'approvata'])
          .lte('data_inizio', data_fine)
          .gte('data_fine', data_inizio)
          .maybeSingle()

        if (overlap) {
          return reply.status(400).send({
            error:   'OVERLAP',
            message: `Hai già una richiesta ferie in quel periodo (${overlap.data_inizio} → ${overlap.data_fine}, stato: ${overlap.stato})`
          })
        }

        // crea la richiesta
        const { data: richiesta, error } = await supabase
          .from('richieste_ferie')
          .insert({
            company_id,
            dipendente_id,
            data_inizio,
            data_fine,
            note:  note || null,
            stato: 'in_attesa'
          })
          .select()
          .single()

        if (error) {
          request.log.error(error)
          return reply.status(500).send({ error: 'SERVER_ERROR' })
        }

        // notifica al titolare: push di default, email solo se la company l'ha attivata
        try {
          const { data: emp } = await supabase
            .from('dipendenti')
            .select('nome, cognome')
            .eq('id', dipendente_id)
            .single()

          const { data: company } = await supabase
            .from('company')
            .select('nome')
            .eq('id', company_id)
            .single()

          const nomeDipendente = `${emp.nome} ${emp.cognome}`

          const ownerId = await ownerUserAccountId(company_id)
          if (ownerId) {
            sendPushToUser(ownerId, {
              title: `Nuova richiesta ferie — ${nomeDipendente}`,
              body:  `Dal ${data_inizio} al ${data_fine}`,
              url:   '/requests'
            }).catch(e => console.error('push richiesta_ferie:', e))
          }

          if (await emailCcEnabled(company_id)) {
            const { data: owner } = await supabase
              .from('user_account').select('email')
              .eq('company_id', company_id).eq('role', 'owner').maybeSingle()
            if (owner?.email) {
              await sendNotificaRichiestaFerie({
                emailOwner:      owner.email,
                nomeDipendente,
                dataInizio:      data_inizio,
                dataFine:        data_fine,
                companyNome:     company?.nome || ''
              })
            }
          }
        } catch (mailErr) {
        }

        return reply.send({ success: true, richiesta })

      } catch (err) {
        request.log.error(err)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    }
  )

  /*
    DELETE /api/dipendente/ferie/:id
    Il dipendente cancella una richiesta ferie (solo se ancora in_attesa)
  */
  fastify.delete(
    '/api/dipendente/ferie/:id',
    { preHandler: authenticateDipendente },
    async (request, reply) => {
      try {
        const { id }            = request.params
        const { dipendente_id } = request.user

        const { data: richiesta } = await supabase
          .from('richieste_ferie')
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

        await supabase.from('richieste_ferie').delete().eq('id', id)

        return reply.send({ success: true })

      } catch (err) {
        request.log.error(err)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    }
  )

  /*
    GET /api/dipendente/richieste/permessi
    Recupera le richieste permessi del dipendente
  */
  fastify.get(
    '/api/dipendente/richieste/permessi',
    { preHandler: authenticateDipendente },
    async (request, reply) => {
      try {
        const { dipendente_id } = request.user

        const { data: richieste, error } = await supabase
          .from('richieste_permessi')
          .select('*')
          .eq('dipendente_id', dipendente_id)
          .order('created_at', { ascending: false })

        if (error) {
          request.log.error(error)
          return reply.send({ success: true, richieste: [] })
        }

        return reply.send({ success: true, richieste: richieste || [] })

      } catch (err) {
        request.log.error(err)
        return reply.send({ success: true, richieste: [] })
      }
    }
  )

  /*
    GET /api/dipendente/richieste/turni
    Recupera le richieste modifica turni del dipendente
  */
  fastify.get(
    '/api/dipendente/richieste/turni',
    { preHandler: authenticateDipendente },
    async (request, reply) => {
      try {
        const { dipendente_id } = request.user

        const { data: richieste, error } = await supabase
          .from('richieste_turni')
          .select('*')
          .eq('dipendente_id', dipendente_id)
          .order('created_at', { ascending: false })

        if (error) {
          request.log.error(error)
          return reply.send({ success: true, richieste: [] })
        }

        return reply.send({ success: true, richieste: richieste || [] })

      } catch (err) {
        request.log.error(err)
        return reply.send({ success: true, richieste: [] })
      }
    }
  )

  /*
    POST /api/dipendente/richieste/permesso
    Il dipendente richiede un permesso di uscita/entrata
  */
  fastify.post(
    '/api/dipendente/richieste/permesso',
    { preHandler: authenticateDipendente },
    async (request, reply) => {
      try {
        const { dipendente_id, company_id } = request.user
        const { data_uscita, ora_uscita, data_entrata, ora_entrata, tipo, motivo } = request.body

        if (!motivo?.trim()) {
          return reply.status(400).send({ error: 'MOTIVO_REQUIRED', message: 'Il motivo è obbligatorio' })
        }

        if (!data_uscita && !data_entrata) {
          return reply.status(400).send({ error: 'DATES_REQUIRED', message: 'Almeno una data è obbligatoria' })
        }

        const { error } = await supabase.from('richieste_permessi').insert({
          company_id,
          dipendente_id,
          data_uscita: data_uscita || null,
          ora_uscita: ora_uscita || null,
          data_entrata: data_entrata || null,
          ora_entrata: ora_entrata || null,
          tipo: tipo || 'personale',
          motivo: motivo.trim(),
          stato: 'in_attesa',
          created_at: new Date().toISOString()
        })

        if (error) {
          request.log.error(error)
          return reply.status(500).send({ error: 'INSERT_FAILED' })
        }

        return reply.send({ success: true, message: 'Richiesta permesso inviata' })

      } catch (err) {
        request.log.error(err)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    }
  )

  /*
    DELETE /api/dipendente/richieste/permesso/:id
    Il dipendente cancella una richiesta permesso (solo se in_attesa)
  */
  fastify.delete(
    '/api/dipendente/richieste/permesso/:id',
    { preHandler: authenticateDipendente },
    async (request, reply) => {
      try {
        const { id }            = request.params
        const { dipendente_id } = request.user

        const { data: richiesta } = await supabase
          .from('richieste_permessi')
          .select('id, stato')
          .eq('id', id)
          .eq('dipendente_id', dipendente_id)
          .single()

        if (!richiesta) {
          return reply.status(404).send({ error: 'NOT_FOUND' })
        }

        if (richiesta.stato !== 'in_attesa') {
          return reply.status(400).send({
            error: 'CANNOT_DELETE',
            message: 'Puoi cancellare solo le richieste ancora in attesa'
          })
        }

        await supabase.from('richieste_permessi').delete().eq('id', id)

        return reply.send({ success: true })

      } catch (err) {
        request.log.error(err)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    }
  )

  /*
    POST /api/dipendente/richieste/modifica-turni
    Il dipendente richiede una modifica dei turni per un periodo specifico
  */
  fastify.post(
    '/api/dipendente/richieste/modifica-turni',
    { preHandler: authenticateDipendente },
    async (request, reply) => {
      try {
        const { dipendente_id, company_id } = request.user
        const { data_dal, data_al, giorni, orari, motivo } = request.body

        if (!motivo?.trim()) {
          return reply.status(400).send({ error: 'MOTIVO_REQUIRED', message: 'Il motivo è obbligatorio' })
        }

        if (!data_dal || !data_al) {
          return reply.status(400).send({ error: 'DATES_REQUIRED', message: 'Entrambe le date sono obbligatorie' })
        }

        if (!giorni || giorni.length === 0) {
          return reply.status(400).send({ error: 'GIORNI_REQUIRED', message: 'Seleziona almeno un giorno' })
        }

        const { error } = await supabase.from('richieste_turni').insert({
          company_id,
          dipendente_id,
          data_dal,
          data_al,
          giorni: giorni.join(','),
          orari: JSON.stringify(orari || {}),
          motivo: motivo.trim(),
          stato: 'in_attesa',
          created_at: new Date().toISOString()
        })

        if (error) {
          request.log.error(error)
          return reply.status(500).send({ error: 'INSERT_FAILED' })
        }

        return reply.send({ success: true, message: 'Richiesta modifica turni inviata' })

      } catch (err) {
        request.log.error(err)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    }
  )

  /*
    DELETE /api/dipendente/richieste/modifica-turni/:id
    Il dipendente cancella una richiesta modifica turni (solo se in_attesa)
  */
  fastify.delete(
    '/api/dipendente/richieste/modifica-turni/:id',
    { preHandler: authenticateDipendente },
    async (request, reply) => {
      try {
        const { id }            = request.params
        const { dipendente_id } = request.user

        const { data: richiesta } = await supabase
          .from('richieste_turni')
          .select('id, stato')
          .eq('id', id)
          .eq('dipendente_id', dipendente_id)
          .single()

        if (!richiesta) {
          return reply.status(404).send({ error: 'NOT_FOUND' })
        }

        if (richiesta.stato !== 'in_attesa') {
          return reply.status(400).send({
            error: 'CANNOT_DELETE',
            message: 'Puoi cancellare solo le richieste ancora in attesa'
          })
        }

        await supabase.from('richieste_turni').delete().eq('id', id)

        return reply.send({ success: true })

      } catch (err) {
        request.log.error(err)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    }
  )

  // ─── MODIFICA PROFILO DIPENDENTE ─────────────────────────────────────────────
  fastify.put(
    '/api/dipendente/profile',
    { preHandler: authenticateDipendente },
    async (request, reply) => {
      try {
        const userId       = request.user.id
        const dipendenteId = request.user.dipendente_id
        const companyId    = request.user.company_id
        const { nome, cognome, email } = request.body

        if (!nome || !nome.trim()) {
          return reply.status(400).send({ error: 'NOME_REQUIRED' })
        }

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return reply.status(400).send({ error: 'EMAIL_INVALID' })
        }

        // Carica dati attuali per confronto
        const { data: currentUser } = await supabase
          .from('user_account')
          .select('username, email')
          .eq('id', userId)
          .single()

        const { data: currentDip } = dipendenteId ? await supabase
          .from('dipendenti')
          .select('nome, cognome')
          .eq('id', dipendenteId)
          .single() : { data: null }

        // Aggiorna dipendenti
        const dipUpdate = {}
        if (nome)    dipUpdate.nome    = nome.trim()
        if (cognome !== undefined) dipUpdate.cognome = cognome?.trim() || ''
        if (email !== undefined)   dipUpdate.email   = email?.trim() || null

        if (dipendenteId && Object.keys(dipUpdate).length > 0) {
          const { error: dipErr } = await supabase
            .from('dipendenti')
            .update(dipUpdate)
            .eq('id', dipendenteId)
          if (dipErr) {
            console.error('profile update dipendenti:', dipErr.message)
            return reply.status(500).send({ error: 'SERVER_ERROR' })
          }
        }

        // Aggiorna email in user_account se fornita
        if (email !== undefined) {
          const { error: userErr } = await supabase
            .from('user_account')
            .update({ email: email?.trim() || null })
            .eq('id', userId)
          if (userErr) {
            console.error('profile update user_account:', userErr.message)
            return reply.status(500).send({ error: 'SERVER_ERROR' })
          }
        }

        // Se nome, cognome o email cambiati → rigenera username + password e reinvia credenziali
        const newCognomeDip  = cognome !== undefined ? (cognome?.trim() || '') : (currentDip?.cognome || '')
        const nomeChanged    = nome.trim()      !== (currentDip?.nome    || '')
        const cognomeChanged = newCognomeDip    !== (currentDip?.cognome || '')
        const emailChanged   = email !== undefined && (email?.trim() || null) !== (currentUser?.email || null)

        if (nomeChanged || cognomeChanged || emailChanged) {
          // Rigenera username se nome/cognome cambiati
          let newUsername = currentUser?.username
          if (nomeChanged || cognomeChanged) {
            const base = buildUsername(nome.trim(), newCognomeDip)
            newUsername = await findAvailableUsername(base)
            await supabase.from('user_account').update({ username: newUsername }).eq('id', userId)
          }

          const newPwd    = generatePassword()
          const hashedPwd = await bcrypt.hash(newPwd, 10)
          await supabase.from('user_account').update({ password: hashedPwd }).eq('id', userId)

          const emailDest = (email?.trim()) || currentUser?.email
          if (emailDest) {
            const { data: company } = await supabase
              .from('company').select('nome').eq('id', companyId).single()

            await sendCredenziali({
              email:       emailDest,
              nome:        nome.trim(),
              username:    newUsername,
              password:    newPwd,
              companyNome: company?.nome || '',
              loginUrl:    process.env.FRONTEND_URL || 'https://timbry.it'
            }).catch(e => console.error('sendCredenziali profile update:', e?.message))
          }

          return reply.send({ success: true, credenziali_reinviate: !!emailDest })
        }

        return reply.send({ success: true, credenziali_reinviate: false })

      } catch (err) {
        request.log.error(err)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    }
  )

  // ─── PROMEMORIA TIMBRATURA (self-service) ────────────────────────────────────
  fastify.put(
    '/api/dipendente/promemoria',
    { preHandler: authenticateDipendente },
    async (request, reply) => {
      try {
        const dipendenteId = request.user.dipendente_id
        const companyId    = request.user.company_id
        const { promemoria_entrata_minuti, promemoria_uscita_minuti } = request.body || {}

        const dipUpdate = {}

        if (promemoria_entrata_minuti !== undefined) {
          const v = promemoria_entrata_minuti === null ? null : parseInt(promemoria_entrata_minuti)
          if (v !== null && (isNaN(v) || v < 0 || v > 120)) {
            return reply.status(400).send({ success: false, error: 'INVALID_PROMEMORIA_ENTRATA' })
          }
          dipUpdate.promemoria_entrata_minuti = v
        }
        if (promemoria_uscita_minuti !== undefined) {
          const v = promemoria_uscita_minuti === null ? null : parseInt(promemoria_uscita_minuti)
          if (v !== null && (isNaN(v) || v < 0 || v > 120)) {
            return reply.status(400).send({ success: false, error: 'INVALID_PROMEMORIA_USCITA' })
          }
          dipUpdate.promemoria_uscita_minuti = v
        }

        if (Object.keys(dipUpdate).length === 0) {
          return reply.send({ success: true })
        }

        const { error } = await supabase
          .from('dipendenti')
          .update(dipUpdate)
          .eq('id', dipendenteId).eq('company_id', companyId)

        if (error) {
          request.log.error(error)
          return reply.status(500).send({ success: false, error: 'SERVER_ERROR' })
        }

        return reply.send({ success: true })

      } catch (err) {
        request.log.error(err)
        return reply.status(500).send({ success: false, error: 'SERVER_ERROR' })
      }
    }
  )

  // ─── ELIMINA ACCOUNT DIPENDENTE ──────────────────────────────────────────────
  fastify.delete(
    '/api/dipendente/account',
    { preHandler: authenticateDipendente },
    async (request, reply) => {
      try {
        const userId = request.user.id
        const { password } = request.body

        if (!password) {
          return reply.status(400).send({ error: 'PASSWORD_REQUIRED' })
        }

        // Recupera hash password
        const { data: user, error: userErr } = await supabase
          .from('user_account')
          .select('password, role')
          .eq('id', userId)
          .single()

        if (userErr || !user) {
          return reply.status(404).send({ error: 'USER_NOT_FOUND' })
        }

        if (user.role !== 'dipendente') {
          return reply.status(403).send({ error: 'FORBIDDEN' })
        }

        const valid = await bcrypt.compare(password, user.password)
        if (!valid) {
          return reply.status(401).send({ error: 'WRONG_PASSWORD' })
        }

        const { error: delErr } = await supabase
          .from('user_account')
          .delete()
          .eq('id', userId)

        if (delErr) {
          console.error('delete account:', delErr.message)
          return reply.status(500).send({ error: 'SERVER_ERROR' })
        }

        return reply.send({ success: true })

      } catch (err) {
        request.log.error(err)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    }
  )
}
