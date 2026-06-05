import { supabase } from '../services/supabase.js'
import latestReads from '../state/LatestReads.js'

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

        if (!reader_id) {
          return reply.send({ success: false, error: 'MISSING_FIELDS' })
        }

        // SECURITY FIX: Check if reader exists
        const { data: existingReader, error: readerError } = await supabase
          .from('dispositivo')
          .select('company_id')
          .eq('reader_id', reader_id)
          .maybeSingle()

        // If reader doesn't exist, use company_id from request to create it
        // (only for first registration from hardware)
        if (!existingReader) {

          if (!company_id) {
            return reply.send({ success: false, error: 'MISSING_FIELDS' })
          }

          const { error } = await supabase
            .from('dispositivo')
            .insert({
              company_id,
              reader_id,
              firmware_version: firmware || null,
              sede:             sede     || null,
              nfc_ok:           nfc_ok   ?? null,
              display_ok:       display_ok ?? null,
              ultimo_ping:      new Date(),
              stato:            'online'
            })

          if (error) console.log('insert dispositivo error:', error)

        } else {

          // Validate company_id from request matches reader's registered company_id
          if (company_id && company_id !== existingReader.company_id) {
            return reply.send({ success: false, error: 'COMPANY_MISMATCH' })
          }

          // Minimal guaranteed update — ultimo_ping always refreshed
          const { error } = await supabase
            .from('dispositivo')
            .update({ ultimo_ping: new Date(), stato: 'online' })
            .eq('reader_id', reader_id)

          if (error) console.log('update dispositivo error:', error)

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
              .eq('reader_id', reader_id)
            if (extErr) console.log('extended fields update skipped (migration pending):', extErr.message)
          }

        }

        return reply.send({ success: true })

      } catch (err) {

        console.log(err)
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

        // Validate that reader exists and get its company_id
        const { data: reader, error: readerError } = await supabase
          .from('dispositivo')
          .select('company_id')
          .eq('reader_id', reader_id)
          .maybeSingle()

        // Reader must exist and have a company_id association
        if (readerError || !reader) {
          return reply.send({
            success: false,
            error: 'READER_NOT_FOUND'
          })
        }

        // Validate company_id from request matches reader's registered company_id
        if (company_id !== reader.company_id) {
          return reply.send({
            success: false,
            error: 'COMPANY_MISMATCH'
          })
        }

        const readerCompanyId = reader.company_id

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
          .eq('company_id', readerCompanyId)
          .maybeSingle()

        /*
          SALVA SEMPRE L'ULTIMA LETTURA IN MEMORIA
          serve per la registrazione badge
        */

        latestReads[readerCompanyId] = {
          uid,
          reader_id,
          timestamp: Date.now()
        }

        global.lastRead = {
          uid,
          created_at: new Date().toISOString()
        }

        if (!dipendente) {
          console.log('TAG NON ASSOCIATO A NESSUN DIPENDENTE:', uid)
          return reply.send({
            success: true,
            tipo:    null,
            error:   'TAG_NOT_REGISTERED'
          })
        }

        console.log('DIPENDENTE:', dipendente.nome, dipendente.cognome)
        console.log('DATA LETTURA:', readDate.toISOString())

        /*
          CARICA FASCE ORARIE AZIENDA
        */

        const { data: fasce } = await supabase
          .from('fasce_orarie')
          .select('*')
          .eq('company_id', readerCompanyId)
          .order('ora_inizio', { ascending: true })

        /*
          ULTIMA TIMBRATURA DI QUESTO TAG
          prima della data di questa lettura
        */

        const { data: lastPresence } = await supabase
          .from('presenza')
          .select('tipo, created_at')
          .eq('tag_uid', uid)
          .eq('company_id', readerCompanyId)
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
              console.log('SECONDA LETTURA IN FASCIA → inverso:', tipo)
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

          console.log('FUORI FASCIA → tipo da ultima timbratura:', tipo)

        }

        console.log('FASCIA ATTIVA:', fasciaAttiva?.nome || 'nessuna')
        console.log('ULTIMA TIMBRATURA:', lastPresence?.tipo || 'nessuna')
        console.log('TIPO FINALE:', tipo)

        /*
          SALVA PRESENZA CON TIMESTAMP REALE
        */

        const { data: insertedPresence, error: insertError } = await supabase
          .from('presenza')
          .insert({
            company_id: readerCompanyId,
            tag_uid:    uid,
            reader_id,
            tipo,
            created_at: readDate.toISOString(),
            timestamp:  readDate.toISOString()
          })
          .select()

        if (insertError) {
          console.log('insert presenza error:', insertError)
          return reply.send({ success: false, error: insertError.message })
        }

        console.log('SALVATO:', insertedPresence)

        /*
          UPDATE READER ULTIMO PING
        */

        await supabase
          .from('dispositivo')
          .update({ ultimo_ping: new Date(), stato: 'online' })
          .eq('reader_id', reader_id)

        return reply.send({
          success:    true,
          tipo,
          fascia:     fasciaAttiva?.nome || null,
          dipendente: `${dipendente.nome} ${dipendente.cognome}`
        })

      } catch (err) {

        console.log(err)
        return reply.send({ success: false })

      }

    }
  )

}
