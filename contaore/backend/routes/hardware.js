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

function getFasciaAttiva(fasce) {
  const now = nowMinutes()
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

        const { reader_id, company_id, firmware } = request.body

        if (!reader_id || !company_id) {
          return reply.send({ success: false, error: 'MISSING_FIELDS' })
        }

        const { data: existingReader } = await supabase
          .from('dispositivo')
          .select('id')
          .eq('reader_id', reader_id)
          .maybeSingle()

        if (!existingReader) {

          const { error } = await supabase
            .from('dispositivo')
            .insert({
              company_id,
              reader_id,
              firmware:    firmware || null,
              ultimo_ping: new Date(),
              stato:       'online'
            })

          if (error) console.log('insert dispositivo error:', error)

        } else {

          const { error } = await supabase
            .from('dispositivo')
            .update({
              firmware:    firmware || null,
              ultimo_ping: new Date(),
              stato:       'online'
            })
            .eq('reader_id', reader_id)

          if (error) console.log('update dispositivo error:', error)

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

        const { uid, reader_id, company_id } = request.body

        if (!uid || !reader_id || !company_id) {
          return reply.send({ success: false, error: 'MISSING_FIELDS' })
        }

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
          console.log('TAG NON ASSOCIATO A NESSUN DIPENDENTE:', uid)
          return reply.send({
            success: true,
            tipo:    null,
            error:   'TAG_NOT_REGISTERED'
          })
        }

        console.log('DIPENDENTE:', dipendente.nome, dipendente.cognome)

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
        */

        const { data: lastPresence } = await supabase
          .from('presenza')
          .select('tipo, created_at')
          .eq('tag_uid', uid)
          .eq('company_id', company_id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        /*
          LOGICA TIPO
        */

        let tipo = 'ENTRATA'

        const fasciaAttiva =
          fasce && fasce.length > 0
            ? getFasciaAttiva(fasce)
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
          SALVA PRESENZA
        */

        const { data: insertedPresence, error: insertError } = await supabase
          .from('presenza')
          .insert({
            company_id,
            tag_uid:   uid,
            reader_id,
            tipo
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