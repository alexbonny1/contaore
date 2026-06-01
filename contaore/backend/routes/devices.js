import { supabase } from '../services/supabase.js'
import { authenticate } from '../middleware/auth.js'

export default async function deviceRoutes(fastify) {
 
  /*
    GET READERS 
  */

  fastify.get(
    '/api/readers',
    {
      preHandler: authenticate
    },
    async (request, reply) => {

      try {

        const { data, error } =
          await supabase
            .from('dispositivo')
            .select('*')
            .eq(
              'company_id',
              request.user.company_id
            )
            .order(
              'ultimo_ping',
              {
                ascending: false
              }
            )

        if (error) {

          console.log(error)

          return reply.send({
            success: false
          })

        }

        /*
          stato online
        */

        const now =
          Date.now()

        const readers =
          (data || []).map(reader => {

            const lastPing =
              reader.ultimo_ping
                ? new Date(
                    reader.ultimo_ping
                  ).getTime()
                : 0

            const online =
              now - lastPing <
              120000

            return {

              ...reader,

              online

            }

          })

        return reply.send({

          success: true,

          readers

        })

      } catch (err) {

        console.log(err)

        return reply.send({
          success: false
        })

      }

    }
  )

}
