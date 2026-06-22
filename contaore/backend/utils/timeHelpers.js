export const GIORNI = [
  'Domenica', 'Lunedì', 'Martedì', 'Mercoledì',
  'Giovedì', 'Venerdì', 'Sabato'
]

export function timeToMinutes(t) {
  if (!t) return null
  const parts = t.split(':')
  return parseInt(parts[0]) * 60 + parseInt(parts[1])
}

// Handles cross-midnight shifts (e.g. 22:00→02:00 = 240 min, not -1200)
export function shiftDurationMins(ingresso, uscita) {
  const start = timeToMinutes(ingresso)
  const end   = timeToMinutes(uscita)
  return end > start ? end - start : (1440 - start) + end
}

export function shiftExpectedHours(shift) {
  let mins = 0
  if (shift.ingresso_1 && shift.uscita_1) mins += shiftDurationMins(shift.ingresso_1, shift.uscita_1)
  if (shift.ingresso_2 && shift.uscita_2) mins += shiftDurationMins(shift.ingresso_2, shift.uscita_2)
  return Number((mins / 60).toFixed(2))
}

export function getLocalDateStr(dateStr, timezone = 'Europe/Rome') {
  const date = new Date(dateStr)
  const formatter = new Intl.DateTimeFormat('it-IT', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: timezone
  })
  const parts = formatter.formatToParts(date)
  const year  = parts.find(p => p.type === 'year').value
  const month = parts.find(p => p.type === 'month').value
  const day   = parts.find(p => p.type === 'day').value
  return `${year}-${month}-${day}`
}

export function getLocalTimeMinutes(dateStr, timezone = 'Europe/Rome') {
  const date = new Date(dateStr)
  const formatter = new Intl.DateTimeFormat('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone
  })
  const parts   = formatter.formatToParts(date)
  const hours   = parseInt(parts.find(p => p.type === 'hour').value)
  const minutes = parseInt(parts.find(p => p.type === 'minute').value)
  return hours * 60 + minutes
}

export function getLocalDayOfWeek(dateStr, timezone = 'Europe/Rome') {
  const date = new Date(dateStr)
  const formatter = new Intl.DateTimeFormat('it-IT', {
    weekday: 'long',
    timeZone: timezone
  })
  const dayName = formatter.format(date)
  const dayMap = {
    'domenica': 0, 'lunedì': 1, 'martedì': 2, 'mercoledì': 3,
    'giovedì': 4, 'venerdì': 5, 'sabato': 6
  }
  return dayMap[dayName.toLowerCase()] ?? new Date(dateStr).getDay()
}

export function getDayName(dateStr) {
  return GIORNI[getLocalDayOfWeek(dateStr)]
}

export function buildSessions(scans) {
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

export function buildCoppie(sessions) {
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

// Minutes of shift-break time that the employee "covered" without explicit badge
export function computeBreakDeductionMins(sortedReads, breakStartMins, breakEndMins) {
  let deductionMins   = 0
  let lastEntrataMins = null
  const nowMins = getLocalTimeMinutes(new Date().toISOString())

  for (const read of sortedReads) {
    const readMins = getLocalTimeMinutes(read.created_at)
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

export function isInFerie(dateStr, ferie = []) {
  return ferie.some(f => dateStr >= f.data_inizio && dateStr <= f.data_fine)
}
