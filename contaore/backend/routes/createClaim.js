import crypto from 'crypto'
import { supabase } from '../services/supabase.js'

function generateToken() {

  return crypto
    .randomBytes(6)
    .toString('hex')
    .toUpperCase()
}
 
async function routes(fastify, options) {

  fastify.post('/device/create-claim', async (request, reply) => {

    try {

      const {
        company_id
      } = request.body

      const token = generateToken()

      await supabase
        .from('device_claim')
        .insert({
          token,
          company_id,
          used: false
        })

      return {
        ok: true,
        token
      }

    } catch (err) {

      console.log(err)

      return reply.code(500).send({
        error: 'Server error'
      })
    }
  })
}

export default routes
