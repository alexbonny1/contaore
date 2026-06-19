import bcrypt from 'bcrypt'
import { supabase } from '../services/supabase.js'
import { authenticate } from '../middleware/auth.js'
import { sendCredenziali } from '../services/email.js'

function generatePassword(length = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let pwd = ''
  for (let i = 0; i < length; i++) pwd += chars.charAt(Math.floor(Math.random() * chars.length))
  return pwd
}

function buildUsername(nome, cognome) {
  const normalize = s =>
    (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]/g, '')
  return `${normalize(nome)}.${normalize(cognome)}`
}

async function findAvailableUsername(base) {
  let username = base
  let attempt  = 1
  while (true) {
    const { data } = await supabase.from('user_account').select('id').eq('username', username).maybeSingle()
    if (!data) return username
    attempt++
    username = `${base}${attempt}`
  }
}

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
        // Lone USCITA: entrata dimenticata — resa visibile invece di essere ignorata
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
    entrata:             s.entrata ? new Date(s.entrata.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : null,
    uscita:              s.uscita  ? new Date(s.uscita.created_at).toLocaleTimeString('it-IT',  { hour: '2-digit', minute: '2-digit' }) : null,
    entrata_id:          s.entrata?.id || null,
    uscita_id:           s.uscita?.id  || null,
    entrata_manuale:     s.entrata ? !!s.entrata.manuale    : false,
    uscita_manuale:      s.uscita  ? !!s.uscita.manuale     : false,
    entrata_automatica:  s.entrata ? !!s.entrata.automatica : false,
    uscita_automatica:   s.uscita  ? !!s.uscita.automatica  : false,
    uscita_giorno_dopo:  !!s.uscita_giorno_dopo,
    incomplete:          !!s.incomplete
  }))
}

function isInFerie(dateStr, ferie = []) {
  return ferie.some(f => dateStr >= f.data_inizio && dateStr <= f.data_fine)
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

  for (const ins of inserts) {
    await supabase.from('presenza').insert({
      company_id: companyId,
      tag_uid:    tagUid,
      reader_id:  null,
      manuale:    false,
      automatica: true,
      timestamp:  ins.created_at,
      ...ins
    })
  }
}

