import bcrypt from 'bcrypt'
import { supabase } from '../services/supabase.js'
import { authenticate, authenticateWithInactivity, requirePermission, requireAnyPermission } from '../middleware/auth.js'

const ANY_PERM = ['can_view_presenze', 'can_edit_presenze', 'can_approve_requests', 'can_manage_employees']
import { sendCredenziali } from '../services/email.js'
import { generatePassword, buildUsername, findAvailableUsername } from '../utils/userHelpers.js'
import { getAllowedDipendenteIds, isDipendenteAllowed } from '../utils/adminAccess.js'
import {
  GIORNI, timeToMinutes, shiftDurationMins, shiftExpectedHours,
  getLocalDateStr, getLocalTimeMinutes, getLocalDayOfWeek, getDayName,
  buildSessions, buildCoppie, computeBreakDeductionMins, isInFerie
} from '../utils/timeHelpers.js'

function isEmployeeInside(reads = []) {
  if (!reads.length) return false
  const sessions = buildSessions(reads)
  if (!sessions.length) return false
  const last = sessions[sessions.length - 1]
  if (last.uscita !== null) return false
  return Date.now() - new Date(last.entrata.created_at) < 18 * 3600000
}

// Somma le ore effettive (stessa logica/tolleranza/arrotondamento di groupByDay,
// tramite computeDayHoursStats) su un set di presenze già filtrato per periodo.
// Usata dalla lista dipendenti per restare coerente con il dettaglio dipendente.
function calculateEffectiveHours(reads, empShifts, turniAttivi, toleranceMins, toleranceDeficitMins) {
  const sessions = buildSessions(reads)
  const byDate = {}
  sessions.forEach(sess => {
    if (!byDate[sess.date]) byDate[sess.date] = []
    byDate[sess.date].push(sess)
  })
  const hasShiftsConfigured = turniAttivi && empShifts.length > 0
  let totalHours = 0
  for (const [day, daySessions] of Object.entries(byDate)) {
    const dayShifts = hasShiftsConfigured ? empShifts.filter(s => s.giorno_settimana === getDayName(day)) : []
    const { ore_effettive } = computeDayHoursStats(daySessions, dayShifts, hasShiftsConfigured, toleranceMins, toleranceDeficitMins)
    totalHours += ore_effettive
  }
  return Number(totalHours.toFixed(2))
}

async function autoInsertBreakTimbrature(supabase, dipendenteId, companyId, tagUid, todayReads, shift, dateStr) {
  if (!shift?.uscita_1 || !shift?.ingresso_2) return
  const sorted = [...todayReads].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  const tipos  = sorted.map(r => r.tipo)
  const inserts = []
  const u1Time  = shift.uscita_1.slice(0, 5)
  const i2Time  = shift.ingresso_2.slice(0, 5)

  const toTs = (time) => new Date(`${dateStr}T${time}:00`).toISOString()

  if (tipos.length === 2 && tipos[0] === 'ENTRATA' && tipos[1] === 'USCITA') {
    inserts.push({ tipo: 'USCITA',  created_at: toTs(u1Time) })
    inserts.push({ tipo: 'ENTRATA', created_at: toTs(i2Time) })
  } else if (tipos.length === 3 && tipos[0] === 'ENTRATA' && tipos[1] === 'USCITA' && tipos[2] === 'USCITA') {
    inserts.push({ tipo: 'ENTRATA', created_at: toTs(i2Time) })
  } else if (tipos.length === 3 && tipos[0] === 'ENTRATA' && tipos[1] === 'ENTRATA' && tipos[2] === 'USCITA') {
    inserts.push({ tipo: 'USCITA',  created_at: toTs(u1Time) })
  }

  if (inserts.length > 0) {
    await supabase.from('presenza').insert(
      inserts.map(ins => ({
        company_id: companyId,
        tag_uid:    tagUid,
        reader_id:  null,
        manuale:    false,
        automatica: true,
        timestamp:  ins.created_at,
        ...ins
      }))
    )
  }
}

// Ore lavorate/previste/straordinario/effettive per un singolo giorno, con
// tolleranza configurabile. Condivisa tra groupByDay (dettaglio dipendente,
// stipendio) e la lista dipendenti: le due viste devono concordare sulle
// "ore totali" di un giorno/mese, altrimenti mostrano numeri diversi per
// gli stessi dati (es. lista con somma grezza vs dettaglio con tolleranza).
function computeDayHoursStats(daySessions, dayShifts, hasShiftsConfigured, toleranceMins, toleranceDeficitMins) {
  let oreLavorate = Number(daySessions.reduce((sum, s) => sum + s.hours, 0).toFixed(2))
  let ore_previste = 0
  let ore_straordinario = 0
  let ore_effettive = oreLavorate

  if (hasShiftsConfigured) {
    ore_previste = dayShifts.reduce((sum, s) => sum + shiftExpectedHours(s), 0)

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

    ore_effettive = oreLavorate
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
  }

  return { ore_totali: oreLavorate, ore_previste, ore_straordinario, ore_effettive }
}

