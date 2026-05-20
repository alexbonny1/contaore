import { supabase } from '../services/supabase.js'

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
    async (request, reply) => {

      try {

        const { after } = request.query

        if (!global.lastRead) {
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