function groupByDay(reads = [], shifts = [], turniAttivi = false, dataInizio = null, ferieApprovate = [], giustificazioni = [], pausaAziendale = null, toleranceMins = 10, snapToShift = false) {

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
    let ritardo_minuti    = 0

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
        const extraMins = (oreLavorate - ore_previste) * 60
        ore_straordinario = extraMins >= toleranceMins
          ? Number((extraMins / 60).toFixed(2))
          : 0
      } else {
        ore_straordinario = Number(oreLavorate.toFixed(2))
      }

      var ore_effettive = oreLavorate
      if (snapToShift && ore_previste > 0) {
        const diffMins = Math.abs(oreLavorate - ore_previste) * 60
        if (diffMins < toleranceMins) ore_effettive = ore_previste
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
    const today   = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
    const nowMins = now.getHours() * 60 + now.getMinutes()

    const start = dataInizio ? new Date(dataInizio) : new Date()

    const endDate = new Date()
    endDate.setHours(23, 59, 59, 999)

    // Days with at least one scan (ENTRATA or lone USCITA)
    const presentSet = new Set(sessions.filter(s => s.entrata || s.uscita).map(s => s.date))
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
                const lastMins = new Date(lastTodayRead.created_at).getHours() * 60 + new Date(lastTodayRead.created_at).getMinutes()
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

        // tolleranza straordinari configurabile per azienda
        const { data: companySettings } = await supabase
          .from('company')
          .select('tolleranza_straordinario_minuti, arrotonda_ore_al_turno')
          .eq('id', companyId)
          .single()
        const toleranceMins = companySettings?.tolleranza_straordinario_minuti ?? 10
        const snapToShift   = companySettings?.arrotonda_ore_al_turno ?? false

        const days   = groupByDay(
          reads,
          shifts || [],
          turniAttivi,
          employee.turni_attivati_il || employee.data_inizio,
          ferieApprovate || [],
          giustificazioni || [],
          pausaAziendale || null,
          toleranceMins,
          snapToShift
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
                const currentMonth = new Date().toISOString().slice(0, 7)
                return Number(days.filter(d => d.giorno.slice(0, 7) === currentMonth).reduce((s, d) => s + (d.ore_effettive ?? d.ore_totali), 0).toFixed(2))
              })(),
              total_reads:       reads.length,
              ore_straordinario: (() => {
                const totLav  = days.reduce((s, d) => s + (d.ore_effettive ?? d.ore_totali), 0)
                const totPrev = days.reduce((s, d) => s + d.ore_previste, 0)
                return (Math.max(0, totLav - totPrev)).toFixed(2)
              })(),
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
          console.log(error)
          return reply.send({ success: false, error: error.message })
        }

        // Auto-insert missing break timbrature when a final USCITA is saved
        if (tipo === 'USCITA') {
          try {
            console.log('[AUTO-INSERT] USCITA salvata, avvio controllo...')
            const { data: empFull, error: empErr } = await supabase.from('dipendenti').select('id, turni_attivi').eq('id', id).single()
            console.log('[AUTO-INSERT] dipendente:', empFull, 'errore:', empErr)
            if (empFull?.turni_attivi) {
              const dateStr   = ts.split('T')[0]
              const newMins   = new Date(ts).getHours() * 60 + new Date(ts).getMinutes()
              const dayName   = getDayName(dateStr)
              console.log('[AUTO-INSERT] dateStr:', dateStr, 'dayName:', dayName, 'newMins:', newMins)
              const { data: shifts, error: shiftsErr } = await supabase.from('turni').select('*').eq('dipendente_id', id)
              console.log('[AUTO-INSERT] turni trovati:', shifts?.length, 'errore:', shiftsErr)
              console.log('[AUTO-INSERT] turni:', JSON.stringify(shifts?.map(s => ({ g: s.giorno_settimana, u1: s.uscita_1, i2: s.ingresso_2 }))))
              const dayShift  = (shifts || []).find(s => s.giorno_settimana === dayName && s.uscita_1 && s.ingresso_2)
              console.log('[AUTO-INSERT] turno doppio trovato:', dayShift ? `${dayShift.uscita_1}-${dayShift.ingresso_2}` : 'NO')
              if (dayShift && newMins >= timeToMinutes(dayShift.ingresso_2)) {
                const { data: todayReads, error: readsErr } = await supabase.from('presenza')
                  .select('tipo, created_at')
                  .eq('tag_uid', employee.badge_uid)
                  .eq('company_id', companyId)
                  .gte('created_at', `${dateStr}T00:00:00`)
                  .lte('created_at', `${dateStr}T23:59:59`)
                  .order('created_at', { ascending: true })
                console.log('[AUTO-INSERT] reads oggi:', todayReads?.map(r => r.tipo), 'errore:', readsErr)
                await autoInsertBreakTimbrature(supabase, id, companyId, employee.badge_uid, todayReads || [], dayShift, dateStr)
              } else {
                console.log('[AUTO-INSERT] condizione non soddisfatta — dayShift:', !!dayShift, 'newMins >= ingresso_2:', newMins, '>=', dayShift ? timeToMinutes(dayShift.ingresso_2) : 'N/A')
              }
            } else {
              console.log('[AUTO-INSERT] turni_attivi non abilitato, skip')
            }
          } catch (err) { console.log('[AUTO-INSERT] ERRORE:', err) }
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

  // ─── EDIT SINGLE PRESENCE (direct, owner only, no-email employees) ──────────
  fastify.put(
    '/api/presenze/:id',
    { preHandler: authenticate },
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

  /* GET /api/company/settings — impostazioni aziendali */
  fastify.get('/api/company/settings', { preHandler: authenticate }, async (req, reply) => {
    try {
      const { data } = await supabase
        .from('company')
        .select('*')
        .eq('id', req.user.company_id)
        .single()
      return reply.send({
        success: true,
        tolleranza_straordinario_minuti: data?.tolleranza_straordinario_minuti ?? 10,
        arrotonda_ore_al_turno:          data?.arrotonda_ore_al_turno ?? false,
        auto_cleanup_enabled:            data?.auto_cleanup_enabled ?? false,
        auto_cleanup_retention_months:   data?.auto_cleanup_retention_months ?? 12
      })
    } catch (err) {
      console.log(err)
      return reply.status(500).send({ success: false })
    }
  })

  /* PUT /api/company/settings — aggiorna impostazioni aziendali */
  fastify.put('/api/company/settings', { preHandler: authenticate }, async (req, reply) => {
    try {
      const raw  = parseInt(req.body?.tolleranza_straordinario_minuti)
      const val  = isNaN(raw) ? 10 : Math.max(0, Math.min(60, raw))
      const snap = !!req.body?.arrotonda_ore_al_turno
      const { error } = await supabase
        .from('company')
        .update({ tolleranza_straordinario_minuti: val, arrotonda_ore_al_turno: snap })
        .eq('id', req.user.company_id)
      if (error) return reply.send({ success: false, error: error.message })

      // pulizia automatica — best-effort (colonne potrebbero non esistere ancora)
      if (req.body?.auto_cleanup_enabled !== undefined || req.body?.auto_cleanup_retention_months !== undefined) {
        const cleanup = {}
        if (req.body.auto_cleanup_enabled !== undefined) cleanup.auto_cleanup_enabled = !!req.body.auto_cleanup_enabled
        if (req.body.auto_cleanup_retention_months !== undefined) {
          const m = parseInt(req.body.auto_cleanup_retention_months)
          cleanup.auto_cleanup_retention_months = isNaN(m) ? 12 : Math.max(1, Math.min(120, m))
        }
        const { error: cErr } = await supabase.from('company').update(cleanup).eq('id', req.user.company_id)
        if (cErr) console.log('auto_cleanup settings skipped (migration pending):', cErr.message)
      }

      return reply.send({ success: true })
    } catch (err) {
      console.log(err)
      return reply.status(500).send({ success: false })
    }
  })

  /* POST /api/admin/cleanup-presences — elimina storico per dipendenti + mese/periodo (owner) */
  fastify.post('/api/admin/cleanup-presences', { preHandler: authenticate }, async (req, reply) => {
    try {
      if (req.user.role === 'dipendente') return reply.status(403).send({ success: false })
      const companyId = req.user.company_id
      const { employee_ids = [], month, before } = req.body || {}
      if (!month && !before) return reply.send({ success: false, error: 'NO_CRITERIA' })

      let q = supabase.from('dipendenti').select('id, badge_uid').eq('company_id', companyId)
      if (Array.isArray(employee_ids) && employee_ids.length) q = q.in('id', employee_ids)
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
      console.log(err)
      return reply.status(500).send({ success: false })
    }
  })

  /* PATCH /api/employees/:id/profile — aggiorna anagrafica + (ri)genera credenziali portale */
  fastify.patch('/api/employees/:id/profile', { preHandler: authenticate }, async (req, reply) => {
    try {
      if (req.user.role === 'dipendente') return reply.status(403).send({ success: false })
      const { id }    = req.params
      const companyId = req.user.company_id
      const { nome, cognome, email } = req.body || {}

      const { data: emp } = await supabase
        .from('dipendenti')
        .select('id, nome, cognome, email')
        .eq('id', id).eq('company_id', companyId)
        .single()
      if (!emp) return reply.send({ success: false, error: 'NOT_FOUND' })

      const newNome    = (nome    ?? emp.nome) || ''
      const newCognome = (cognome ?? emp.cognome) || ''
      const newEmail   = (email   ?? emp.email) || null
      const nameChanged = newNome !== (emp.nome || '') || newCognome !== (emp.cognome || '')

      await supabase.from('dipendenti')
        .update({ nome: newNome, cognome: newCognome, email: newEmail })
        .eq('id', id).eq('company_id', companyId)

      let credenziali_inviate = false
      const { data: company } = await supabase
        .from('company').select('nome, portale_dipendenti').eq('id', companyId).single()

      if (company?.portale_dipendenti && newEmail) {
        const { data: account } = await supabase
          .from('user_account').select('id, username').eq('dipendente_id', id).maybeSingle()

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
            .update({ username, email: newEmail, password: hashedPwd })
            .eq('id', account.id)
            .eq('company_id', companyId)
          if (updateError) {
            console.log('Error updating account:', updateError)
            return reply.send({ success: false, error: 'ACCOUNT_UPDATE_FAILED' })
          }
        } else {
          const { error: insertError } = await supabase.from('user_account').insert({
            company_id: companyId, dipendente_id: id, username,
            email: newEmail, password: hashedPwd, role: 'dipendente'
          })
          if (insertError) {
            console.log('Error creating account:', insertError)
            return reply.send({ success: false, error: 'ACCOUNT_CREATE_FAILED' })
          }
        }

        try {
          const loginUrl = process.env.FRONTEND_URL || 'https://timbry.it'
          await sendCredenziali({ email: newEmail, nome: newNome, username, password: plainPwd, companyNome: company.nome, loginUrl })
          credenziali_inviate = true
        } catch (e) { console.log('sendCredenziali error:', e?.message) }
      }

      return reply.send({ success: true, credenziali_inviate })
    } catch (err) {
      console.log(err)
      return reply.status(500).send({ success: false })
    }
  })

  /* DELETE /api/employees/:id/2fa — disabilita 2FA per dipendente (owner only) */
  fastify.delete('/api/employees/:id/2fa', { preHandler: authenticate }, async (req, reply) => {
    try {
      if (req.user.role === 'dipendente') return reply.status(403).send({ success: false })
      const { id } = req.params
      const companyId = req.user.company_id

      const { data: emp } = await supabase
        .from('dipendenti').select('id').eq('id', id).eq('company_id', companyId).single()
      if (!emp) return reply.send({ success: false, error: 'NOT_FOUND' })

      const { data: account } = await supabase
        .from('user_account').select('id').eq('dipendente_id', id).maybeSingle()
      if (!account) return reply.send({ success: false, error: 'NO_ACCOUNT' })

      const { error } = await supabase.from('user_account')
        .update({ two_factor_enabled: false, two_factor_method: null })
        .eq('id', account.id)
      if (error) return reply.send({ success: false, error: error.message })

      return reply.send({ success: true })
    } catch (err) {
      console.log(err)
      return reply.status(500).send({ success: false })
    }
  })
}
