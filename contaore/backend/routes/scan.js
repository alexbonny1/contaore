import { supabase } from '../services/supabase.js'
import { authenticate } from '../middleware/auth.js'

global.lastRead = null

export default async function scanRoutes(fastify) {

  /*
    REGISTER PRESENCE
  */

  fastify.post(
    '/api/scan',
    async (request, reply) => {

      try {

        const {
          uid,
          reader_id
        } = request.body

        if (!uid) {
          return reply.send({ success: false })
        }

        global.lastRead = {
          uid,
          created_at: new Date().toISOString()
        }

        const {
          data: tag,
          error: tagError
        } = await supabase
          .from('tag')
          .select('*')
          .eq('uid', uid)
          .single()

        if (tagError || !tag) {
          return reply.send({
            success: false,
            error: 'TAG_NOT_FOUND'
          })
        }

        // ── VALIDAZIONE LETTORE: OBBLIGATORIO e deve appartenere alla stessa azienda del tag ────
        if (!reader_id) {
          return reply.send({
            success: false,
            error: 'READER_ID_REQUIRED'
          })
        }

        const {
          data: reader,
          error: readerError
        } = await supabase
          .from('dispositivo')
          .select('company_id')
          .eq('id', reader_id)
          .maybeSingle()

        if (readerError) {
          console.log('Reader query error:', readerError)
          return reply.send({
            success: false,
            error: 'DATABASE_ERROR'
          })
        }

        if (!reader) {
          return reply.send({
            success: false,
            error: 'READER_NOT_FOUND'
          })
        }

        // ── Verifica che il lettore appartiene alla stessa azienda del tag ──
        if (reader.company_id !== tag.company_id) {
          console.log('READER NOT AUTHORIZED - Company mismatch', {
            reader_company: reader.company_id,
            tag_company: tag.company_id
          })
          return reply.send({
            success: false,
            error: 'READER_NOT_AUTHORIZED',
            message: `Lettore non autorizzato: appartiene a un'azienda diversa`
          })
        }

        const limitDate =
          new Date(Date.now() - 5000).toISOString()

        const { data: latestPresence } = await supabase
          .from('presenza')
          .select('*')
          .eq('tag_uid', uid)
          .gte('created_at', limitDate)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (latestPresence) {
          return reply.send({ success: true, ignored: true })
        }

        const { data: lastPresence } = await supabase
          .from('presenza')
          .select('*')
          .eq('tag_uid', uid)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        let tipo = 'USCITA'

        if (lastPresence && lastPresence.tipo === 'USCITA') {
          tipo = 'ENTRATA'
        }

        const { error } = await supabase
          .from('presenza')
          .insert({
            company_id: tag.company_id,
            tag_uid:    uid,
            reader_id:  reader_id || null,
            tipo
          })

        if (error) {
          console.log(error)
          return reply.send({ success: false })
        }

        return reply.send({ success: true, tipo })

      } catch (err) {

        console.log(err)
        return reply.send({ success: false })

      }

    }
  )

  /*
    GET LATEST READ
  */

  fastify.get(
    '/api/latest-read',
    {
      preHandler: authenticate
    },
    async (request, reply) => {

      try {

        const { after } = request.query
        const company_id = request.user.company_id

        if (!global.lastRead) {
          return reply.send({ success: false })
        }

        // ── Verifica che la lettura appartiene all'azienda autenticata ──
        // La lettura in memoria non ha company_id quindi facciamo un controllo DB
        const { data: lastTag } = await supabase
          .from('tag')
          .select('company_id')
          .eq('uid', global.lastRead.uid)
          .maybeSingle()

        // Se il tag non appartiene all'azienda, non lo ritorniamo
        if (!lastTag || lastTag.company_id !== company_id) {
          return reply.send({ success: false })
        }

        if (
          after &&
          new Date(global.lastRead.created_at) <= new Date(after)
        ) {
          return reply.send({ success: false })
        }

        return reply.send({
          success: true,
          uid: global.lastRead.uid
        })

      } catch (err) {

        console.log(err)
        return reply.send({ success: false })

      }

    }
  )

}