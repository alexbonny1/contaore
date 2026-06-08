import { supabase }              from '../services/supabase.js'
import { authenticateDipendente } from '../middleware/auth.js'
import { sendNotificaRichiestaFerie } from '../services/email.js'

// ─── helpers (stesse funzioni di employees.js) ────────────────────────────────

const GIORNI = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato']

function timeToMinutes(t) {
  if (!t) return null
  const [h, m] = t.split(':')
  return parseInt(h) * 60 + parseInt(m)
}

function calculateHours(reads = []) {
  let totalMinutes = 0
  const sorted = [...reads].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  let lastEntrata = null
  for (const r of sorted) {
    if (r.tipo === 'ENTRATA') {
      lastEntrata = r
    } else if (r.tipo === 'USCITA' && lastEntrata) {
      const diff = new Date(r.created_at) - new Date(lastEntrata.created_at)
      if (diff > 0) totalMinutes += diff / 1000 / 60
      lastEntrata = null
    }
  }
  return Number((totalMinutes / 60).toFixed(2))
}

function computeBreakDeductionMins(sortedReads, breakStartMins, breakEndMins) {
  let deductionMins   = 0
  let lastEntrataMins = null
  const now     = new Date()
  const nowMins = now.getHours() * 60 + now.getMinutes()
  for (const read of sortedReads) {
    const dt       = new Date(read.created_at)
    const readMins = dt.getHours() * 60 + dt.getMinutes()
    if (read.tipo === 'ENTRATA') {
      lastEntrataMins = readMins
    } else if (read.tipo === 'USCITA' && lastEntrataMins !== null) {
      const winStart = Math.max(lastEntrataMins, breakStartMins)
      const winEnd   = Math.min(readMins, breakEndMins)
      if (winEnd > winStart) deductionMins += winEnd - winStart
      lastEntrataMins = null
    }
  }
  if (lastEntrataMins !== null) {
    const winStart = Math.max(lastEntrataMins, breakStartMins)
    const winEnd   = Math.min(nowMins, breakEndMins)
    if (winEnd > winStart) deductionMins += winEnd - winStart
  }
  return deductionMins
}

function calculateHoursWithBreaks(reads, empShifts) {
  const sessions = buildSessions(reads)
  const byDate = {}
  sessions.forEach(sess => {
    if (!byDate[sess.date]) byDate[sess.date] = []
    byDate[sess.date].push(sess)
  })
  let totalMins = 0
  for (const [day, daySessions] of Object.entries(byDate)) {
    let dayMins     = daySessions.reduce((sum, s) => sum + s.hours, 0) * 60
    const dayName   = GIORNI[new Date(day).getDay()]
    const dayShifts = empShifts.filter(s => s.giorno_settimana === dayName)
    for (const s of dayShifts) {
      if (s.uscita_1 && s.ingresso_2) {
        const bStart = timeToMinutes(s.uscita_1)
        const bEnd   = timeToMinutes(s.ingresso_2)
        if (bEnd > bStart) {
          const sorted = daySessions
            .flatMap(sess => [sess.entrata, sess.uscita].filter(Boolean))
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
          dayMins -= computeBreakDeductionMins(sorted, bStart, bEnd)
        }
      }
    }
    totalMins += Math.max(0, dayMins)
  }
  return Number((totalMins / 60).toFixed(2))
}

function shiftDurationMins(ingresso, uscita) {
  const start = timeToMinutes(ingresso)
  const end   = timeToMinutes(uscita)
  return end > start ? end - start : (1440 - start) + end
}

function shiftExpectedHours(shift) {
  let mins = 0
  if (shift.ingresso_1 && shift.uscita_1) mins += shiftDurationMins(shift.ingresso_1, shift.uscita_1)
  if (shift.ingresso_2 && shift.uscita_2) mins += shiftDurationMins(shift.ingresso_2, shift.uscita_2)
  return Number((mins / 60).toFixed(2))
}

function getLocalDateStr(dateStr) {
  return new Date(dateStr).toISOString().split('T')[0]
}

function buildSessions(scans) {
  const sorted = [...scans].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const sessions = []
  let openEntrata = null
  for (const scan of sorted) {
    if (scan.tipo === 'ENTRATA') {
      if (openEntrata) {
        sessions.push({
          entrata: openEntrata, uscita: null,
          date: getLocalDateStr(openEntrata.created_at),
          uscita_giorno_dopo: false, hours: 0, incomplete: true
        })
      }
      openEntrata = scan
    } else if (scan.tipo === 'USCITA') {
      if (openEntrata) {
        const ms = new Date(scan.created_at) - new Date(openEntrata.created_at)
        sessions.push({
          entrata: openEntrata, uscita: scan,
          date: getLocalDateStr(openEntrata.created_at),
          uscita_giorno_dopo: getLocalDateStr(scan.created_at) !== getLocalDateStr(openEntrata.created_at),
          hours: ms > 0 ? ms / 3600000 : 0,
          incomplete: false
        })
        openEntrata = null
      } else {
        sessions.push({
          entrata: null, uscita: scan,
          date: getLocalDateStr(scan.created_at),
          uscita_giorno_dopo: false, hours: 0, incomplete: true
        })
      }
    }
  }
  if (openEntrata) {
    sessions.push({
      entrata: openEntrata, uscita: null,
      date: getLocalDateStr(openEntrata.created_at),
      uscita_giorno_dopo: false, hours: 0, incomplete: false
    })
  }
  return sessions
}

