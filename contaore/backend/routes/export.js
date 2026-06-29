import { supabase } from '../services/supabase.js'
import { authenticate } from '../middleware/auth.js'
import PDFDocument from 'pdfkit'
import XLSX from 'xlsx'
import {
  getLocalDateStr, timeToMinutes, shiftDurationMins, shiftExpectedHours,
  GIORNI, getDayName, computeBreakDeductionMins
} from '../utils/timeHelpers.js'

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

function calcOreGiorno(sorted, dayShifts = []) {
  let ore = 0
  let lastE = null
  sorted.forEach(r => {
    if (r.tipo === 'ENTRATA') lastE = r
    else if (r.tipo === 'USCITA' && lastE) {
      ore += (new Date(r.created_at) - new Date(lastE.created_at)) / 1000 / 60 / 60
      lastE = null
    }
  })
  // detra la pausa aziendale non timbratura per turni doppi
  for (const s of dayShifts) {
    if (s.uscita_1 && s.ingresso_2) {
      const bStart = timeToMinutes(s.uscita_1)
      const bEnd   = timeToMinutes(s.ingresso_2)
      if (bEnd > bStart) {
        const deductMins = computeBreakDeductionMins(sorted, bStart, bEnd)
        ore -= deductMins / 60
      }
    }
  }
  return Math.max(0, ore)
}

function buildCoppie(sorted) {
  const coppie = []
  let lastE = null
  sorted.forEach(r => {
    if (r.tipo === 'ENTRATA') {
      lastE = r
    } else if (r.tipo === 'USCITA') {
      coppie.push({
        entrata:            lastE ? new Date(lastE.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }) : '—',
        uscita:             new Date(r.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }),
        entrata_manuale:    lastE ? !!lastE.manuale : false,
        uscita_manuale:     !!r.manuale,
        entrata_automatica: lastE ? !!lastE.automatica : false,
        uscita_automatica:  !!r.automatica
      })
      lastE = null
    }
  })
  if (lastE) coppie.push({
    entrata:            new Date(lastE.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Rome' }),
    uscita:             '—',
    entrata_manuale:    !!lastE.manuale,
    uscita_manuale:     false,
    entrata_automatica: !!lastE.automatica,
    uscita_automatica:  false
  })
  return coppie
}

/*
  Calcola stato giornaliero rispetto ai turni
  Ritorna: { stato, ritardoMin, straordinarioOre, orePreviste }
*/
function calcStatoGiorno(dateStr, sorted, shifts, turniAttivi, toleranceMins = 10, toleranceDeficitMins = 15) {
  if (!turniAttivi || !shifts.length) {
    const ore = calcOreGiorno(sorted)
    return { stato: 'presente', ritardoMin: 0, straordinarioOre: 0, orePreviste: 0, oreEffettive: ore, oreLavorate: ore }
  }

  const dayName   = getDayName(dateStr)
  const dayShifts = shifts.filter(s => s.giorno_settimana === dayName)

  if (!dayShifts.length) {
    const ore = calcOreGiorno(sorted)
    return { stato: 'presente', ritardoMin: 0, straordinarioOre: 0, orePreviste: 0, oreEffettive: ore, oreLavorate: ore }
  }

  const orePreviste = dayShifts.reduce((sum, s) => sum + shiftExpectedHours(s), 0)
  const oreLavorate = calcOreGiorno(sorted, dayShifts)

  let straordinarioOre = 0
  let oreEffettive = oreLavorate

  if (orePreviste > 0) {
    const extraMins = (oreLavorate - orePreviste) * 60
    if (extraMins > 0) {
      if (extraMins > toleranceMins) {
        straordinarioOre = Number((extraMins / 60).toFixed(2))
      } else {
        oreEffettive = orePreviste
      }
    } else if (extraMins < 0) {
      const deficitMins = -extraMins
      if (deficitMins <= toleranceDeficitMins) {
        oreEffettive = orePreviste
      }
    }
  } else {
    straordinarioOre = Number(oreLavorate.toFixed(2))
  }

  // stato hierarchy
  let stato = 'presente'
  if (straordinarioOre > 0) {
    stato = 'straordinario'
  } else if (orePreviste > 0 && oreLavorate > 0 && oreLavorate < orePreviste) {
    const deficitMins = (orePreviste - oreLavorate) * 60
    if (deficitMins > toleranceDeficitMins) stato = 'parziale'
  }

  // ritardo: prima entrata vs ingresso_1 del primo turno
  let ritardoMin = 0
  const firstShift = dayShifts.filter(s => s.ingresso_1).sort((a, b) => timeToMinutes(a.ingresso_1) - timeToMinutes(b.ingresso_1))[0]
  if (firstShift) {
    const primaEntrata = sorted.find(r => r.tipo === 'ENTRATA')
    if (primaEntrata) {
      const d = new Date(primaEntrata.created_at)
      const entrataMin = d.getHours() * 60 + d.getMinutes()
      const delay = entrataMin - timeToMinutes(firstShift.ingresso_1)
      if (delay > 5) {
        ritardoMin = delay
        if (stato === 'presente' || stato === 'parziale') stato = 'ritardo'
      }
    }
  }

  return { stato, ritardoMin, straordinarioOre, orePreviste, oreEffettive, oreLavorate }
}

