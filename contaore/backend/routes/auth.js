import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'

import { supabase } from '../services/supabase.js'

const JWT_SECRET = process.env.JWT_SECRET || 'SUPER_SECRET_KEY'

export default async function authRoutes(fastify) {

  /*
    LOGIN
    accetta sia username che email
  */

  fastify.post('/api/auth/login', async (request, reply) => {

    try {

      const {
        username,
        password
      } = request.body

      if (!username || !password) {

        return reply.status(400).send({
          error: 'MISSING_FIELDS'
        })
      }

      /*
        CERCA PER USERNAME O EMAIL
      */

      const { data: user, error } = await supabase
        .from('user_account')
        .select('*')
        .or(
          `username.eq.${username},email.eq.${username}`
        )
        .single()
        console.log('USER:', user)
        console.log('ERROR:', error)
      if (error || !user) {

        return reply.status(401).send({
          error: 'INVALID_CREDENTIALS'
        })
      }

      const validPassword = await bcrypt.compare(
        password,
        user.password
      )


console.log('PASSWORD RICEVUTA:', password)
console.log('VALID:', validPassword)

      if (!validPassword) {

        return reply.status(401).send({
          error: 'INVALID_CREDENTIALS'
        })
      }

      const token = jwt.sign(
        {
          id: user.id,
          username: user.username,
          email: user.email,
          company_id: user.company_id,
          role: user.role
        },
        JWT_SECRET,
        {
          expiresIn: '7d'
        }
      )

      return reply.send({
        success: true,
        token,
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          role: user.role,
          company_id: user.company_id
        }
      })

    } catch (err) {

      console.log(err)

      return reply.status(500).send({
        error: 'SERVER_ERROR'
      })
    }

  })

}