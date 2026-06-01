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
 
        // SECURITY FIX: Validate that reader_id is provided (REQUIRED)
        if (!reader_id) {
          return reply.send({
            success: false,
            error: 'READER_ID_REQUIRED'
          })
        }

        // SECURITY FIX: Validate that reader exists and get its company_id
        const { data: reader, error: readerError } = await supabase
          .from('dispositivo')
          .select('company_id')
          .eq('reader_id', reader_id)
          .single()

        if (readerError || !reader) {
          return reply.send({
            success: false,
            error: 'READER_NOT_FOUND'
          })
        }

        const readerCompanyId = reader.company_id

        global.lastRead = {
          uid,
          created_at: new Date().toISOString()
        }

        // SECURITY FIX: Query tag with company_id filter (prevent cross-company reads)
        const {
          data: tag,
          error: tagError
        } = await supabase
          .from('tag')
          .select('*')
          .eq('uid', uid)
          .eq('company_id', readerCompanyId)
          .single()

        if (tagError || !tag) {
          return reply.send({
            success: false,
            error: 'TAG_COMPANY_MISMATCH'
          })
        }

        const limitDate =
          new Date(Date.now() - 5000).toISOString()

        // SECURITY FIX: Add company_id filter to latestPresence query
        const { data: latestPresence } = await supabase
          .from('presenza')
          .select('*')
          .eq('tag_uid', uid)
          .eq('company_id', readerCompanyId)
          .gte('created_at', limitDate)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (latestPresence) {
          return reply.send({ success: true, ignored: true })
        }

        // SECURITY FIX: Add company_id filter to lastPresence query
        const { data: lastPresence } = await supabase
          .from('presenza')
          .select('*')
          .eq('tag_uid', uid)
          .eq('company_id', readerCompanyId)
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