function buildCoppie(sessions) {
  return sessions.map(s => ({
    entrata:            s.entrata ? new Date(s.entrata.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : null,
    uscita:             s.uscita  ? new Date(s.uscita.created_at).toLocaleTimeString('it-IT',  { hour: '2-digit', minute: '2-digit' }) : null,
    entrata_id:         s.entrata?.id || null,
    uscita_id:          s.uscita?.id  || null,
    entrata_manuale:    s.entrata ? !!s.entrata.manuale : false,
    uscita_manuale:     s.uscita  ? !!s.uscita.manuale  : false,
    uscita_giorno_dopo: !!s.uscita_giorno_dopo,
    incomplete:         !!s.incomplete
  }))
}

// ─── controlla se una data cade in un periodo di ferie approvate ──────────────
function isInFerie(dateStr, ferie = []) {
  return ferie.some(f => dateStr >= f.data_inizio && dateStr <= f.data_fine)
}

function groupByDay(reads = [], shifts = [], turniAttivi = false, dataInizio = null, ferieApprovate = [], giustificazioni = [], pausaAziendale = null, toleranceMins = 10) {

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
      const dayName   = GIORNI[new Date(giorno).getDay()]
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

      if (ore_previste > 0) {
        const extraMins = (oreLavorate - ore_previste) * 60
        ore_straordinario = extraMins >= toleranceMins
          ? Number((extraMins / 60).toFixed(2))
          : 0
      } else {
        ore_straordinario = Number(oreLavorate.toFixed(2))
      }

      // stato hierarchy
      if (ore_straordinario > 0) {
        stato = 'straordinario'
      } else if (ore_previste > 0 && oreLavorate > 0 && oreLavorate < ore_previste) {
        stato = 'parziale'
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
          const dt           = new Date(firstEntrata.created_at)
          const actualMins   = dt.getHours() * 60 + dt.getMinutes()
          const delay        = actualMins - expectedMins
          if (delay > 5) {
            ritardo_minuti = delay
            if (stato === 'presente' || stato === 'parziale') stato = 'ritardo'
          }
        }
      }
    }

    return { giorno, coppie: buildCoppie(daySessions), ore_totali: oreLavorate, ore_previste, ore_straordinario, stato, ritardo_minuti, assente: false }
  })

  const absentDays = []
  if (turniAttivi && shifts.length > 0) {
    const now     = new Date()
    const today   = now.toISOString().split('T')[0]
    const nowMins = now.getHours() * 60 + now.getMinutes()
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
      const dayName = GIORNI[cursor.getDay()]
      const isToday = dateStr === today

      if (shiftDays.has(dayName) && !presentSet.has(dateStr)) {
        const dayShifts    = shifts.filter(s => s.giorno_settimana === dayName)
        const ore_previste = dayShifts.reduce((sum, s) => sum + shiftExpectedHours(s), 0)

        if (isToday) {
          const turnoFinito = dayShifts.some(s => {
            if (!s.uscita_1) return false
            if (s.ingresso_1 && timeToMinutes(s.uscita_1) < timeToMinutes(s.ingresso_1)) return false
            const fine = timeToMinutes(s.uscita_1)
            return fine !== null && nowMins > fine
          })
          if (!turnoFinito) { cursor.setDate(cursor.getDate() + 1); continue }
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
          .select('tolleranza_straordinario_minuti')
          .eq('id', company_id)
          .single()
        const toleranceMins = companySettings?.tolleranza_straordinario_minuti ?? 10

        const days = groupByDay(
          reads || [],
          shifts || [],
          !!employee.turni_attivi,
          employee.turni_attivati_il || employee.data_inizio,
          ferieApprovate || [],
          giustificazioni || [],
          pausaAziendale || null,
          toleranceMins
        )

        const now       = new Date()
        const today     = now.toISOString().split('T')[0]
        const nowMins   = now.getHours() * 60 + now.getMinutes()
        const todayName = GIORNI[now.getDay()]
        const thisMonth = now.toISOString().slice(0, 7)
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
            turni_attivi: employee.turni_attivi
          },
          shifts:         shifts || [],
          history_days:   days,
          giustificazioni: giustificazioni || [],
          stats: {
            ore_mese_corrente:  employee.turni_attivi
              ? calculateHoursWithBreaks(monthReads, shifts || [])
              : calculateHours(monthReads),
            giorni_assenti:     days.filter(d => d.assente).length,
            giorni_ferie:       days.filter(d => d.stato === 'ferie').length,
            ore_straordinario:  (() => {
              const totLav  = days.reduce((s, d) => s + d.ore_totali, 0)
              const totPrev = days.reduce((s, d) => s + d.ore_previste, 0)
              return Number(Math.max(0, totLav - totPrev).toFixed(2))
            })()
          }
        })

      } catch (err) {
        console.log(err)
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
          console.log(error)
          return reply.status(500).send({ error: 'SERVER_ERROR' })
        }

        return reply.send({ success: true, giustificazione: result })

      } catch (err) {
        console.log(err)
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
        console.log(err)
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
          console.log(error)
          return reply.status(500).send({ error: 'SERVER_ERROR' })
        }

        // notifica email al titolare (se ha email)
        try {
          const { data: owner } = await supabase
            .from('user_account')
            .select('email')
            .eq('company_id', company_id)
            .eq('role', 'owner')
            .maybeSingle()

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

          if (owner?.email) {
            await sendNotificaRichiestaFerie({
              emailOwner:      owner.email,
              nomeDipendente:  `${emp.nome} ${emp.cognome}`,
              dataInizio:      data_inizio,
              dataFine:        data_fine,
              companyNome:     company?.nome || ''
            })
          }
        } catch (mailErr) {
          console.log('Notifica email non inviata:', mailErr.message)
        }

        return reply.send({ success: true, richiesta })

      } catch (err) {
        console.log(err)
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
        console.log(err)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }
    }
  )
}