/*
  Costruisce dati strutturati per dipendente:
  { months: [{ name, giorni: [...], totali }] }
*/
function buildEmployeeData(reads, shifts, turniAttivi, turniAttivatIl, selectedMonth, ferieApprovate = [], giustificazioni = [], pausaAziendale = null, toleranceMins = 10, toleranceDeficitMins = 15) {

  const isInFerie = (dateStr) => (ferieApprovate || []).some(f => dateStr >= f.data_inizio && dateStr <= f.data_fine)
  const giustSet  = new Set((giustificazioni || []).filter(g => g.stato === 'approvata').map(g => g.data))

  // raggruppa letture per giorno
  const byDay = {}
  reads.forEach(r => {
    const day = getLocalDateStr(r.created_at)
    if (!byDay[day]) byDay[day] = []
    byDay[day].push(r)
  })

  // giorni presenti
  const presentDays = {}
  Object.entries(byDay).forEach(([dateStr, dayReads]) => {
    const sorted = [...dayReads].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    const coppie = buildCoppie(sorted)
    const { stato, ritardoMin, straordinarioOre, orePreviste, oreEffettive, oreLavorate } = calcStatoGiorno(dateStr, sorted, shifts, turniAttivi, toleranceMins, toleranceDeficitMins)

    const meseName = new Date(dateStr + 'T00:00:00').toLocaleDateString('it-IT', {
      month: 'long', year: 'numeric'
    })

    presentDays[dateStr] = { dateStr, meseName, coppie, oreLavorate, oreEffettive, stato, ritardoMin, straordinarioOre, orePreviste, assente: false }
  })

  // giorni assenti
  const absentDays = {}
  if (turniAttivi && shifts.length > 0) {
    const start     = turniAttivatIl ? new Date(turniAttivatIl) : new Date()
    const now       = new Date()
    const nowMins   = now.getHours() * 60 + now.getMinutes()
    const today     = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`
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
          const turnoIniziato = dayShifts.some(s => {
            if (!s.ingresso_1) return false
            return nowMins > timeToMinutes(s.ingresso_1)
          })
          if (!turnoIniziato) { cursor.setDate(cursor.getDate() + 1); continue }
        }

        const meseName = new Date(dateStr + 'T00:00:00').toLocaleDateString('it-IT', {
          month: 'long', year: 'numeric'
        })

        // pausa aziendale → ferie (priorità massima)
        if (pausaAziendale && pausaAziendale.attiva && dateStr >= pausaAziendale.data_inizio && dateStr <= pausaAziendale.data_fine) {
          absentDays[dateStr] = { dateStr, meseName, coppie: [], oreLavorate: 0, stato: 'ferie', ritardoMin: 0, straordinarioOre: 0, orePreviste, assente: false }
        } else if (isInFerie(dateStr)) {
          absentDays[dateStr] = { dateStr, meseName, coppie: [], oreLavorate: 0, stato: 'ferie', ritardoMin: 0, straordinarioOre: 0, orePreviste, assente: false }
        } else if (giustSet.has(dateStr)) {
          absentDays[dateStr] = { dateStr, meseName, coppie: [], oreLavorate: 0, stato: 'giustificata', ritardoMin: 0, straordinarioOre: 0, orePreviste, assente: true }
        } else {
          absentDays[dateStr] = { dateStr, meseName, coppie: [], oreLavorate: 0, stato: 'assente', ritardoMin: 0, straordinarioOre: 0, orePreviste, assente: true }
        }
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
        assenze: 0,
        ritardi: 0
      }
    }
    const m = monthsMap[day.meseName]
    m.giorni.push(day)
    m.oreTotali   += day.oreEffettive ?? day.oreLavorate
    m.orePreviste += day.orePreviste
    if (day.assente)        m.assenze++
    if (day.ritardoMin > 5) m.ritardi++
  })

  // straordinario calcolato a livello mensile come in employees.js:
  // MAX(0, totOreEffettive - totOrePreviste) — così i giorni in deficit bilanciano quelli in surplus
  let months = Object.values(monthsMap).map(m => ({
    ...m,
    oreTotali:    Number(m.oreTotali.toFixed(2)),
    orePreviste:  Number(m.orePreviste.toFixed(2)),
    straordinario: Number(Math.max(0, m.oreTotali - m.orePreviste).toFixed(2))
  }))

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

  const { data: ferieApprovate } = await supabase
    .from('richieste_ferie')
    .select('data_inizio, data_fine')
    .eq('dipendente_id', id)
    .eq('stato', 'approvata')

  const { data: giustificazioni } = await supabase
    .from('giustificazioni')
    .select('data, stato')
    .eq('dipendente_id', id)

  const { data: pausaAziendale } = await supabase
    .from('pausa_aziendale')
    .select('*')
    .eq('company_id', companyId)
    .eq('attiva', true)
    .maybeSingle()

  return { employee, reads: reads || [], shifts: shifts || [], ferieApprovate: ferieApprovate || [], giustificazioni: giustificazioni || [], pausaAziendale: pausaAziendale || null }
}

export default async function exportRoutes(fastify) {

  // ── PDF ──────────────────────────────────────────────────────────────

  fastify.post('/api/export/pdf', { preHandler: authenticate }, async (request, reply) => {

    const { employee_ids, month } = request.body
    const companyId = request.user.company_id

    if (!employee_ids?.length) return reply.status(400).send({ success: false, error: 'MISSING_IDS' })

    const { data: companySettings } = await supabase.from('company').select('tolleranza_straordinario_minuti, tolleranza_difetto_minuti').eq('id', companyId).single()
    const toleranceMins        = companySettings?.tolleranza_straordinario_minuti ?? 10
    const toleranceDeficitMins = companySettings?.tolleranza_difetto_minuti ?? 15

    const results = await Promise.all(employee_ids.map(id => loadEmployeeFullData(id, companyId)))
    const employeesData = results.filter(Boolean)
    if (!employeesData.length) return reply.status(404).send({ success: false, error: 'NO_DATA' })

    const pdfBuffer = await new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 40, size: 'A4' })
      const chunks = []
      doc.on('data', c => chunks.push(c))
      doc.on('end', () => resolve(Buffer.concat(chunks)))
      doc.on('error', reject)

      const periodoLabel = month && month !== 'tutti' ? month : 'Tutto lo storico'
      let isFirst = true

      for (const { employee, reads, shifts, ferieApprovate, giustificazioni, pausaAziendale } of employeesData) {

        if (!isFirst) doc.addPage()
        isFirst = false

        const turniAttivi   = !!employee.turni_attivi
        const turniAttivatIl = employee.turni_attivati_il || null

        const months = buildEmployeeData(reads, shifts, turniAttivi, turniAttivatIl, month, ferieApprovate, giustificazioni, pausaAziendale, toleranceMins, toleranceDeficitMins)

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

            if (day.assente || day.stato === 'ferie' || day.stato === 'giustificata') {
              const isF = day.stato === 'ferie'
              const isG = day.stato === 'giustificata'
              const color = isF ? '#0369a1' : isG ? '#7c3aed' : '#dc2626'
              const label = isF ? 'FERIE' : isG ? 'GIUSTIF.' : 'ASSENTE'
              doc.fillColor(color).text('—', 155, y + 4)
              doc.fillColor(color).text('—', 255, y + 4)
              doc.fillColor('#111').text('—', 350, y + 4)
              doc.fillColor('#111').text(formatOre(day.orePreviste), 400, y + 4)
              doc.fillColor(color).font('Helvetica-Bold').text(label, 455, y + 4)
            } else {
              day.coppie.forEach((c, i) => {
                const entrataLabel = c.entrata_automatica ? ' (A)' : c.entrata_manuale ? ' (M)' : ''
                const uscitaLabel  = c.uscita_automatica  ? ' (A)' : c.uscita_manuale  ? ' (M)' : ''
                const entrataColor = c.entrata_automatica ? '#7c3aed' : c.entrata_manuale ? '#d97706' : '#111'
                const uscitaColor  = c.uscita_automatica  ? '#7c3aed' : c.uscita_manuale  ? '#d97706' : '#111'
                doc.fillColor(entrataColor).font('Helvetica')
                  .text(c.entrata + entrataLabel, 155, y + 4 + i * 12)
                doc.fillColor(uscitaColor).font('Helvetica')
                  .text(c.uscita + uscitaLabel, 255, y + 4 + i * 12)
              })
              doc.fillColor('#111').text(formatOre(day.oreLavorate), 350, y + 4)
              doc.fillColor('#6b7280').text(formatOre(day.orePreviste), 400, y + 4)

              // stato colorato
              if (day.stato === 'assente') {
                doc.fillColor('#dc2626').font('Helvetica-Bold').text('ASSENTE', 455, y + 4)
              } else if (day.stato === 'ferie') {
                doc.fillColor('#0369a1').font('Helvetica-Bold').text('FERIE', 455, y + 4)
              } else if (day.stato === 'giustificata') {
                doc.fillColor('#7c3aed').font('Helvetica-Bold').text('GIUSTIF.', 455, y + 4)
              } else if (day.stato === 'parziale') {
                doc.fillColor('#ea580c').font('Helvetica-Bold').text('Parziale', 455, y + 4)
              } else if (day.stato === 'ritardo') {
                doc.fillColor('#a855f7').font('Helvetica-Bold')
                  .text(`Rit. ${day.ritardoMin}m`, 455, y + 4)
              } else {
                // presente o straordinario: mostra sempre "Presente" + eventuale overtime
                doc.fillColor('#15803d').font('Helvetica').text('Presente', 455, y + 4)
                if (day.straordinarioOre > 0) {
                  doc.fillColor('#d97706').font('Helvetica-Bold')
                    .text(` +${formatOre(day.straordinarioOre)}`, 455, y + 4 + 10)
                }
              }
            }

            y += rowH
            rowIndex++
          }

          y += 14
        }

        // ─── SEZIONE FIRMA ────────────────────────────────────────────────
        const signH = 140
        if (y + signH > doc.page.height - 40) {
          doc.addPage()
          y = 40
        }

        y += 20
        doc.moveTo(40, y).lineTo(555, y).strokeColor('#e5e7eb').lineWidth(1).stroke()
        y += 16

        doc.fillColor('#111').font('Helvetica-Bold').fontSize(9)
          .text('PRESA VISIONE', 40, y)
        doc.font('Helvetica').fillColor('#6b7280').fontSize(8)
          .text(`Data: ______ / ______ / __________`, 40, y + 14)

        y += 40

        // box firma titolare (sinistra)
        doc.rect(40, y, 240, 60).strokeColor('#d1d5db').lineWidth(0.8).stroke()
        doc.fillColor('#6b7280').font('Helvetica').fontSize(8)
          .text('FIRMA TITOLARE', 40, y + 6, { width: 240, align: 'center' })
        doc.moveTo(60, y + 46).lineTo(260, y + 46).strokeColor('#9ca3af').lineWidth(0.5).stroke()

        // box firma dipendente (destra)
        doc.rect(315, y, 240, 60).strokeColor('#d1d5db').lineWidth(0.8).stroke()
        doc.fillColor('#6b7280').font('Helvetica').fontSize(8)
          .text('FIRMA DIPENDENTE', 315, y + 6, { width: 240, align: 'center' })
        doc.moveTo(335, y + 46).lineTo(535, y + 46).strokeColor('#9ca3af').lineWidth(0.5).stroke()

        y += 70
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

    const { data: companySettingsXls } = await supabase.from('company').select('tolleranza_straordinario_minuti, tolleranza_difetto_minuti').eq('id', companyId).single()
    const toleranceMins        = companySettingsXls?.tolleranza_straordinario_minuti ?? 10
    const toleranceDeficitMins = companySettingsXls?.tolleranza_difetto_minuti ?? 15

    const resultsXls = await Promise.all(employee_ids.map(id => loadEmployeeFullData(id, companyId)))
    const employeesData = resultsXls.filter(Boolean)
    if (!employeesData.length) return reply.status(404).send({ success: false, error: 'NO_DATA' })

    const wb = XLSX.utils.book_new()
    const periodoLabel = month && month !== 'tutti' ? month : 'Tutto'

    // Sheet riepilogo
    const riepilogoRows = [['Nome', 'Cognome', 'Ore totali', 'Ore previste', 'Straordinari', 'Assenze', 'Ritardi']]
    for (const { employee, reads, shifts, ferieApprovate, giustificazioni, pausaAziendale } of employeesData) {
      const months = buildEmployeeData(reads, shifts, !!employee.turni_attivi, employee.turni_attivati_il, month, ferieApprovate, giustificazioni, pausaAziendale, toleranceMins, toleranceDeficitMins)
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
    for (const { employee, reads, shifts, ferieApprovate, giustificazioni, pausaAziendale } of employeesData) {
      const months = buildEmployeeData(reads, shifts, !!employee.turni_attivi, employee.turni_attivati_il, month, ferieApprovate, giustificazioni, pausaAziendale, toleranceMins, toleranceDeficitMins)

      const rows = [
        [`${employee.nome} ${employee.cognome || ''}`, '', '', '', '', '', ''],
        [`Periodo: ${periodoLabel}`, '', '', '', '', '', ''],
        ['Legenda: (M) = Manuale  (A) = Automatica', '', '', '', '', '', ''],
        [''],
        ['Data', 'Entrate', 'Uscite', 'Ore lavorate', 'Ore previste', 'Straordinari', 'Stato']
      ]

      for (const mese of months) {
        rows.push([mese.name.toUpperCase(), '', '', '', '', '', ''])
        for (const day of mese.giorni) {
          const dataStr = new Date(day.dateStr + 'T00:00:00').toLocaleDateString('it-IT')
          const entrate = day.coppie.map(c => {
            const label = c.entrata_automatica ? ' (A)' : c.entrata_manuale ? ' (M)' : ''
            return c.entrata + label
          }).join('  ') || '—'
          const uscite = day.coppie.map(c => {
            const label = c.uscita_automatica ? ' (A)' : c.uscita_manuale ? ' (M)' : ''
            return c.uscita + label
          }).join('  ') || '—'
          let stato = 'Presente'
          if (day.stato === 'ferie')             stato = 'Ferie'
          else if (day.stato === 'giustificata') stato = 'Giustificata'
          else if (day.assente)                  stato = 'Assente'
          else if (day.stato === 'parziale')     stato = 'Parziale'
          else if (day.stato === 'ritardo')      stato = `Ritardo ${day.ritardoMin}m`
          if (day.straordinarioOre > 0)          stato += ` +${formatOre(day.straordinarioOre)}`

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