function groupByDay(reads = [], shifts = [], turniAttivi = false, dataInizio = null, ferieApprovate = [], giustificazioni = [], pausaAziendale = null, toleranceMins = 10, toleranceDeficitMins = 15) {

  const sessions = buildSessions(reads)

  const byDate = {}
  sessions.forEach(sess => {
    if (!byDate[sess.date]) byDate[sess.date] = []
    byDate[sess.date].push(sess)
  })

  const hasShiftsConfigured = turniAttivi && shifts.length > 0

  const presentDays = Object.entries(byDate).map(([giorno, daySessions]) => {
    const dayShifts = hasShiftsConfigured ? shifts.filter(s => s.giorno_settimana === getDayName(giorno)) : []
    const { ore_totali: oreLavorate, ore_previste, ore_straordinario, ore_effettive } =
      computeDayHoursStats(daySessions, dayShifts, hasShiftsConfigured, toleranceMins, toleranceDeficitMins)

    let stato          = 'presente'
    let ritardo_minuti = 0

    if (hasShiftsConfigured) {
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
    if (giustificazioni.some(g => g.stato === 'approvata' && g.data === giorno)) stato = 'giustificata'

    return {
      giorno,
      coppie:           buildCoppie(daySessions),
      ore_totali:       oreLavorate,
      ore_effettive:    ore_effettive ?? oreLavorate,
      ore_previste,
      ore_straordinario,
      stato,
      ritardo_minuti,
      assente:          false
    }
  })

  const absentDays = []

  if (turniAttivi && shifts.length > 0) {

    const now     = new Date()
    const today   = getLocalDateStr(now.toISOString())
    const nowMins = getLocalTimeMinutes(now.toISOString())

    const start = dataInizio ? new Date(dataInizio) : new Date()

    const endDate = new Date()
    endDate.setHours(23, 59, 59, 999)

    // Days with at least one scan (ENTRATA or lone USCITA)
    const presentSet = new Set(sessions.filter(s => s.entrata || s.uscita).map(s => s.date))
    const shiftDays  = new Set(shifts.map(s => s.giorno_settimana))

    const cursor = new Date(start)
    cursor.setHours(0, 0, 0, 0)

    while (cursor <= endDate) {

      const dateStr = getLocalDateStr(cursor.toISOString())
      const dayName = getDayName(dateStr)
      const isToday = dateStr === today

      if (shiftDays.has(dayName) && !presentSet.has(dateStr)) {

        const dayShifts    = shifts.filter(s => s.giorno_settimana === dayName)
        const ore_previste = dayShifts.reduce((sum, s) => sum + shiftExpectedHours(s), 0)

        if (isToday) {
          // mostra assente oggi solo se l'orario di ingresso è già passato
          const turnoIniziato = dayShifts.some(s => {
            if (!s.ingresso_1) return false
            return nowMins > timeToMinutes(s.ingresso_1)
          })
          if (!turnoIniziato) {
            cursor.setDate(cursor.getDate() + 1)
            continue
          }
        }

        if (pausaAziendale && pausaAziendale.attiva && dateStr >= pausaAziendale.data_inizio && dateStr <= pausaAziendale.data_fine) {
          absentDays.push({ giorno: dateStr, coppie: [], ore_totali: 0, ore_previste: 0, ore_straordinario: 0, stato: 'ferie', assente: false })
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
    grouped[monthKey].ore_totali  += day.ore_effettive ?? day.ore_totali
    grouped[monthKey].ore_previste += day.ore_previste
    if (day.assente) grouped[monthKey].giorni_assenti++

  })

  return Object.values(grouped).map(m => ({
    ...m,
    ore_totali:        Number(m.ore_totali.toFixed(2)),
    ore_previste:      Number(m.ore_previste.toFixed(2)),
    ore_straordinario: Number(Math.max(0, m.ore_totali - m.ore_previste).toFixed(2))
  }))

}

export default async function employeeRoutes(fastify) {

  fastify.get(
    '/api/employees',
    { preHandler: [authenticateWithInactivity, requireAnyPermission(ANY_PERM)] },
    async (request, reply) => {

      try {

        const companyId = request.user.company_id

        const { data: employeesRaw, error: employeesError } = await supabase
          .from('dipendenti')
          .select('*')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })
          .order('id', { ascending: true })

        if (employeesError) {
          return reply.send({ success: false, error: 'DB_DIPENDENTI', detail: employeesError.message })
        }

        const allowedIds = await getAllowedDipendenteIds(request.user)
        const employees  = allowedIds ? (employeesRaw || []).filter(e => allowedIds.includes(e.id)) : (employeesRaw || [])

        // Solo oggi/questo mese servono qui: limitiamo la query a un paio di mesi di
        // margine. Il filtro data da solo non basta a evitare il troncamento: con
        // abbastanza dipendenti/presenze anche una finestra di 2 mesi supera le 1000
        // righe (il limite di default di PostgREST), quindi paginiamo esplicitamente
        // con .range() finché non abbiamo letto tutte le righe della finestra.
        const readsWindowStart = new Date()
        readsWindowStart.setUTCMonth(readsWindowStart.getUTCMonth() - 1, 1)
        readsWindowStart.setUTCHours(0, 0, 0, 0)

        let readsRaw    = []
        let readsError  = null
        {
          const pageSize = 1000
          let from = 0
          while (true) {
            const { data, error } = await supabase
              .from('presenza')
              .select('*')
              .eq('company_id', companyId)
              .gte('created_at', readsWindowStart.toISOString())
              .order('created_at', { ascending: true })
              .range(from, from + pageSize - 1)
            if (error) { readsError = error; break }
            readsRaw = readsRaw.concat(data || [])
            if (!data || data.length < pageSize) break
            from += pageSize
          }
        }

        if (readsError) {
        }
        const reads = readsRaw || []

        const now       = new Date()
        const today     = getLocalDateStr(now.toISOString())
        const thisMonth = today.slice(0, 7)
        const nowMins   = getLocalTimeMinutes(now.toISOString())
        const todayName = GIORNI[getLocalDayOfWeek(now.toISOString())]

        const { data: allShifts } = await supabase
          .from('turni')
          .select('*')
          .eq('company_id', companyId)

        // tolleranza straordinari/difetto configurabile per azienda (una sola query,
        // non per dipendente): stessa logica del dettaglio dipendente per restare coerenti
        const { data: companySettings } = await supabase
          .from('company')
          .select('tolleranza_straordinario_minuti, tolleranza_difetto_minuti')
          .eq('id', companyId)
          .single()
        const toleranceMins        = companySettings?.tolleranza_straordinario_minuti ?? 10
        const toleranceDeficitMins = companySettings?.tolleranza_difetto_minuti ?? 15

        const result = employees.map(emp => {
          try {
            const empReads   = reads.filter(r => r.tag_uid === emp.badge_uid)
            const todayReads = empReads.filter(r => getLocalDateStr(r.created_at) === today)
            const monthReads = empReads.filter(r => getLocalDateStr(r.created_at).slice(0, 7) === thisMonth)

            const presente = isEmployeeInside(empReads)

            const empShifts = (allShifts || []).filter(s => s.dipendente_id === emp.id)
            const todayShifts = empShifts.filter(s => s.giorno_settimana === todayName)

            // Employee is in pausa: either inside during break window, OR clocked out near uscita_1 and still before ingresso_2
            let inPausa = false
            if (emp.turni_attivi) {
              const doubleShifts = todayShifts.filter(s => s.uscita_1 && s.ingresso_2)
              if (presente) {
                inPausa = doubleShifts.some(s => {
                  const pausaStart = timeToMinutes(s.uscita_1)
                  const pausaEnd   = timeToMinutes(s.ingresso_2)
                  return nowMins >= pausaStart && nowMins < pausaEnd
                })
              } else if (doubleShifts.length > 0) {
                const todaySorted = todayReads.slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                const lastTodayRead = todaySorted[todaySorted.length - 1]
                if (lastTodayRead?.tipo === 'USCITA') {
                  const lastMins = getLocalTimeMinutes(lastTodayRead.created_at)
                  inPausa = doubleShifts.some(s => {
                    const u1 = timeToMinutes(s.uscita_1)
                    const i2 = timeToMinutes(s.ingresso_2)
                    return Math.abs(lastMins - u1) <= 30 && nowMins < i2
                  })
                }
              }
            }

            // assente solo se non ha timbrato affatto oggi e siamo dentro la finestra del turno
            let assente = false
            if (emp.turni_attivi && !inPausa && todayReads.length === 0 && todayShifts.length > 0) {
              assente = todayShifts.some(s => {
                if (!s.ingresso_1) return false
                const inizio = timeToMinutes(s.ingresso_1)
                const fine   = timeToMinutes(s.uscita_2 || s.uscita_1)
                return nowMins >= inizio && (!fine || nowMins <= fine)
              })
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
                total_hours: calculateEffectiveHours(monthReads, empShifts, emp.turni_attivi, toleranceMins, toleranceDeficitMins),
                last_read: empReads.length
                  ? empReads[empReads.length - 1].created_at
                  : null
              }
            }
          } catch (mapErr) {
            return { ...emp, attivo: false, in_pausa: false, assente: false, stats: { total_reads: 0, today_reads: 0, month_reads: 0, total_hours: 0, last_read: null } }
          }
        })

        return reply.send({ success: true, employees: result })

      } catch (err) {

        return reply.send({ success: false, error: 'UNHANDLED', detail: err?.message })

      }

    }
  )

  fastify.get(
    '/api/employees/:id',
    { preHandler: [authenticate, requireAnyPermission(ANY_PERM)] },
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
          request.log.error(employeeError)
          return reply.send({ success: false })
        }

        const allowedIds = await getAllowedDipendenteIds(request.user)
        if (!isDipendenteAllowed(allowedIds, employee.id)) {
          return reply.status(403).send({ success: false, error: 'FORBIDDEN' })
        }

        const { data: reads, error: readsError } = await supabase
          .from('presenza')
          .select('*')
          .eq('tag_uid', employee.badge_uid)
          .eq('company_id', companyId)
          .order('created_at', { ascending: true })

        if (readsError) {
          request.log.error(readsError)
          return reply.send({ success: false })
        }

        const { data: shifts, error: shiftsError } = await supabase
          .from('turni')
          .select('*')
          .eq('dipendente_id', id)
          .order('created_at', { ascending: false })

        if (shiftsError) {
          request.log.error(shiftsError)
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

        // tolleranza straordinari configurabile per azienda
        const { data: companySettings } = await supabase
          .from('company')
          .select('tolleranza_straordinario_minuti, arrotonda_ore_al_turno, tolleranza_difetto_minuti')
          .eq('id', companyId)
          .single()
        const toleranceMins        = companySettings?.tolleranza_straordinario_minuti ?? 10
        const toleranceDeficitMins = companySettings?.tolleranza_difetto_minuti ?? 15

        const days   = groupByDay(
          reads,
          shifts || [],
          turniAttivi,
          employee.turni_attivati_il || employee.data_inizio,
          ferieApprovate || [],
          giustificazioni || [],
          pausaAziendale || null,
          toleranceMins,
          toleranceDeficitMins
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
              total_hours:       (() => {
                const currentMonth = getLocalDateStr(new Date().toISOString()).slice(0, 7)
                return Number(days.filter(d => d.giorno.slice(0, 7) === currentMonth).reduce((s, d) => s + (d.ore_effettive ?? d.ore_totali), 0).toFixed(2))
              })(),
              total_reads:       reads.length,
              ore_straordinario: (() => {
                const currentMonth = getLocalDateStr(new Date().toISOString()).slice(0, 7)
                const monthDays = days.filter(d => d.giorno.slice(0, 7) === currentMonth)
                const totLav  = monthDays.reduce((s, d) => s + (d.ore_effettive ?? d.ore_totali), 0)
                const totPrev = monthDays.reduce((s, d) => s + d.ore_previste, 0)
                return (Math.max(0, totLav - totPrev)).toFixed(2)
              })(),
              giorni_assenti:    days.filter(d => d.assente).length
            }
          }
        })

      } catch (err) {

        request.log.error(err)
        return reply.send({ success: false })

      }

    }
  )

  fastify.post(
    '/api/employees/:id/shift',
    { preHandler: [authenticate, requirePermission('can_manage_employees')] },
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
          request.log.error(error)
          return reply.send({ success: false, error })
        }

        return reply.send({ success: true, shift: data })

      } catch (err) {

        request.log.error(err)
        return reply.send({ success: false })

      }

    }
  )

  fastify.put(
    '/api/shifts/:id',
    { preHandler: [authenticate, requirePermission('can_manage_employees')] },
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
          request.log.error(error)
          return reply.send({ success: false })
        }

        return reply.send({ success: true, shift: data })

      } catch (err) {

        request.log.error(err)
        return reply.send({ success: false })

      }

    }
  )

  fastify.delete(
    '/api/shifts/:id',
    { preHandler: [authenticate, requirePermission('can_manage_employees')] },
    async (request, reply) => {

      try {

        const { id } = request.params

        const { error } = await supabase
          .from('turni')
          .delete()
          .eq('id', id)

        if (error) {
          request.log.error(error)
          return reply.send({ success: false })
        }

        return reply.send({ success: true })

      } catch (err) {

        request.log.error(err)
        return reply.send({ success: false })

      }

    }
  )

  fastify.post(
    '/api/employees/:id/toggle-turni',
    { preHandler: [authenticate, requirePermission('can_manage_employees')] },
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
          request.log.error(error)
          return reply.send({ success: false })
        }

        return reply.send({ success: true, employee: data })

      } catch (err) {

        request.log.error(err)
        return reply.send({ success: false })

      }

    }
  )

  fastify.put(
    '/api/employees/:id/change-badge',
    { preHandler: [authenticate, requirePermission('can_manage_employees')] },
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
          request.log.error(error)
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

        request.log.error(err)
        return reply.send({ success: false })

      }

    }
  )

  fastify.post(
    '/api/employees/:id/delete-month',
    { preHandler: [authenticate, requirePermission('can_manage_employees')] },
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

        request.log.error(err)
        return reply.send({ success: false })

      }

    }
  )


  // ─── ADD MANUAL PRESENCE ────────────────────────────────────────────────────
  fastify.post(
    '/api/employees/:id/presence',
    { preHandler: [authenticate, requirePermission('can_edit_presenze')] },
    async (request, reply) => {
      try {
        const { id }            = request.params
        const companyId         = request.user.company_id
        const { tipo, datetime } = request.body

        if (!tipo || !datetime || !['ENTRATA', 'USCITA'].includes(tipo)) {
          return reply.send({ success: false, error: 'INVALID_PARAMS' })
        }

        const [{ data: company }, { data: employee }] = await Promise.all([
          supabase.from('company').select('portale_dipendenti').eq('id', companyId).single(),
          supabase.from('dipendenti').select('badge_uid, email').eq('id', id).eq('company_id', companyId).single()
        ])

        if (!employee) {
          return reply.send({ success: false, error: 'NOT_FOUND' })
        }

        // Block only if portal is active AND the employee has a login (email)
        if (company?.portale_dipendenti && employee.email) {
          return reply.send({ success: false, error: 'PORTAL_ACTIVE' })
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
          request.log.error(error)
          return reply.send({ success: false, error: error.message })
        }

        // Auto-insert missing break timbrature when a final USCITA is saved
        if (tipo === 'USCITA') {
          try {
            const { data: empFull } = await supabase.from('dipendenti').select('id, turni_attivi').eq('id', id).single()
            if (empFull?.turni_attivi) {
              const dateStr  = getLocalDateStr(ts)
              const newMins  = getLocalTimeMinutes(ts)
              const dayName  = getDayName(dateStr)
              const { data: shifts } = await supabase.from('turni').select('*').eq('dipendente_id', id)
              const dayShift = (shifts || []).find(s => s.giorno_settimana === dayName && s.uscita_1 && s.ingresso_2)
              if (dayShift && newMins >= timeToMinutes(dayShift.ingresso_2)) {
                const { data: todayReads } = await supabase.from('presenza')
                  .select('tipo, created_at')
                  .eq('tag_uid', employee.badge_uid)
                  .eq('company_id', companyId)
                  .gte('created_at', `${dateStr}T00:00:00`)
                  .lte('created_at', `${dateStr}T23:59:59`)
                  .order('created_at', { ascending: true })
                await autoInsertBreakTimbrature(supabase, id, companyId, employee.badge_uid, todayReads || [], dayShift, dateStr)
              }
            }
          } catch (_) {}
        }

        return reply.send({ success: true, presenza: data })
      } catch (err) {
        request.log.error(err)
        return reply.send({ success: false })
      }
    }
  )

  // ─── DELETE SINGLE PRESENCE ──────────────────────────────────────────────────
  fastify.delete(
    '/api/presenze/:id',
    { preHandler: [authenticate, requirePermission('can_edit_presenze')] },
    async (request, reply) => {
      try {
        const { id }    = request.params
        const companyId = request.user.company_id

        const { data: company } = await supabase
          .from('company')
          .select('portale_dipendenti')
          .eq('id', companyId)
          .single()

        const { data: presenza } = await supabase
          .from('presenza')
          .select('id, tag_uid')
          .eq('id', id)
          .eq('company_id', companyId)
          .single()

        if (!presenza) {
          return reply.send({ success: false, error: 'NOT_FOUND' })
        }

        if (company?.portale_dipendenti) {
          const { data: emp } = await supabase
            .from('dipendenti')
            .select('email')
            .eq('badge_uid', presenza.tag_uid)
            .eq('company_id', companyId)
            .maybeSingle()
          if (emp?.email) {
            return reply.send({ success: false, error: 'PORTAL_ACTIVE' })
          }
        }

        const { error } = await supabase
          .from('presenza')
          .delete()
          .eq('id', id)

        if (error) {
          request.log.error(error)
          return reply.send({ success: false })
        }

        return reply.send({ success: true })
      } catch (err) {
        request.log.error(err)
        return reply.send({ success: false })
      }
    }
  )

  // ─── EDIT SINGLE PRESENCE (direct, owner only, no-email employees) ──────────
  fastify.put(
    '/api/presenze/:id',
    { preHandler: [authenticate, requirePermission('can_edit_presenze')] },
    async (request, reply) => {
      try {
        const { id }    = request.params
        const companyId = request.user.company_id
        const { tipo, datetime } = request.body

        if (!datetime || (tipo && !['ENTRATA', 'USCITA'].includes(tipo))) {
          return reply.send({ success: false, error: 'INVALID_PARAMS' })
        }

        const { data: company } = await supabase
          .from('company').select('portale_dipendenti').eq('id', companyId).single()

        const { data: presenza } = await supabase
          .from('presenza').select('id, tag_uid').eq('id', id).eq('company_id', companyId).single()

        if (!presenza) return reply.send({ success: false, error: 'NOT_FOUND' })

        if (company?.portale_dipendenti) {
          const { data: emp } = await supabase
            .from('dipendenti').select('email')
            .eq('badge_uid', presenza.tag_uid).eq('company_id', companyId).maybeSingle()
          if (emp?.email) return reply.send({ success: false, error: 'PORTAL_ACTIVE' })
        }

        const updates = { created_at: new Date(datetime).toISOString() }
        if (tipo) updates.tipo = tipo

        const { data, error } = await supabase
          .from('presenza').update(updates).eq('id', id).select().single()

        if (error) {
          request.log.error(error)
          return reply.send({ success: false, error: error.message })
        }

        return reply.send({ success: true, presenza: data })
      } catch (err) {
        request.log.error(err)
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
        request.log.error(err)
        return reply.status(500).send({ success: false, error: 'SERVER_ERROR' })
      }
    }
  )

  /* GET /api/company/settings — impostazioni aziendali */
  fastify.get('/api/company/settings', { preHandler: [authenticate, requirePermission('can_manage_employees')] }, async (req, reply) => {
    try {
      const { data } = await supabase
        .from('company')
        .select('*')
        .eq('id', req.user.company_id)
        .single()
      return reply.send({
        success: true,
        tolleranza_straordinario_minuti: data?.tolleranza_straordinario_minuti ?? 10,
        tolleranza_difetto_minuti:       data?.tolleranza_difetto_minuti ?? 15,
        arrotonda_ore_al_turno:          data?.arrotonda_ore_al_turno ?? false,
        auto_cleanup_enabled:            data?.auto_cleanup_enabled ?? false,
        auto_cleanup_retention_months:   data?.auto_cleanup_retention_months ?? 12,
        auto_cleanup_giorno:             data?.auto_cleanup_giorno ?? 15
      })
    } catch (err) {
      request.log.error(err)
      return reply.status(500).send({ success: false })
    }
  })

  /* PUT /api/company/settings — aggiorna impostazioni aziendali */
  fastify.put('/api/company/settings', { preHandler: [authenticate, requirePermission('can_manage_employees')] }, async (req, reply) => {
    try {
      const raw     = parseInt(req.body?.tolleranza_straordinario_minuti)
      const val     = isNaN(raw) ? 10 : Math.max(0, Math.min(120, raw))
      const rawDif  = parseInt(req.body?.tolleranza_difetto_minuti)
      const valDif  = isNaN(rawDif) ? 15 : Math.max(0, Math.min(120, rawDif))
      const snap    = !!req.body?.arrotonda_ore_al_turno
      const { error } = await supabase
        .from('company')
        .update({ tolleranza_straordinario_minuti: val, tolleranza_difetto_minuti: valDif, arrotonda_ore_al_turno: snap })
        .eq('id', req.user.company_id)
      if (error) return reply.send({ success: false, error: error.message })

      // pulizia automatica — best-effort (colonne potrebbero non esistere ancora)
      if (req.body?.auto_cleanup_enabled !== undefined || req.body?.auto_cleanup_retention_months !== undefined || req.body?.auto_cleanup_giorno !== undefined) {
        const cleanup = {}
        if (req.body.auto_cleanup_enabled !== undefined) cleanup.auto_cleanup_enabled = !!req.body.auto_cleanup_enabled
        if (req.body.auto_cleanup_retention_months !== undefined) {
          const m = parseInt(req.body.auto_cleanup_retention_months)
          cleanup.auto_cleanup_retention_months = isNaN(m) ? 12 : Math.max(1, Math.min(120, m))
        }
        if (req.body.auto_cleanup_giorno !== undefined) {
          const g = parseInt(req.body.auto_cleanup_giorno)
          cleanup.auto_cleanup_giorno = isNaN(g) ? 15 : Math.max(1, Math.min(28, g))
        }
        const { error: cErr } = await supabase.from('company').update(cleanup).eq('id', req.user.company_id)
      }

      return reply.send({ success: true })
    } catch (err) {
      request.log.error(err)
      return reply.status(500).send({ success: false })
    }
  })

  /* POST /api/admin/cleanup-presences — elimina storico per dipendenti + mese/periodo (owner) */
  fastify.post('/api/admin/cleanup-presences', { preHandler: [authenticate, requirePermission('can_manage_employees')] }, async (req, reply) => {
    try {
      if (req.user.role === 'dipendente') return reply.status(403).send({ success: false })
      const companyId = req.user.company_id
      const { employee_ids = [], month, before } = req.body || {}
      if (!month && !before) return reply.send({ success: false, error: 'NO_CRITERIA' })

      // admin con accesso limitato: restringe (o sostituisce, se "tutti") alla lista consentita
      const allowedIds = await getAllowedDipendenteIds(req.user)
      let targetIds = Array.isArray(employee_ids) ? employee_ids : []
      if (allowedIds) targetIds = targetIds.length ? targetIds.filter(id => allowedIds.includes(id)) : allowedIds

      let q = supabase.from('dipendenti').select('id, badge_uid').eq('company_id', companyId)
      if (targetIds.length || allowedIds) q = q.in('id', targetIds)
      const { data: emps } = await q
      const badgeUids = (emps || []).map(e => e.badge_uid).filter(Boolean)
      if (!badgeUids.length) return reply.send({ success: true, deleted: 0 })

      const { data: reads } = await supabase
        .from('presenza')
        .select('id, created_at')
        .eq('company_id', companyId)
        .in('tag_uid', badgeUids)

      const beforeDate = before ? new Date(before + 'T00:00:00') : null
      const idsToDelete = (reads || []).filter(r => {
        if (month) {
          const monthName = new Date(r.created_at).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
          return monthName === month
        }
        return new Date(r.created_at) < beforeDate
      }).map(r => r.id)

      for (let i = 0; i < idsToDelete.length; i += 500) {
        await supabase.from('presenza').delete().in('id', idsToDelete.slice(i, i + 500))
      }
      return reply.send({ success: true, deleted: idsToDelete.length })
    } catch (err) {
      request.log.error(err)
      return reply.status(500).send({ success: false })
    }
  })

  /* PATCH /api/employees/:id/profile — aggiorna anagrafica + (ri)genera credenziali portale */
  fastify.patch('/api/employees/:id/profile', { preHandler: [authenticate, requirePermission('can_manage_employees')] }, async (req, reply) => {
    try {
      if (req.user.role === 'dipendente') return reply.status(403).send({ success: false })
      const { id }    = req.params
      const companyId = req.user.company_id
      const { nome, cognome, email, importo_orario } = req.body || {}

      const { data: emp } = await supabase
        .from('dipendenti')
        .select('id, nome, cognome, email')
        .eq('id', id).eq('company_id', companyId)
        .single()
      if (!emp) return reply.send({ success: false, error: 'NOT_FOUND' })

      const allowedIds = await getAllowedDipendenteIds(req.user)
      if (!isDipendenteAllowed(allowedIds, emp.id)) return reply.status(403).send({ success: false, error: 'FORBIDDEN' })

      const newNome    = (nome    ?? emp.nome) || ''
      const newCognome = (cognome ?? emp.cognome) || ''
      const newEmail   = (email   ?? emp.email) || null
      const nameChanged  = newNome !== (emp.nome || '') || newCognome !== (emp.cognome || '')
      const emailChanged = newEmail !== (emp.email || null)

      const dipUpdate = { nome: newNome, cognome: newCognome, email: newEmail }

      if (importo_orario !== undefined) {
        const v = importo_orario === null ? null : parseFloat(importo_orario)
        if (v !== null && (isNaN(v) || v <= 0)) {
          return reply.send({ success: false, error: 'INVALID_IMPORTO_ORARIO' })
        }
        dipUpdate.importo_orario = v
      }

      const { error: dipUpdateError } = await supabase.from('dipendenti')
        .update(dipUpdate)
        .eq('id', id).eq('company_id', companyId)
      if (dipUpdateError) {
        req.log.error(dipUpdateError)
        return reply.send({ success: false, error: 'UPDATE_FAILED', detail: dipUpdateError.message })
      }

      let credenziali_inviate = false
      const { data: company } = await supabase
        .from('company').select('nome, portale_dipendenti').eq('id', companyId).single()

      if (company?.portale_dipendenti && newEmail) {
        // Primo: cerca account per email (più affidabile)
        let account = null
        const { data: existingByEmail } = await supabase
          .from('user_account')
          .select('id, username')
          .eq('email', newEmail)
          .eq('company_id', companyId)
          .maybeSingle()

        // Se non trovato per email, cerca per dipendente_id
        if (!existingByEmail) {
          const { data: existingByDipendente } = await supabase
            .from('user_account')
            .select('id, username')
            .eq('dipendente_id', id)
            .eq('company_id', companyId)
            .maybeSingle()
          account = existingByDipendente
        } else {
          account = existingByEmail
        }

        // Rigenera e reinvia le credenziali solo se l'account non esiste ancora
        // oppure se è cambiato qualcosa nell'anagrafica che lo riguarda (nome/cognome/email).
        // Se è cambiato solo un campo estraneo all'accesso (es. tariffa oraria), non fare nulla.
        if (!account || nameChanged || emailChanged) {
          let username
          if (account && !nameChanged) {
            username = account.username
          } else {
            username = await findAvailableUsername(buildUsername(newNome, newCognome))
          }
          const plainPwd  = generatePassword(10)
          const hashedPwd = await bcrypt.hash(plainPwd, 10)

          if (account) {
            const { error: updateError } = await supabase.from('user_account')
              .update({ username, email: newEmail, password: hashedPwd, dipendente_id: id })
              .eq('id', account.id)
            if (updateError) {
              return reply.send({ success: false, error: 'ACCOUNT_UPDATE_FAILED', detail: updateError.message })
            }
          } else {
            // Controlla se un account con la stessa email già esiste in un'altra azienda
            const { data: conflicting } = await supabase
              .from('user_account')
              .select('id, email, company_id')
              .eq('email', newEmail)
              .maybeSingle()

            if (conflicting) {
              return reply.send({ success: false, error: 'EMAIL_ALREADY_IN_USE' })
            }

            const { error: insertError } = await supabase.from('user_account').insert({
              company_id: companyId, dipendente_id: id, username,
              email: newEmail, password: hashedPwd, role: 'dipendente',
              two_factor_enabled: false
            })
            if (insertError) {
              return reply.send({ success: false, error: 'ACCOUNT_CREATE_FAILED', detail: insertError.message })
            }
          }

          try {
            const loginUrl = process.env.FRONTEND_URL || 'https://contaore-eight.vercel.app'
            await sendCredenziali({ email: newEmail, nome: newNome, username, password: plainPwd, companyNome: company.nome, loginUrl })
            credenziali_inviate = true
          } catch (_) {}
        }
      }

      return reply.send({ success: true, credenziali_inviate })
    } catch (err) {
      req.log.error(err)
      return reply.status(500).send({ success: false })
    }
  })

  /* DELETE /api/employees/:id/2fa — disabilita 2FA per dipendente (owner only) */
  fastify.delete('/api/employees/:id/2fa', { preHandler: [authenticate, requirePermission('can_manage_employees')] }, async (req, reply) => {
    try {
      if (req.user.role === 'dipendente') return reply.status(403).send({ success: false })
      const { id } = req.params
      const companyId = req.user.company_id

      const { data: emp } = await supabase
        .from('dipendenti').select('id').eq('id', id).eq('company_id', companyId).single()
      if (!emp) return reply.send({ success: false, error: 'NOT_FOUND' })

      const allowedIds = await getAllowedDipendenteIds(req.user)
      if (!isDipendenteAllowed(allowedIds, emp.id)) return reply.status(403).send({ success: false, error: 'FORBIDDEN' })

      const { data: account } = await supabase
        .from('user_account').select('id').eq('dipendente_id', id).maybeSingle()
      if (!account) return reply.send({ success: false, error: 'NO_ACCOUNT' })

      const { error } = await supabase.from('user_account')
        .update({ two_factor_enabled: false, two_factor_method: null })
        .eq('id', account.id)
      if (error) return reply.send({ success: false, error: error.message })

      return reply.send({ success: true })
    } catch (err) {
      request.log.error(err)
      return reply.status(500).send({ success: false })
    }
  })

  // ─── ELIMINA DIPENDENTI (batch) ───────────────────────────────────────────
  fastify.delete('/api/employees/batch', { preHandler: [authenticate, requirePermission('can_manage_employees')] }, async (request, reply) => {
    try {
      const companyId = request.user.company_id
      const { ids } = request.body

      if (!Array.isArray(ids) || ids.length === 0) {
        return reply.status(400).send({ success: false, error: 'IDS_REQUIRED' })
      }

      const allowedIds = await getAllowedDipendenteIds(request.user)
      const scopedIds  = allowedIds ? ids.filter(id => allowedIds.includes(id)) : ids

      if (!scopedIds.length) return reply.send({ success: true })

      // Fetch all employees at once to verify company ownership
      const { data: emps } = await supabase
        .from('dipendenti')
        .select('id, badge_uid')
        .in('id', scopedIds)
        .eq('company_id', companyId)

      if (!emps || emps.length === 0) {
        return reply.send({ success: true })
      }

      const empIds    = emps.map(e => e.id)
      const badgeUids = emps.map(e => e.badge_uid).filter(Boolean)

      // Batch delete per-table in parallel; presenza keyed by badge_uid
      const deletions = [
        supabase.from('user_account').delete().in('dipendente_id', empIds),
        supabase.from('turni').delete().in('dipendente_id', empIds).eq('company_id', companyId),
        supabase.from('richieste_ferie').delete().in('dipendente_id', empIds),
        supabase.from('giustificazioni').delete().in('dipendente_id', empIds),
        supabase.from('richieste_permessi').delete().in('dipendente_id', empIds),
        supabase.from('richieste_turni').delete().in('dipendente_id', empIds),
        supabase.from('tag').delete().in('dipendente_id', empIds).eq('company_id', companyId),
      ]
      if (badgeUids.length > 0) {
        deletions.push(supabase.from('presenza').delete().in('tag_uid', badgeUids).eq('company_id', companyId))
      }
      await Promise.all(deletions)
      await supabase.from('dipendenti').delete().in('id', empIds).eq('company_id', companyId)

      return reply.send({ success: true })
    } catch (err) {
      request.log.error(err)
      return reply.status(500).send({ success: false, error: 'SERVER_ERROR' })
    }
  })

  // ─── ACCOUNT AMMINISTRATORI ───────────────────────────────────────────────

  /* GET /api/admin-accounts — lista admin dell'azienda (solo owner) */
  fastify.get('/api/admin-accounts', { preHandler: authenticate }, async (req, reply) => {
    try {
      if (req.user.role !== 'owner' && req.user.role !== 'superadmin') {
        return reply.status(403).send({ success: false, error: 'FORBIDDEN' })
      }
      const companyId = req.user.company_id
      const { data } = await supabase
        .from('user_account')
        .select('id, username, email, nome, cognome, permissions, assigned_dipendente_ids, created_at')
        .eq('company_id', companyId)
        .eq('role', 'admin')
        .order('created_at', { ascending: false })
      return reply.send({ success: true, admins: data || [] })
    } catch (err) {
      request.log.error(err)
      return reply.status(500).send({ success: false })
    }
  })

  /* POST /api/admin-accounts — crea account admin (solo owner) */
  fastify.post('/api/admin-accounts', { preHandler: authenticate }, async (req, reply) => {
    try {
      if (req.user.role !== 'owner' && req.user.role !== 'superadmin') {
        return reply.status(403).send({ success: false, error: 'FORBIDDEN' })
      }
      const companyId = req.user.company_id
      const { nome, cognome, email, permissions = {}, employee_ids } = req.body || {}

      if (!nome?.trim() || !cognome?.trim() || !email?.trim()) {
        return reply.status(400).send({ success: false, error: 'MISSING_FIELDS' })
      }

      // Username generato automaticamente da nome.cognome (stessa logica di dipendenti e titolare)
      const username = await findAvailableUsername(buildUsername(nome.trim(), cognome.trim()))

      const plainPwd  = generatePassword(10)
      const hashedPwd = await bcrypt.hash(plainPwd, 10)

      // employee_ids assente/vuoto = accesso a tutti i dipendenti; array = accesso limitato
      const assignedDipendenteIds = Array.isArray(employee_ids) && employee_ids.length ? employee_ids : null

      const { data: created, error: insertErr } = await supabase.from('user_account').insert({
        company_id:  companyId,
        username,
        email:       email.trim(),
        nome:        nome.trim(),
        cognome:     cognome.trim(),
        password:    hashedPwd,
        role:        'admin',
        permissions: permissions,
        assigned_dipendente_ids: assignedDipendenteIds,
        two_factor_enabled: false
      }).select('id, username, email, nome, cognome, permissions, assigned_dipendente_ids').single()

      if (insertErr) return reply.status(500).send({ success: false, error: insertErr.message })

      const { data: company } = await supabase.from('company').select('nome').eq('id', companyId).single()
      const loginUrl = process.env.FRONTEND_URL || 'https://contaore-eight.vercel.app'
      sendCredenziali({
        email:       created.email,
        nome:        created.nome,
        username:    created.username,
        password:    plainPwd,
        companyNome: company?.nome || '',
        loginUrl
      }).catch(e => req.log.error(e))

      return reply.send({ success: true, admin: created, password: plainPwd })
    } catch (err) {
      req.log.error(err)
      return reply.status(500).send({ success: false })
    }
  })

  /* PUT /api/admin-accounts/:id — aggiorna permessi admin (solo owner) */
  fastify.put('/api/admin-accounts/:id', { preHandler: authenticate }, async (req, reply) => {
    try {
      if (req.user.role !== 'owner' && req.user.role !== 'superadmin') {
        return reply.status(403).send({ success: false, error: 'FORBIDDEN' })
      }
      const companyId = req.user.company_id
      const { id }    = req.params
      const { permissions, nome, cognome, email, employee_ids } = req.body || {}

      const update = {}
      if (permissions !== undefined) update.permissions = permissions
      if (nome       !== undefined) update.nome       = nome?.trim()    || null
      if (cognome    !== undefined) update.cognome    = cognome?.trim()  || null
      if (email      !== undefined) update.email      = email?.trim()    || null
      if (employee_ids !== undefined) {
        update.assigned_dipendente_ids = Array.isArray(employee_ids) && employee_ids.length ? employee_ids : null
      }

      const { error } = await supabase.from('user_account')
        .update(update)
        .eq('id', id).eq('company_id', companyId).eq('role', 'admin')
      if (error) return reply.status(500).send({ success: false, error: error.message })

      return reply.send({ success: true })
    } catch (err) {
      req.log.error(err)
      return reply.status(500).send({ success: false })
    }
  })

  /* DELETE /api/admin-accounts/:id — elimina account admin (solo owner) */
  fastify.delete('/api/admin-accounts/:id', { preHandler: authenticate }, async (req, reply) => {
    try {
      if (req.user.role !== 'owner' && req.user.role !== 'superadmin') {
        return reply.status(403).send({ success: false, error: 'FORBIDDEN' })
      }
      const companyId = req.user.company_id
      const { id }    = req.params

      const { error } = await supabase.from('user_account')
        .delete()
        .eq('id', id).eq('company_id', companyId).eq('role', 'admin')
      if (error) return reply.status(500).send({ success: false, error: error.message })

      return reply.send({ success: true })
    } catch (err) {
      req.log.error(err)
      return reply.status(500).send({ success: false })
    }
  })
}
