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
