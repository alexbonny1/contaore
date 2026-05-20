import { supabase } from '../services/supabase.js'
import { authenticate } from '../middleware/auth.js'

export default async function presenzeRoutes(fastify) {

  /*
    GET PRESENZE
  */

  fastify.get(
    '/api/presenze',
    {
      preHandler: authenticate
    },
    async (request, reply) => {

      try {

        const { data, error } =
          await supabase
            .from('presenza')
            .select('*')
            .eq(
              'company_id',
              request.user.company_id
            )
            .order(
              'timestamp',
              {
                ascending: false
              }
            )
            .limit(100)

        if (error) {

          console.log(error)

          return reply.send({
            success: false
          })

        }

        return reply.send({

          success: true,

          presenze: data

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