import { supabase } from '../services/supabase.js'
import { authenticate } from '../middleware/auth.js'
import PDFDocument from 'pdfkit'
import XLSX from 'xlsx'

/*
────────────────────────────────────
HELPERS
────────────────────────────────────
*/

function formatOre(h) {
  if (!h || h === 0) return '0m'
  const ore = Math.floor(h)
  const min = Math.round((h - ore) * 60)
  if (ore === 0) return `${min}m`
  if (min === 0) return `${ore}h`
  return `${ore}h ${min}m`
}

function timeToMinutes(t) {
  if (!t) return null
  const parts = t.split(':')
  return parseInt(parts[0]) * 60 + parseInt(parts[1])
}

const GIORNI = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato']

function getDayName(dateStr) {
  return GIORNI[new Date(dateStr).getDay()]
}

function calcOreGiorno(sorted) {
  let ore = 0
  let lastE = null
  sorted.forEach(r => {
    if (r.tipo === 'ENTRATA') lastE = r
    else if (r.tipo === 'USCITA' && lastE) {
      ore += (new Date(r.created_at) - new Date(lastE.created_at)) / 1000 / 60 / 60
      lastE = null
    }
  })
  return ore
}

function buildCoppie(sorted) {
  const coppie = []
  let lastE = null
  sorted.forEach(r => {
    if (r.tipo === 'ENTRATA') {
      lastE = r
    } else if (r.tipo === 'USCITA') {
      coppie.push({
        entrata: lastE ? new Date(lastE.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '—',
        uscita:  new Date(r.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
      })
      lastE = null
    }
  })
  if (lastE) coppie.push({
    entrata: new Date(lastE.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
    uscita: '—'
  })
  return coppie
}

/*
  Calcola stato giornaliero rispetto ai turni
  Ritorna: { stato, ritardoMin, straordinarioOre, orePreviste }
*/
function calcStatoGiorno(dateStr, sorted, shifts, turniAttivi) {
  if (!turniAttivi || !shifts.length) {
    return { stato: 'presente', ritardoMin: 0, straordinarioOre: 0, orePreviste: 0 }
  }

  const dayName   = getDayName(dateStr)
  const dayShifts = shifts.filter(s => s.giorno_settimana === dayName)

  if (!dayShifts.length) {
    return { stato: 'presente', ritardoMin: 0, straordinarioOre: 0, orePreviste: 0 }
  }

  const orePreviste = dayShifts.reduce((sum, s) => {
    let m = 0
    if (s.ingresso_1 && s.uscita_1) m += timeToMinutes(s.uscita_1) - timeToMinutes(s.ingresso_1)
    if (s.ingresso_2 && s.uscita_2) m += timeToMinutes(s.uscita_2) - timeToMinutes(s.ingresso_2)
    return sum + Math.max(0, m) / 60
  }, 0)

  const oreLavorate = calcOreGiorno(sorted)

  // ritardo: prima entrata vs ingresso_1 del primo turno
  let ritardoMin = 0
  const primoTurno = dayShifts[0]
  const inizio1 = timeToMinutes(primoTurno?.ingresso_1)
  if (inizio1 !== null && sorted.length > 0) {
    const primaEntrata = sorted.find(r => r.tipo === 'ENTRATA')
    if (primaEntrata) {
      const d = new Date(primaEntrata.created_at)
      const entrataMin = d.getHours() * 60 + d.getMinutes()
      ritardoMin = Math.max(0, entrataMin - inizio1)
    }
  }

  // straordinario
  const straordinarioOre = orePreviste > 0
    ? Math.max(0, oreLavorate - orePreviste)
    : 0

  let stato = 'presente'
  if (ritardoMin > 5) stato = 'ritardo'
  if (straordinarioOre > 0) stato = 'straordinario'

  return { stato, ritardoMin, straordinarioOre, orePreviste }
}

/*
  Costruisce dati strutturati per dipendente:
  { months: [{ name, giorni: [...], totali }] }
*/
function buildEmployeeData(reads, shifts, turniAttivi, turniAttivatIl, selectedMonth) {

  // raggruppa letture per giorno
  const byDay = {}
  reads.forEach(r => {
    const day = new Date(r.created_at).toISOString().split('T')[0]
    if (!byDay[day]) byDay[day] = []
    byDay[day].push(r)
  })

  // giorni presenti
  const presentDays = {}
  Object.entries(byDay).forEach(([dateStr, dayReads]) => {
    const sorted = [...dayReads].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    const coppie     = buildCoppie(sorted)
    const oreLavorate = calcOreGiorno(sorted)
    const { stato, ritardoMin, straordinarioOre, orePreviste } = calcStatoGiorno(dateStr, sorted, shifts, turniAttivi)

    const meseName = new Date(dateStr + 'T00:00:00').toLocaleDateString('it-IT', {
      month: 'long', year: 'numeric'
    })

    presentDays[dateStr] = { dateStr, meseName, coppie, oreLavorate, stato, ritardoMin, straordinarioOre, orePreviste, assente: false }
  })

  // giorni assenti
  const absentDays = {}
  if (turniAttivi && shifts.length > 0) {
    const start     = turniAttivatIl ? new Date(turniAttivatIl) : new Date()
    const now       = new Date()
    const nowMins   = now.getHours() * 60 + now.getMinutes()
    const today     = now.toISOString().split('T')[0]
    const shiftDays = new Set(shifts.map(s => s.giorno_settimana))

    const cursor = new Date(start)
    cursor.setHours(0, 0, 0, 0)

    const endDate = new Date()
    endDate.setHours(23, 59, 59, 999)

    while (cursor <= endDate) {
      const dateStr = [
        cursor.getFullYear(),
        String(cursor.getMonth() + 1).padStart(2, '0'),
        String(cursor.getDate()).padStart(2, '0')
      ].join('-')
      const dayName = GIORNI[cursor.getDay()]
      const isToday = dateStr === today

      if (shiftDays.has(dayName) && !presentDays[dateStr]) {
        const dayShifts = shifts.filter(s => s.giorno_settimana === dayName)
        const orePreviste = dayShifts.reduce((sum, s) => {
          let m = 0
          if (s.ingresso_1 && s.uscita_1) m += timeToMinutes(s.uscita_1) - timeToMinutes(s.ingresso_1)
          if (s.ingresso_2 && s.uscita_2) m += timeToMinutes(s.uscita_2) - timeToMinutes(s.ingresso_2)
          return sum + Math.max(0, m) / 60
        }, 0)

        if (isToday) {
          const turnoFinito = dayShifts.some(s => {
            const fine = timeToMinutes(s.uscita_1)
            return fine !== null && nowMins > fine
          })
          if (!turnoFinito) { cursor.setDate(cursor.getDate() + 1); continue }
        }

        const meseName = new Date(dateStr + 'T00:00:00').toLocaleDateString('it-IT', {
          month: 'long', year: 'numeric'
        })
        absentDays[dateStr] = { dateStr, meseName, coppie: [], oreLavorate: 0, stato: 'assente', ritardoMin: 0, straordinarioOre: 0, orePreviste, assente: true }
      }
      cursor.setDate(cursor.getDate() + 1)
    }
  }

  // unisci e raggruppa per mese
  const allDays = { ...presentDays, ...absentDays }
  const monthsMap = {}

  Object.values(allDays).sort((a, b) => a.dateStr.localeCompare(b.dateStr)).forEach(day => {
    if (!monthsMap[day.meseName]) {
      monthsMap[day.meseName] = {
        name: day.meseName,
        giorni: [],
        oreTotali: 0,
        orePreviste: 0,
        straordinario: 0,
        assenze: 0,
        ritardi: 0
      }
    }
    const m = monthsMap[day.meseName]
    m.giorni.push(day)
    m.oreTotali     += day.oreLavorate
    m.orePreviste   += day.orePreviste
    m.straordinario += day.straordinarioOre
    if (day.assente)           m.assenze++
    if (day.ritardoMin > 5)    m.ritardi++
  })

  let months = Object.values(monthsMap)
  if (selectedMonth && selectedMonth !== 'tutti') {
    months = months.filter(m => m.name === selectedMonth)
  }

  return months
}

/*
────────────────────────────────────
ROUTE PDF
────────────────────────────────────
*/

async function loadEmployeeFullData(id, companyId) {
  const { data: employee } = await supabase
    .from('dipendenti').select('*').eq('id', id).eq('company_id', companyId).single()
  if (!employee) return null

  const { data: reads } = await supabase
    .from('presenza').select('*')
    .eq('tag_uid', employee.badge_uid).eq('company_id', companyId)
    .order('created_at', { ascending: true })

  const { data: shifts } = await supabase
    .from('turni').select('*').eq('dipendente_id', id)

  return { employee, reads: reads || [], shifts: shifts || [] }
}

export default async function exportRoutes(fastify) {

  // ── PDF ──────────────────────────────────────────────────────────────

  fastify.post('/api/export/pdf', { preHandler: authenticate }, async (request, reply) => {

    const { employee_ids, month } = request.body
    const companyId = request.user.company_id

    if (!employee_ids?.length) return reply.status(400).send({ success: false, error: 'MISSING_IDS' })

    const employeesData = []
    for (const id of employee_ids) {
      const d = await loadEmployeeFullData(id, companyId)
      if (d) employeesData.push(d)
    }
    if (!employeesData.length) return reply.status(404).send({ success: false, error: 'NO_DATA' })

    const pdfBuffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' })
      const chunks = []
      doc.on('data', c => chunks.push(c))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      const periodoLabel = month && month !== 'tutti' ? month : 'Tutto lo storico'
      let isFirst = true

      for (const { employee, reads, shifts } of employeesData) {

        if (!isFirst) doc.addPage()
        isFirst = false

        const turniAttivi   = !!employee.turni_attivi
        const turniAttivatIl = employee.turni_attivati_il || null

        const months = buildEmployeeData(reads, shifts, turniAttivi, turniAttivatIl, month)

        // header dipendente
        doc.rect(40, 40, 515, 50).fill('#111827')
        doc.fillColor('white').fontSize(18).font('Helvetica-Bold')
          .text(`${employee.nome} ${employee.cognome || ''}`, 55, 53)
        doc.fontSize(9).font('Helvetica')
          .text(`Periodo: ${periodoLabel}`, 55, 76)
          .text(`Esportato il: ${new Date().toLocaleDateString('it-IT')}`, 380, 76)

        doc.fillColor('black')
        let y = 105

        if (months.length === 0) {
          doc.fontSize(10).fillColor('#6b7280').text('Nessuna presenza nel periodo selezionato.', 55, y)
          continue
        }

        // totali generali
        const totOre    = months.reduce((s, m) => s + m.oreTotali, 0)
        const totAssenze = months.reduce((s, m) => s + m.assenze, 0)
        const totStraord = months.reduce((s, m) => s + m.straordinario, 0)
        const totRitardi = months.reduce((s, m) => s + m.ritardi, 0)

        doc.rect(40, y, 515, 45).fill('#f9fafb').stroke('#e5e7eb')
        doc.fillColor('#6b7280').fontSize(8).font('Helvetica')
          .text('ORE TOTALI', 55, y + 8)
          .text('ASSENZE', 190, y + 8)
          .text('STRAORDINARI', 300, y + 8)
          .text('RITARDI', 430, y + 8)
        doc.fillColor('#111').fontSize(13).font('Helvetica-Bold')
          .text(formatOre(totOre), 55, y + 20)
          .text(String(totAssenze), 190, y + 20)
          .text(formatOre(totStraord), 300, y + 20)
          .text(String(totRitardi), 430, y + 20)

        y += 60

        for (const mese of months) {

          if (y > 680) { doc.addPage(); y = 40 }

          // titolo mese
          doc.fillColor('#4f46e5').fontSize(12).font('Helvetica-Bold')
            .text(mese.name.charAt(0).toUpperCase() + mese.name.slice(1), 40, y)

          // riepilogo mese
          doc.fillColor('#6b7280').fontSize(8).font('Helvetica')
            .text(`Ore: ${formatOre(mese.oreTotali)}  |  Previste: ${formatOre(mese.orePreviste)}  |  Straord: ${formatOre(mese.straordinario)}  |  Assenze: ${mese.assenze}  |  Ritardi: ${mese.ritardi}`, 40, y + 14)
          y += 28

          // intestazione tabella
          doc.rect(40, y, 515, 18).fill('#4f46e5')
          doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
            .text('DATA',    50,  y + 5)
            .text('ENTRATE', 155, y + 5)
            .text('USCITE',  255, y + 5)
            .text('ORE',     350, y + 5)
            .text('PREVISTE',400, y + 5)
            .text('STATO',   455, y + 5)
          y += 18

          let rowIndex = 0

          for (const day of mese.giorni) {

            if (y > 720) { doc.addPage(); y = 40 }

            const rowH = Math.max(18, day.coppie.length * 13 || 18)
            const bg   = rowIndex % 2 === 0 ? '#ffffff' : '#f9fafb'
            doc.rect(40, y, 515, rowH).fill(bg)

            const dataLabel = new Date(day.dateStr + 'T00:00:00').toLocaleDateString('it-IT', {
              weekday: 'short', day: '2-digit', month: 'short'
            })

            doc.fillColor('#111').fontSize(8).font('Helvetica')
              .text(dataLabel, 50, y + 4, { width: 95 })

            if (day.assente) {
              doc.fillColor('#dc2626').text('—', 155, y + 4)
              doc.fillColor('#dc2626').text('—', 255, y + 4)
              doc.fillColor('#111').text('—', 350, y + 4)
              doc.fillColor('#111').text(formatOre(day.orePreviste), 400, y + 4)
              doc.fillColor('#dc2626').font('Helvetica-Bold').text('ASSENTE', 455, y + 4)
            } else {
              day.coppie.forEach((c, i) => {
                doc.fillColor('#111').font('Helvetica')
                  .text(c.entrata, 155, y + 4 + i * 12)
                  .text(c.uscita,  255, y + 4 + i * 12)
              })
              doc.fillColor('#111').text(formatOre(day.oreLavorate), 350, y + 4)
              doc.fillColor('#6b7280').text(formatOre(day.orePreviste), 400, y + 4)

              // stato colorato
              if (day.stato === 'assente') {
                doc.fillColor('#dc2626').font('Helvetica-Bold').text('ASSENTE', 455, y + 4)
              } else if (day.stato === 'straordinario') {
                doc.fillColor('#d97706').font('Helvetica-Bold')
                  .text(`+${formatOre(day.straordinarioOre)}`, 455, y + 4)
              } else if (day.stato === 'ritardo') {
                doc.fillColor('#7c3aed').font('Helvetica-Bold')
                  .text(`RIT ${day.ritardoMin}m`, 455, y + 4)
              } else {
                doc.fillColor('#15803d').font('Helvetica').text('Presente', 455, y + 4)
              }
            }

            y += rowH
            rowIndex++
          }

          y += 14
        }
      }

      doc.end()
    })

    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="ContaOre_${month || 'storico'}.pdf"`)
      .send(pdfBuffer)

  })

  // ── EXCEL ────────────────────────────────────────────────────────────

  fastify.post('/api/export/excel', { preHandler: authenticate }, async (request, reply) => {

    const { employee_ids, month } = request.body
    const companyId = request.user.company_id

    if (!employee_ids?.length) return reply.status(400).send({ success: false, error: 'MISSING_IDS' })

    const employeesData = []
    for (const id of employee_ids) {
      const d = await loadEmployeeFullData(id, companyId)
      if (d) employeesData.push(d)
    }
    if (!employeesData.length) return reply.status(404).send({ success: false, error: 'NO_DATA' })

    const wb = XLSX.utils.book_new()
    const periodoLabel = month && month !== 'tutti' ? month : 'Tutto'

    // Sheet riepilogo
    const riepilogoRows = [['Nome', 'Cognome', 'Ore totali', 'Ore previste', 'Straordinari', 'Assenze', 'Ritardi']]
    for (const { employee, reads, shifts } of employeesData) {
      const months = buildEmployeeData(reads, shifts, !!employee.turni_attivi, employee.turni_attivati_il, month)
      const totOre    = months.reduce((s, m) => s + m.oreTotali, 0)
      const totPrev   = months.reduce((s, m) => s + m.orePreviste, 0)
      const totStraord = months.reduce((s, m) => s + m.straordinario, 0)
      const totAssenze = months.reduce((s, m) => s + m.assenze, 0)
      const totRitardi = months.reduce((s, m) => s + m.ritardi, 0)
      riepilogoRows.push([
        employee.nome, employee.cognome || '',
        formatOre(totOre), formatOre(totPrev), formatOre(totStraord),
        `${totAssenze} gg`, String(totRitardi)
      ])
    }
    const wsR = XLSX.utils.aoa_to_sheet(riepilogoRows)
    wsR['!cols'] = [18,18,14,14,14,12,10].map(w => ({ wch: w }))
    XLSX.utils.book_append_sheet(wb, wsR, 'Riepilogo')

    // Sheet per dipendente
    for (const { employee, reads, shifts } of employeesData) {
      const months = buildEmployeeData(reads, shifts, !!employee.turni_attivi, employee.turni_attivati_il, month)

      const rows = [
        [`${employee.nome} ${employee.cognome || ''}`, '', '', '', '', '', ''],
        [`Periodo: ${periodoLabel}`, '', '', '', '', '', ''],
        [''],
        ['Data', 'Entrate', 'Uscite', 'Ore lavorate', 'Ore previste', 'Straordinari', 'Stato']
      ]

      for (const mese of months) {
        rows.push([mese.name.toUpperCase(), '', '', '', '', '', ''])
        for (const day of mese.giorni) {
          const dataStr = new Date(day.dateStr + 'T00:00:00').toLocaleDateString('it-IT')
          const entrate = day.coppie.map(c => c.entrata).join('  ') || '—'
          const uscite  = day.coppie.map(c => c.uscita).join('  ')  || '—'
          let stato = 'Presente'
          if (day.assente)              stato = 'Assente'
          else if (day.stato === 'straordinario') stato = `+${formatOre(day.straordinarioOre)}`
          else if (day.stato === 'ritardo')       stato = `Ritardo ${day.ritardoMin}m`

          rows.push([
            dataStr, entrate, uscite,
            formatOre(day.oreLavorate),
            formatOre(day.orePreviste),
            day.straordinarioOre > 0 ? formatOre(day.straordinarioOre) : '',
            stato
          ])
        }
        rows.push([
          `Totale ${mese.name}`, '', '',
          formatOre(mese.oreTotali),
          formatOre(mese.orePreviste),
          formatOre(mese.straordinario),
          `Assenze: ${mese.assenze} | Ritardi: ${mese.ritardi}`
        ])
        rows.push([''])
      }

      const ws = XLSX.utils.aoa_to_sheet(rows)
      ws['!cols'] = [16, 12, 12, 14, 14, 14, 20].map(w => ({ wch: w }))
      XLSX.utils.book_append_sheet(wb, ws, `${employee.nome} ${employee.cognome || ''}`.substring(0, 31))
    }

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

    return reply
      .header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
      .header('Content-Disposition', `attachment; filename="ContaOre_${periodoLabel.replace(/\s/g,'_')}.xlsx"`)
      .send(buffer)

  })

}