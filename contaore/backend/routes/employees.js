import { supabase } from '../services/supabase.js'
import { authenticate } from '../middleware/auth.js'

const GIORNI_SETTIMANA = [
  'Domenica','Lunedì','Martedì','Mercoledì',
  'Giovedì','Venerdì','Sabato'
]

function getDayName(dateStr) {
  return GIORNI_SETTIMANA[new Date(dateStr).getDay()]
}

function timeToMinutes(t) {
  if (!t) return null
  const parts = t.split(':')
  return parseInt(parts[0]) * 60 + parseInt(parts[1])
}

// Handles cross-midnight shifts (e.g. 22:00→02:00 = 240 min, not -1200)
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

function isEmployeeInside(reads = []) {
  if (!reads.length) return false
  const sessions = buildSessions(reads)
  if (!sessions.length) return false
  const last = sessions[sessions.length - 1]
  if (last.uscita !== null) return false
  return Date.now() - new Date(last.entrata.created_at) < 18 * 3600000
}

function calculateHours(reads = []) {
  let totalMinutes = 0
  const sorted = [...reads].sort(
    (a, b) => new Date(a.created_at) - new Date(b.created_at)
  )
  let lastEntrata = null
  for (const read of sorted) {
    if (read.tipo === 'ENTRATA') {
      lastEntrata = read
    } else if (read.tipo === 'USCITA' && lastEntrata) {
      const diff = new Date(read.created_at) - new Date(lastEntrata.created_at)
      if (diff > 0) totalMinutes += diff / 1000 / 60
      lastEntrata = null
    }
  }
  return Number((totalMinutes / 60).toFixed(2))
}

// Minutes of shift-break time that the employee "covered" without explicit badge
function computeBreakDeductionMins(sortedReads, breakStartMins, breakEndMins) {
  let deductionMins  = 0
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
  // Employee still inside — deduct break time that has already elapsed
  if (lastEntrataMins !== null) {
    const winStart = Math.max(lastEntrataMins, breakStartMins)
    const winEnd   = Math.min(nowMins, breakEndMins)
    if (winEnd > winStart) deductionMins += winEnd - winStart
  }
  return deductionMins
}

