import { supabase } from '../services/supabase.js'
import { authenticate } from '../middleware/auth.js'
import PDFDocument from 'pdfkit'

function formatOre(h) {
  if (!h || h === 0) return '0m'
  const ore = Math.floor(h)
  const min = Math.round((h - ore) * 60)
  if (ore === 0) return `${min}m`
  if (min === 0) return `${ore}h`
  return `${ore}h ${min}m`
}

export default async function exportRoutes(fastify) {

  fastify.post(
    '/api/export/pdf',
    { preHandler: authenticate },
    async (request, reply) => {

      const { employee_ids, month } = request.body
      const companyId = request.user.company_id

      if (!employee_ids || !employee_ids.length) {
        return reply.status(400).send({ success: false, error: 'MISSING_IDS' })
      }

      // carica dati dipendenti
      const employeesData = []

      for (const id of employee_ids) {
        const { data: employee } = await supabase
          .from('dipendenti').select('*')
          .eq('id', id).eq('company_id', companyId).single()
        if (!employee) continue

        const { data: reads } = await supabase
          .from('presenza').select('*')
          .eq('tag_uid', employee.badge_uid).eq('company_id', companyId)
          .order('created_at', { ascending: true })

        employeesData.push({ employee, reads: reads || [] })
      }

      if (!employeesData.length) {
        return reply.status(404).send({ success: false, error: 'NO_DATA' })
      }

      // genera PDF in buffer tramite Promise
      const pdfBuffer = await new Promise((resolve, reject) => {
        const doc = new PDFDocument({ margin: 40, size: 'A4' })
        const chunks = []
        doc.on('data', chunk => chunks.push(chunk))
        doc.on('end', () => resolve(Buffer.concat(chunks)))
        doc.on('error', reject)

        const periodoLabel = month && month !== 'tutti' ? month : 'Tutto lo storico'
        let isFirst = true

        for (const { employee, reads } of employeesData) {

          if (!isFirst) doc.addPage()
          isFirst = false

          // header
          doc.rect(40, 40, 515, 50).fill('#111827')
          doc.fillColor('white').fontSize(18).font('Helvetica-Bold')
            .text(`${employee.nome} ${employee.cognome || ''}`, 55, 53)
          doc.fontSize(9).font('Helvetica')
            .text(`Periodo: ${periodoLabel}`, 55, 76)
            .text(`Esportato il: ${new Date().toLocaleDateString('it-IT')}`, 380, 76)

          doc.fillColor('black')
          let y = 105

          // raggruppa per mese
          const grouped = {}
          reads.forEach(r => {
            const key = new Date(r.created_at).toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })
            if (!grouped[key]) grouped[key] = []
            grouped[key].push(r)
          })

          let months = Object.entries(grouped)
          if (month && month !== 'tutti') {
            months = months.filter(([key]) => key === month)
          }

          if (months.length === 0) {
            doc.fontSize(10).fillColor('#6b7280')
              .text('Nessuna presenza nel periodo selezionato.', 55, y)
            continue
          }

          // totali
          let totalOre = 0
          months.forEach(([, dayReads]) => {
            let lastE = null
            dayReads.forEach(r => {
              if (r.tipo === 'ENTRATA') lastE = r
              else if (r.tipo === 'USCITA' && lastE) {
                totalOre += (new Date(r.created_at) - new Date(lastE.created_at)) / 1000 / 60 / 60
                lastE = null
              }
            })
          })

          // box riepilogo
          doc.rect(40, y, 515, 45).fill('#f9fafb').stroke('#e5e7eb')
          doc.fillColor('#6b7280').fontSize(8).font('Helvetica')
            .text('ORE TOTALI', 55, y + 8)
            .text('GIORNI CON PRESENZE', 220, y + 8)
            .text('MESI', 420, y + 8)
          doc.fillColor('#111').fontSize(14).font('Helvetica-Bold')
            .text(formatOre(totalOre), 55, y + 20)
            .text(String(new Set(reads.map(r => r.created_at.split('T')[0])).size), 220, y + 20)
            .text(String(months.length), 420, y + 20)

          y += 60

          for (const [meseName, monthReads] of months) {

            if (y > 700) { doc.addPage(); y = 40 }

            doc.fillColor('#4f46e5').fontSize(12).font('Helvetica-Bold')
              .text(meseName.charAt(0).toUpperCase() + meseName.slice(1), 40, y)
            y += 18

            // raggruppa per giorno
            const byDay = {}
            monthReads.forEach(r => {
              const day = new Date(r.created_at).toISOString().split('T')[0]
              if (!byDay[day]) byDay[day] = []
              byDay[day].push(r)
            })

            // intestazione tabella
            doc.rect(40, y, 515, 18).fill('#4f46e5')
            doc.fillColor('white').fontSize(8).font('Helvetica-Bold')
              .text('DATA', 50, y + 5)
              .text('ENTRATE', 160, y + 5)
              .text('USCITE', 280, y + 5)
              .text('ORE', 390, y + 5)
              .text('STATO', 460, y + 5)
            y += 18

            let rowIndex = 0

            for (const [dateStr, dayReads] of Object.entries(byDay).sort()) {

              if (y > 720) { doc.addPage(); y = 40 }

              const sorted = [...dayReads].sort((a, b) =>
                new Date(a.created_at) - new Date(b.created_at))

              // coppie
              const coppie = []
              let lastE = null
              sorted.forEach(r => {
                if (r.tipo === 'ENTRATA') {
                  lastE = r
                } else if (r.tipo === 'USCITA') {
                  coppie.push({
                    entrata: lastE
                      ? new Date(lastE.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
                      : '—',
                    uscita: new Date(r.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })
                  })
                  lastE = null
                }
              })
              if (lastE) {
                coppie.push({
                  entrata: new Date(lastE.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
                  uscita: '—'
                })
              }

              // ore giorno
              let oreGiorno = 0
              let lastEnt = null
              sorted.forEach(r => {
                if (r.tipo === 'ENTRATA') lastEnt = r
                else if (r.tipo === 'USCITA' && lastEnt) {
                  oreGiorno += (new Date(r.created_at) - new Date(lastEnt.created_at)) / 1000 / 60 / 60
                  lastEnt = null
                }
              })

              const rowH = Math.max(18, coppie.length * 14)
              const bg = rowIndex % 2 === 0 ? '#ffffff' : '#f9fafb'
              doc.rect(40, y, 515, rowH).fill(bg)

              const dataLabel = new Date(dateStr + 'T00:00:00').toLocaleDateString('it-IT', {
                weekday: 'short', day: '2-digit', month: 'short'
              })

              doc.fillColor('#111').fontSize(8).font('Helvetica')
                .text(dataLabel, 50, y + 4, { width: 100 })

              coppie.forEach((c, i) => {
                doc.text(c.entrata, 160, y + 4 + i * 12)
                doc.text(c.uscita, 280, y + 4 + i * 12)
              })

              doc.text(formatOre(oreGiorno), 390, y + 4)
              doc.fillColor('#15803d').text('Presente', 460, y + 4)

              y += rowH
              rowIndex++
            }

            y += 12
          }
        }

        doc.end()
      })

      return reply
        .header('Content-Type', 'application/pdf')
        .header('Content-Disposition', `attachment; filename="ContaOre_${month || 'storico'}.pdf"`)
        .send(pdfBuffer)

    }
  )

}