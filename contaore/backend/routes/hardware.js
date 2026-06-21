import { supabase } from '../services/supabase.js'
import latestReads from '../state/LatestReads.js'
import { onComponenteErrore } from '../services/notifiche.js'

/*
────────────────────────────────────
HELPERS
────────────────────────────────────
*/

function timeToMinutes(timeStr) {
  if (!timeStr) return null
  const parts = timeStr.split(':')
  return parseInt(parts[0]) * 60 + parseInt(parts[1])
}

function nowMinutes() {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

async function autoInsertBreakTimbrature(dipendenteId, companyId, tagUid, todayReads, shift, dateStr) {
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

function getFasciaAttiva(fasce, refDate = null) {
  const d   = refDate ? new Date(refDate) : new Date()
  const now = d.getHours() * 60 + d.getMinutes()
  for (const fascia of fasce) {
    const inizio = timeToMinutes(fascia.ora_inizio)
    const fine   = timeToMinutes(fascia.ora_fine)
    if (inizio !== null && fine !== null && now >= inizio && now <= fine) {
      return fascia
    }
  }
  return null
}

/*
────────────────────────────────────
ROUTES
────────────────────────────────────
*/

export default async function hardwareRoutes(fastify) {

  /*
    HEARTBEAT READER
  */

  fastify.post(
    '/api/hardware/ping',
    async (request, reply) => {

      try {

        const { reader_id, company_id, firmware, sede, nfc_ok, display_ok } = request.body

        if (!reader_id || !company_id) {
          return reply.send({ success: false, error: 'MISSING_FIELDS' })
        }

        // reader_id is unique per company, not globally
        const { data: existingReader, error: readerError } = await supabase
          .from('dispositivo')
          .select('*')
          .eq('reader_id', reader_id)
          .eq('company_id', company_id)
          .maybeSingle()

        if (!existingReader) {

          // Insert only guaranteed columns — avoids failures if optional columns
          // (firmware_version, sede, nfc_ok, display_ok) don't exist yet in the table
          const { error } = await supabase
            .from('dispositivo')
            .insert({
              company_id,
              reader_id,
              ultimo_ping: new Date(),
              stato:       'online'
            })

          if (error) {
            console.error('insert dispositivo error:', error)
            return reply.send({ success: false, error: 'DB_ERROR' })
          } else {
            // Try extended fields in a separate update — silently skip if columns missing
            const extFields = {}
            if (firmware   !== undefined) extFields.firmware_version = firmware   || null
            if (sede       !== undefined) extFields.sede              = sede       || null
            if (nfc_ok     !== undefined) extFields.nfc_ok            = nfc_ok    ?? null
            if (display_ok !== undefined) extFields.display_ok        = display_ok ?? null
            if (Object.keys(extFields).length > 0) {
              await supabase.from('dispositivo').update(extFields)
                .eq('reader_id', reader_id).eq('company_id', company_id)
                .catch(() => {})
            }
          }

        } else {

          // Minimal guaranteed update — ultimo_ping always refreshed
          const { error } = await supabase
            .from('dispositivo')
            .update({ ultimo_ping: new Date(), stato: 'online' })
            .eq('reader_id', reader_id).eq('company_id', company_id)

          if (error) console.error('update dispositivo error:', error)

          // Extended fields — silently ignored if columns don't exist yet (run migration)
          const extFields = {}
          if (firmware   !== undefined) extFields.firmware_version = firmware
          if (sede       !== undefined) extFields.sede              = sede
          if (nfc_ok     !== undefined) extFields.nfc_ok            = nfc_ok
          if (display_ok !== undefined) extFields.display_ok        = display_ok

          if (Object.keys(extFields).length > 0) {
            const { error: extErr } = await supabase
              .from('dispositivo')
              .update(extFields)
              .eq('reader_id', reader_id).eq('company_id', company_id)
            if (extErr) console.error('extended fields update skipped (migration pending):', extErr.message)
          }

          // Rilevamento componente guasto — avviso SUBITO solo sulla transizione ok→errore
          // (evita spam: scatta una volta quando il componente smette di funzionare)
          const nfcJustFailed     = nfc_ok     === false && existingReader.nfc_ok     !== false
          const displayJustFailed = display_ok === false && existingReader.display_ok !== false
          if (nfcJustFailed || displayJustFailed) {
            const issues = [
              nfc_ok     === false ? 'NFC ERRORE'     : null,
              display_ok === false ? 'Display ERRORE' : null,
            ].filter(Boolean).join(', ')
            // fire-and-forget — non blocca la risposta al lettore
            onComponenteErrore({
              companyId:  existingReader.company_id,
              nomeReader: existingReader.nome || reader_id,
              issues
            })
          }

        }

        // OTA solo se il dispositivo ha ota_pending = true
        let otaPayload = {}
        if (existingReader?.ota_pending) {
          const { data: otaRelease } = await supabase
            .from('ota_release')
            .select('version, url')
            .eq('attivo', true)
            .eq('id', 1)
            .maybeSingle()

          if (otaRelease) {
            // Resetta il flag prima di rispondere — evita loop infiniti
            await supabase
              .from('dispositivo')
              .update({ ota_pending: false })
              .eq('reader_id', reader_id).eq('company_id', company_id)

            otaPayload = { ota_version: otaRelease.version, ota_url: otaRelease.url }
          }
        }

        return reply.send({ success: true, ...otaPayload })

      } catch (err) {

        console.error(err)
        return reply.send({ success: false })

      }

    }
  )

  /*
    TAG READ
  */

  fastify.post(
    '/api/hardware/tag',
    async (request, reply) => {

      try {

        const {
          uid,
          reader_id,
          company_id,
          timestamp   // opzionale — mandato dalle letture offline
        } = request.body

        if (!uid || !reader_id || !company_id) {
          return reply.send({ success: false, error: 'MISSING_FIELDS' })
        }

        // reader_id is unique per company — validate reader exists for this specific company
        const { data: reader, error: readerError } = await supabase
          .from('dispositivo')
          .select('id')
          .eq('reader_id', reader_id)
          .eq('company_id', company_id)
          .maybeSingle()

        if (readerError || !reader) {
          return reply.send({
            success: false,
            error: 'READER_NOT_FOUND'
          })
        }

        /*
          DATA EFFETTIVA DELLA LETTURA
          se offline usa il timestamp mandato dal device
          altrimenti usa now
        */
        const readDate = timestamp ? new Date(timestamp) : new Date()

        /*
          CONTROLLA CHE IL TAG SIA
          ASSOCIATO AD UN DIPENDENTE
        */

        const { data: dipendente } = await supabase
          .from('dipendenti')
          .select('id, nome, cognome')
          .eq('badge_uid', uid)
          .eq('company_id', company_id)
          .maybeSingle()

        /*
          SALVA SEMPRE L'ULTIMA LETTURA IN MEMORIA
          serve per la registrazione badge
        */

        latestReads[company_id] = {
          uid,
          reader_id,
          timestamp: Date.now()
        }

        global.lastRead = {
          uid,
          created_at: new Date().toISOString()
        }

        if (!dipendente) {
          return reply.send({
            success: true,
            tipo:    null,
            error:   'TAG_NOT_REGISTERED'
          })
        }

        /*
          CARICA FASCE ORARIE AZIENDA
        */

        const { data: fasce } = await supabase
          .from('fasce_orarie')
          .select('*')
          .eq('company_id', company_id)
          .order('ora_inizio', { ascending: true })

        /*
          ULTIMA TIMBRATURA DI QUESTO TAG
          prima della data di questa lettura
        */

        const { data: lastPresence } = await supabase
          .from('presenza')
          .select('tipo, created_at')
          .eq('tag_uid', uid)
          .eq('company_id', company_id)
          .lt('created_at', readDate.toISOString())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        /*
          LOGICA TIPO
          usa la fascia attiva al momento della lettura reale
        */

        let tipo = 'ENTRATA'

        const fasciaAttiva =
          fasce && fasce.length > 0
            ? getFasciaAttiva(fasce, readDate)
            : null

        if (fasciaAttiva) {

          tipo = fasciaAttiva.tipo

          if (lastPresence && lastPresence.tipo === fasciaAttiva.tipo) {

            const lastTime    = new Date(lastPresence.created_at)
            const lastMinutes = lastTime.getHours() * 60 + lastTime.getMinutes()
            const inizio      = timeToMinutes(fasciaAttiva.ora_inizio)
            const fine        = timeToMinutes(fasciaAttiva.ora_fine)
            const eraInFascia = lastMinutes >= inizio && lastMinutes <= fine

            if (eraInFascia) {
              tipo = tipo === 'ENTRATA' ? 'USCITA' : 'ENTRATA'
            }

          }

        } else {

          if (lastPresence?.tipo === 'ENTRATA') {
            tipo = 'USCITA'
          } else if (lastPresence?.tipo === 'USCITA') {
            tipo = 'ENTRATA'
          } else {
            tipo = 'ENTRATA'
          }

        }

        /*
          SALVA PRESENZA CON TIMESTAMP REALE
        */

        const { data: insertedPresence, error: insertError } = await supabase
          .from('presenza')
          .insert({
            company_id: company_id,
            tag_uid:    uid,
            reader_id,
            tipo,
            created_at: readDate.toISOString(),
            timestamp:  readDate.toISOString()
          })
          .select()

        if (insertError) {
          console.error('insert presenza error:', insertError)
          return reply.send({ success: false, error: insertError.message })
        }

        // Auto-insert missing break timbrature when a final USCITA is saved
        if (tipo === 'USCITA' && dipendente) {
          try {
            const dateStr = `${readDate.getFullYear()}-${String(readDate.getMonth()+1).padStart(2,'0')}-${String(readDate.getDate()).padStart(2,'0')}`
            const readMins = readDate.getHours() * 60 + readDate.getMinutes()
            const { data: dip } = await supabase.from('dipendenti').select('id, turni_attivi').eq('badge_uid', uid).eq('company_id', company_id).maybeSingle()
            if (dip?.turni_attivi) {
              const { data: shifts } = await supabase.from('turni').select('*').eq('dipendente_id', dip.id)
              const dow = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato'][readDate.getDay()]
              const dayShift = (shifts || []).find(s => s.giorno_settimana === dow && s.uscita_1 && s.ingresso_2)
              if (dayShift && readMins >= timeToMinutes(dayShift.ingresso_2)) {
                const { data: todayReads } = await supabase.from('presenza').select('tipo, created_at')
                  .eq('tag_uid', uid).eq('company_id', company_id)
                  .gte('created_at', `${dateStr}T00:00:00`).lte('created_at', `${dateStr}T23:59:59`)
                  .order('created_at', { ascending: true })
                await autoInsertBreakTimbrature(dip.id, company_id, uid, todayReads || [], dayShift, dateStr)
              }
            }
          } catch (_) {}
        }

        /*
          UPDATE READER ULTIMO PING
        */

        await supabase
          .from('dispositivo')
          .update({ ultimo_ping: new Date(), stato: 'online' })
          .eq('reader_id', reader_id).eq('company_id', company_id)

        return reply.send({
          success:    true,
          tipo,
          fascia:     fasciaAttiva?.nome || null,
          dipendente: `${dipendente.nome} ${dipendente.cognome}`
        })

      } catch (err) {

        console.error(err)
        return reply.send({ success: false })

      }

    }
  )

}