// calculateHours with per-day break deduction based on shift schedule
function calculateHoursWithBreaks(reads, empShifts) {
  const sessions = buildSessions(reads)
  const byDate = {}
  sessions.forEach(sess => {
    if (!byDate[sess.date]) byDate[sess.date] = []
    byDate[sess.date].push(sess)
  })
  let totalMins = 0
  for (const [day, daySessions] of Object.entries(byDate)) {
    let dayMins    = daySessions.reduce((sum, s) => sum + s.hours, 0) * 60
    const dayName  = getDayName(day)
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
    } else if (scan.tipo === 'USCITA' && openEntrata) {
      const ms = new Date(scan.created_at) - new Date(openEntrata.created_at)
      sessions.push({
        entrata: openEntrata, uscita: scan,
        date: getLocalDateStr(openEntrata.created_at),
        uscita_giorno_dopo: getLocalDateStr(scan.created_at) !== getLocalDateStr(openEntrata.created_at),
        hours: ms > 0 ? ms / 3600000 : 0,
        incomplete: false
      })
      openEntrata = null
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

function isInFerie(dateStr, ferie = []) {
  return ferie.some(f => dateStr >= f.data_inizio && dateStr <= f.data_fine)
}

function groupByDay(reads = [], shifts = [], turniAttivi = false, dataInizio = null, ferieApprovate = [], giustificazioni = [], pausaAziendale = null) {

  const sessions = buildSessions(reads)

  const byDate = {}
  sessions.forEach(sess => {
    if (!byDate[sess.date]) byDate[sess.date] = []
    byDate[sess.date].push(sess)
  })

  const presentDays = Object.entries(byDate).map(([giorno, daySessions]) => {
    let oreLavorate   = Number(daySessions.reduce((sum, s) => sum + s.hours, 0).toFixed(2))

    let ore_previste      = 0
    let ore_straordinario = 0
    let stato             = 'presente'

    if (turniAttivi && shifts.length > 0) {
      const dayName   = getDayName(giorno)
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
        ore_straordinario = Number(Math.max(0, oreLavorate - ore_previste).toFixed(2))
      } else {
        ore_straordinario = Number(oreLavorate.toFixed(2))
      }
      if (ore_straordinario > 0) stato = 'straordinario'
    }

    return {
      giorno,
      coppie:           buildCoppie(daySessions),
      ore_totali:       oreLavorate,
      ore_previste,
      ore_straordinario,
      stato,
      assente:          false
    }
  })

  const absentDays = []

  if (turniAttivi && shifts.length > 0) {

    const now     = new Date()
    const today   = now.toISOString().split('T')[0]
    const nowMins = now.getHours() * 60 + now.getMinutes()

    const start = dataInizio ? new Date(dataInizio) : new Date()

    const endDate = new Date()
    endDate.setHours(23, 59, 59, 999)

    // Days with at least one ENTRATA (session attributed to ENTRATA date)
    const presentSet = new Set(sessions.filter(s => s.entrata).map(s => s.date))
    const shiftDays  = new Set(shifts.map(s => s.giorno_settimana))

    const cursor = new Date(start)
    cursor.setHours(0, 0, 0, 0)

    while (cursor <= endDate) {

      const dateStr = [
        cursor.getFullYear(),
        String(cursor.getMonth() + 1).padStart(2, '0'),
        String(cursor.getDate()).padStart(2, '0')
      ].join('-')
      const dayName = GIORNI_SETTIMANA[cursor.getDay()]
      const isToday = dateStr === today

      if (shiftDays.has(dayName) && !presentSet.has(dateStr)) {

        const dayShifts    = shifts.filter(s => s.giorno_settimana === dayName)
        const ore_previste = dayShifts.reduce((sum, s) => sum + shiftExpectedHours(s), 0)

        if (isToday) {
          const turnoFinito = dayShifts.some(s => {
            if (!s.uscita_1) return false
            // Cross-midnight shift ends the next calendar day — never "finished" on today's cursor
            if (s.ingresso_1 && timeToMinutes(s.uscita_1) < timeToMinutes(s.ingresso_1)) return false
            const fine = timeToMinutes(s.uscita_1)
            return fine !== null && nowMins > fine
          })
          if (!turnoFinito) {
            cursor.setDate(cursor.getDate() + 1)
            continue
          }
        }

        if (pausaAziendale && pausaAziendale.attiva && dateStr >= pausaAziendale.data_inizio && dateStr <= pausaAziendale.data_fine) {
          absentDays.push({ giorno: dateStr, coppie: [], ore_totali: 0, ore_previste, ore_straordinario: 0, stato: 'ferie', assente: false })
        } else if (isInFerie(dateStr, ferieApprovate)) {
          absentDays.push({ giorno: dateStr, coppie: [], ore_totali: 0, ore_previste, ore_straordinario: 0, stato: 'ferie', assente: false })
        } else if (giustificazioni.some(g => g.stato === 'approvata' && g.data === dateStr)) {
          absentDays.push({ giorno: dateStr, coppie: [], ore_totali: 0, ore_previste, ore_straordinario: 0, stato: 'giustificata', assente: true })
        } else {
          absentDays.push({ giorno: dateStr, coppie: [], ore_totali: 0, ore_previste, ore_straordinario: 0, stato: 'assente', assente: true })
        }

      }

      cursor.setDate(cursor.getDate() + 1)

    }

  }

  return [...presentDays, ...absentDays]
    .sort((a, b) => new Date(b.giorno) - new Date(a.giorno))

}

function groupByMonth(days = []) {

  const grouped = {}

  days.forEach(day => {

    const monthKey = new Date(day.giorno).toLocaleDateString('it-IT', {
      month: 'long', year: 'numeric'
    })

    if (!grouped[monthKey]) {
      grouped[monthKey] = {
        mese:              monthKey,
        giorni:            [],
        ore_totali:        0,
        ore_previste:      0,
        ore_straordinario: 0,
        giorni_assenti:    0
      }
    }

    grouped[monthKey].giorni.push(day)
    grouped[monthKey].ore_totali        += day.ore_totali
    grouped[monthKey].ore_previste      += day.ore_previste
    grouped[monthKey].ore_straordinario += day.ore_straordinario
    if (day.assente) grouped[monthKey].giorni_assenti++

  })

  return Object.values(grouped).map(m => ({
    ...m,
    ore_totali:        Number(m.ore_totali.toFixed(2)),
    ore_previste:      Number(m.ore_previste.toFixed(2)),
    ore_straordinario: Number(m.ore_straordinario.toFixed(2))
  }))

}

export default async function employeeRoutes(fastify) {

  fastify.get(
    '/api/employees',
    { preHandler: authenticate },
    async (request, reply) => {

      try {

        const companyId = request.user.company_id

        const { data: employees, error: employeesError } = await supabase
          .from('dipendenti')
          .select('*')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })

        if (employeesError) {
          console.log(employeesError)
          return reply.send({ success: false })
        }

        const { data: reads, error: readsError } = await supabase
          .from('presenza')
          .select('*')
          .eq('company_id', companyId)
          .order('created_at', { ascending: true })

        if (readsError) {
          console.log(readsError)
          return reply.send({ success: false })
        }

        const now       = new Date()
        const today     = now.toISOString().split('T')[0]
        const thisMonth = today.slice(0, 7)
        const nowMins   = now.getHours() * 60 + now.getMinutes()
        const todayName = GIORNI_SETTIMANA[now.getDay()]

        const { data: allShifts } = await supabase
          .from('turni')
          .select('*')
          .eq('company_id', companyId)

        const result = employees.map(emp => {

          const empReads   = reads.filter(r => r.tag_uid === emp.badge_uid)
          const todayReads = empReads.filter(r => getLocalDateStr(r.created_at) === today)
          const monthReads = empReads.filter(r => getLocalDateStr(r.created_at).slice(0, 7) === thisMonth)

          const presente = isEmployeeInside(empReads)

          const empShifts = (allShifts || []).filter(s => s.dipendente_id === emp.id)
          const todayShifts = empShifts.filter(s => s.giorno_settimana === todayName)

          // Employee is in their scheduled break window right now
          let inPausa = false
          if (presente && emp.turni_attivi) {
            inPausa = todayShifts.some(s => {
              if (!s.uscita_1 || !s.ingresso_2) return false
              const pausaStart = timeToMinutes(s.uscita_1)
              const pausaEnd   = timeToMinutes(s.ingresso_2)
              return nowMins >= pausaStart && nowMins < pausaEnd
            })
          }

          let assente = false

          if (emp.turni_attivi && !presente) {

            if (todayShifts.length > 0) {

              assente = todayShifts.some(s => {
                if (!s.ingresso_1 || !s.uscita_1) return false
                const inizio = timeToMinutes(s.ingresso_1)
                const fine   = timeToMinutes(s.uscita_1)
                return nowMins >= inizio && nowMins <= fine
              })

            }

          }

          return {
            ...emp,
            attivo:   presente && !inPausa,
            in_pausa: inPausa,
            assente,
            stats: {
              total_reads: empReads.length,
              today_reads: todayReads.length,
              month_reads: monthReads.length,
              total_hours: emp.turni_attivi
                ? calculateHoursWithBreaks(monthReads, empShifts)
                : calculateHours(monthReads),
              last_read: empReads.length
                ? empReads[empReads.length - 1].created_at
                : null
            }
          }

        })

        return reply.send({ success: true, employees: result })

      } catch (err) {

        console.log(err)
        return reply.send({ success: false })

      }

    }
  )

  fastify.get(
    '/api/employees/:id',
    { preHandler: authenticate },
    async (request, reply) => {

      try {

        const { id }    = request.params
        const companyId = request.user.company_id

        const { data: employee, error: employeeError } = await supabase
          .from('dipendenti')
          .select('*')
          .eq('id', id)
          .eq('company_id', companyId)
          .single()

        if (employeeError || !employee) {
          console.log(employeeError)
          return reply.send({ success: false })
        }

        const { data: reads, error: readsError } = await supabase
          .from('presenza')
          .select('*')
          .eq('tag_uid', employee.badge_uid)
          .eq('company_id', companyId)
          .order('created_at', { ascending: true })

        if (readsError) {
          console.log(readsError)
          return reply.send({ success: false })
        }

        const { data: shifts, error: shiftsError } = await supabase
          .from('turni')
          .select('*')
          .eq('dipendente_id', id)
          .order('created_at', { ascending: false })

        if (shiftsError) {
          console.log(shiftsError)
          return reply.send({ success: false })
        }

        const turniAttivi = !!employee.turni_attivi

        // ferie approvate
        const { data: ferieApprovate } = await supabase
          .from('richieste_ferie')
          .select('data_inizio, data_fine')
          .eq('dipendente_id', id)
          .eq('stato', 'approvata')

        // giustificazioni
        const { data: giustificazioni } = await supabase
          .from('giustificazioni')
          .select('data, stato')
          .eq('dipendente_id', id)

        // pausa aziendale attiva
        const { data: pausaAziendale } = await supabase
          .from('pausa_aziendale')
          .select('*')
          .eq('company_id', companyId)
          .eq('attiva', true)
          .maybeSingle()

        const days   = groupByDay(
          reads,
          shifts || [],
          turniAttivi,
          employee.turni_attivati_il || employee.data_inizio,
          ferieApprovate || [],
          giustificazioni || [],
          pausaAziendale || null
        )

        const months = groupByMonth(days)

        return reply.send({
          success: true,
          employee: {
            ...employee,
            attivo:         isEmployeeInside(reads),
            shifts:         shifts || [],
            reads,
            history_days:   days,
            history_months: months,
            stats: {
              total_hours:       calculateHours(reads.filter(r => getLocalDateStr(r.created_at).slice(0, 7) === new Date().toISOString().slice(0, 7))),  // ore mese corrente
              total_reads:       reads.length,
              ore_straordinario: days.reduce((s, d) => s + d.ore_straordinario, 0).toFixed(2),
              giorni_assenti:    days.filter(d => d.assente).length
            }
          }
        })

      } catch (err) {

        console.log(err)
        return reply.send({ success: false })

      }

    }
  )

  fastify.post(
    '/api/employees/:id/shift',
    { preHandler: authenticate },
    async (request, reply) => {

      try {

        const { id }    = request.params
        const companyId = request.user.company_id

        const {
          turno_nome, giorno_settimana,
          ingresso_1, uscita_1, ingresso_2, uscita_2
        } = request.body

        const { data, error } = await supabase
          .from('turni')
          .insert({
            company_id:       companyId,
            dipendente_id:    id,
            turno_nome:       turno_nome || null,
            giorno_settimana,
            ingresso_1:       ingresso_1 || null,
            uscita_1:         uscita_1   || null,
            ingresso_2:       ingresso_2 || null,
            uscita_2:         uscita_2   || null
          })
          .select()
          .single()

        if (error) {
          console.log(error)
          return reply.send({ success: false, error })
        }

        return reply.send({ success: true, shift: data })

      } catch (err) {

        console.log(err)
        return reply.send({ success: false })

      }

    }
  )

  fastify.put(
    '/api/shifts/:id',
    { preHandler: authenticate },
    async (request, reply) => {

      try {

        const { id } = request.params

        const {
          turno_nome, giorno_settimana,
          ingresso_1, uscita_1, ingresso_2, uscita_2
        } = request.body

        const { data, error } = await supabase
          .from('turni')
          .update({
            turno_nome, giorno_settimana,
            ingresso_1, uscita_1, ingresso_2, uscita_2
          })
          .eq('id', id)
          .select()
          .single()

        if (error) {
          console.log(error)
          return reply.send({ success: false })
        }

        return reply.send({ success: true, shift: data })

      } catch (err) {

        console.log(err)
        return reply.send({ success: false })

      }

    }
  )

  fastify.delete(
    '/api/shifts/:id',
    { preHandler: authenticate },
    async (request, reply) => {

      try {

        const { id } = request.params

        const { error } = await supabase
          .from('turni')
          .delete()
          .eq('id', id)

        if (error) {
          console.log(error)
          return reply.send({ success: false })
        }

        return reply.send({ success: true })

      } catch (err) {

        console.log(err)
        return reply.send({ success: false })

      }

    }
  )

  fastify.post(
    '/api/employees/:id/toggle-turni',
    { preHandler: authenticate },
    async (request, reply) => {

      try {

        const { id }           = request.params
        const { turni_attivi } = request.body
        const companyId        = request.user.company_id

        const updateData = { turni_attivi }

        if (turni_attivi) {
          updateData.turni_attivati_il = new Date().toISOString()
        }

        const { data, error } = await supabase
          .from('dipendenti')
          .update(updateData)
          .eq('id', id)
          .eq('company_id', companyId)
          .select()
          .single()

        if (error) {
          console.log(error)
          return reply.send({ success: false })
        }

        return reply.send({ success: true, employee: data })

      } catch (err) {

        console.log(err)
        return reply.send({ success: false })

      }

    }
  )

  fastify.put(
    '/api/employees/:id/change-badge',
    { preHandler: authenticate },
    async (request, reply) => {

      try {

        const { id }      = request.params
        const { new_uid } = request.body
        const companyId   = request.user.company_id

        if (!new_uid) {
          return reply.status(400).send({ success: false, error: 'MISSING_UID' })
        }

        const { data: existing } = await supabase
          .from('dipendenti')
          .select('id')
          .eq('badge_uid', new_uid)
          .neq('id', id)
          .maybeSingle()

        if (existing) {
          return reply.status(400).send({ success: false, error: 'UID_ALREADY_USED' })
        }

        const { data, error } = await supabase
          .from('dipendenti')
          .update({ badge_uid: new_uid })
          .eq('id', id)
          .eq('company_id', companyId)
          .select()
          .single()

        if (error) {
          console.log(error)
          return reply.send({ success: false, error: error.message })
        }

        await supabase
          .from('tag')
          .upsert({
            uid:           new_uid,
            dipendente_id: id,
            company_id:    companyId,
            stato:         'attivo'
          }, { onConflict: 'uid' })

        return reply.send({ success: true, employee: data })

      } catch (err) {

        console.log(err)
        return reply.send({ success: false })

      }

    }
  )

  fastify.post(
    '/api/employees/:id/delete-month',
    { preHandler: authenticate },
    async (request, reply) => {

      try {

        const { id }    = request.params
        const { month } = request.body
        const companyId = request.user.company_id

        const { data: employee } = await supabase
          .from('dipendenti')
          .select('badge_uid')
          .eq('id', id)
          .single()

        if (!employee) {
          return reply.send({ success: false, error: 'NOT_FOUND' })
        }

        const { data: reads } = await supabase
          .from('presenza')
          .select('id, created_at')
          .eq('tag_uid', employee.badge_uid)
          .eq('company_id', companyId)

        const idsToDelete = (reads || [])
          .filter(r => {
            const monthName = new Date(r.created_at).toLocaleDateString('it-IT', {
              month: 'long', year: 'numeric'
            })
            return monthName === month
          })
          .map(r => r.id)

        if (idsToDelete.length) {
          await supabase
            .from('presenza')
            .delete()
            .in('id', idsToDelete)
        }

        return reply.send({ success: true })

      } catch (err) {

        console.log(err)
        return reply.send({ success: false })

      }

    }
  )


  // ─── ADD MANUAL PRESENCE ────────────────────────────────────────────────────
  fastify.post(
    '/api/employees/:id/presence',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const { id }            = request.params
        const companyId         = request.user.company_id
        const { tipo, datetime } = request.body

        if (!tipo || !datetime || !['ENTRATA', 'USCITA'].includes(tipo)) {
          return reply.send({ success: false, error: 'INVALID_PARAMS' })
        }

        const { data: company } = await supabase
          .from('company')
          .select('portale_dipendenti')
          .eq('id', companyId)
          .single()

        if (company?.portale_dipendenti) {
          return reply.send({ success: false, error: 'PORTAL_ACTIVE' })
        }

        const { data: employee } = await supabase
          .from('dipendenti')
          .select('badge_uid')
          .eq('id', id)
          .eq('company_id', companyId)
          .single()

        if (!employee) {
          return reply.send({ success: false, error: 'NOT_FOUND' })
        }

        const ts = new Date(datetime).toISOString()

        const { data, error } = await supabase
          .from('presenza')
          .insert({
            company_id: companyId,
            tag_uid:    employee.badge_uid,
            tipo,
            manuale:    true,
            created_at: ts,
            timestamp:  ts
          })
          .select()
          .single()

        if (error) {
          console.log(error)
          return reply.send({ success: false, error: error.message })
        }

        return reply.send({ success: true, presenza: data })
      } catch (err) {
        console.log(err)
        return reply.send({ success: false })
      }
    }
  )

  // ─── DELETE SINGLE PRESENCE ──────────────────────────────────────────────────
  fastify.delete(
    '/api/presenze/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const { id }    = request.params
        const companyId = request.user.company_id

        const { data: company } = await supabase
          .from('company')
          .select('portale_dipendenti')
          .eq('id', companyId)
          .single()

        if (company?.portale_dipendenti) {
          return reply.send({ success: false, error: 'PORTAL_ACTIVE' })
        }

        const { data: presenza } = await supabase
          .from('presenza')
          .select('id')
          .eq('id', id)
          .eq('company_id', companyId)
          .single()

        if (!presenza) {
          return reply.send({ success: false, error: 'NOT_FOUND' })
        }

        const { error } = await supabase
          .from('presenza')
          .delete()
          .eq('id', id)

        if (error) {
          console.log(error)
          return reply.send({ success: false })
        }

        return reply.send({ success: true })
      } catch (err) {
        console.log(err)
        return reply.send({ success: false })
      }
    }
  )

  fastify.get(
    '/api/company/info',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const company_id = request.user.company_id

        const { data, error } = await supabase
          .from('company')
          .select('id, nome, slug, portale_dipendenti')
          .eq('id', company_id)
          .single()

        if (error || !data) {
          return reply.status(404).send({ success: false, error: 'NOT_FOUND' })
        }

        return reply.send({ success: true, ...data })

      } catch (err) {
        console.log(err)
        return reply.status(500).send({ success: false, error: 'SERVER_ERROR' })
      }
    }
  )
}