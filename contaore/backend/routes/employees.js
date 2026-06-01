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

function shiftExpectedHours(shift) {
  let mins = 0
  if (shift.ingresso_1 && shift.uscita_1) {
    mins += timeToMinutes(shift.uscita_1) - timeToMinutes(shift.ingresso_1)
  }
  if (shift.ingresso_2 && shift.uscita_2) {
    mins += timeToMinutes(shift.uscita_2) - timeToMinutes(shift.ingresso_2)
  }
  return Number((Math.max(0, mins) / 60).toFixed(2))
}

function isEmployeeInside(reads = []) {
  if (!reads.length) return false
  const today = new Date().toISOString().split('T')[0]
  const todayReads = reads.filter(r =>
    new Date(r.created_at).toISOString().split('T')[0] === today
  )
  if (!todayReads.length) return false
  return todayReads[todayReads.length - 1].tipo === 'ENTRATA'
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

function getLocalDateStr(dateStr) {
  return new Date(dateStr).toISOString().split('T')[0]
}

function buildCoppie(sorted) {
  const coppie = []
  let i = 0
  while (i < sorted.length) {
    if (sorted[i].tipo === 'ENTRATA') {
      const entrata = sorted[i]
      const uscita  = sorted[i + 1]?.tipo === 'USCITA' ? sorted[i + 1] : null
      coppie.push({
        entrata:          new Date(entrata.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        uscita:           uscita ? new Date(uscita.created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : null,
        entrata_id:       entrata.id,
        uscita_id:        uscita?.id || null,
        entrata_manuale:  !!entrata.manuale,
        uscita_manuale:   uscita ? !!uscita.manuale : false
      })
      i += uscita ? 2 : 1
    } else {
      coppie.push({
        entrata:          null,
        uscita:           new Date(sorted[i].created_at).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
        entrata_id:       null,
        uscita_id:        sorted[i].id,
        entrata_manuale:  false,
        uscita_manuale:   !!sorted[i].manuale
      })
      i++
    }
  }
  return coppie
}

function isInFerie(dateStr, ferie = []) {
  return ferie.some(f => dateStr >= f.data_inizio && dateStr <= f.data_fine)
}

function groupByDay(reads = [], shifts = [], turniAttivi = false, dataInizio = null, ferieApprovate = [], giustificazioni = [], pausaAziendale = null) {

  const grouped = {}
  reads.forEach(read => {
    const day = getLocalDateStr(read.created_at)
    if (!grouped[day]) grouped[day] = []
    grouped[day].push(read)
  })

  const presentDays = Object.entries(grouped).map(([giorno, items]) => {
    const sorted      = [...items].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
    const oreLavorate = calculateHours(sorted)

    let ore_previste      = 0
    let ore_straordinario = 0
    let stato             = 'presente'

    if (turniAttivi && shifts.length > 0) {
      const dayName   = getDayName(giorno)
      const dayShifts = shifts.filter(s => s.giorno_settimana === dayName)
      ore_previste    = dayShifts.reduce((sum, s) => sum + shiftExpectedHours(s), 0)
      if (ore_previste > 0) {
        // giorno con turno programmato: straordinario = ore in più rispetto al turno
        ore_straordinario = Number(Math.max(0, oreLavorate - ore_previste).toFixed(2))
      } else {
        // giorno SENZA turno programmato: tutte le ore lavorate sono straordinario
        ore_straordinario = Number(oreLavorate.toFixed(2))
      }
      if (ore_straordinario > 0) stato = 'straordinario'
    }

    return {
      giorno,
      coppie:           buildCoppie(sorted),
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

    const presentSet = new Set(Object.keys(grouped))
    const shiftDays  = new Set(shifts.map(s => s.giorno_settimana))

    const cursor = new Date(start)
    cursor.setHours(0, 0, 0, 0)

    while (cursor <= endDate) {

      // usa la data locale non UTC per evitare offset timezone
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
          // oggi: segna assente solo se almeno un turno e gia finito
          const turnoFinito = dayShifts.some(s => {
            const fine = timeToMinutes(s.uscita_1)
            return fine !== null && nowMins > fine
          })
          if (!turnoFinito) {
            cursor.setDate(cursor.getDate() + 1)
            continue
          }
        }

        // pausa aziendale → ferie (priorità massima)
        if (pausaAziendale && pausaAziendale.attiva && dateStr >= pausaAziendale.data_inizio && dateStr <= pausaAziendale.data_fine) {
          absentDays.push({ giorno: dateStr, coppie: [], ore_totali: 0, ore_previste, ore_straordinario: 0, stato: 'ferie', assente: false })
        } else if (isInFerie(dateStr, ferieApprovate)) {
          // ferie approvate
          absentDays.push({ giorno: dateStr, coppie: [], ore_totali: 0, ore_previste, ore_straordinario: 0, stato: 'ferie', assente: false })
        } else if (giustificazioni.some(g => g.stato === 'approvata' && g.data === dateStr)) {
          // giustificazione approvata: assente ma giustificata
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

          let assente = false

          if (emp.turni_attivi && !presente) {

            const empShifts = (allShifts || []).filter(
              s => s.dipendente_id === emp.id &&
                   s.giorno_settimana === todayName
            )

            if (empShifts.length > 0) {

              assente = empShifts.some(s => {
                if (!s.ingresso_1 || !s.uscita_1) return false
                const inizio = timeToMinutes(s.ingresso_1)
                const fine   = timeToMinutes(s.uscita_1)
                return nowMins >= inizio && nowMins <= fine
              })

            }

          }

          return {
            ...emp,
            attivo:  presente,
            assente,
            stats: {
              total_reads: empReads.length,
              today_reads: todayReads.length,
              month_reads: monthReads.length,
              total_hours: calculateHours(monthReads),  // ore del mese corrente
              last_read:   empReads.length
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