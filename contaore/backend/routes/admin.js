import bcrypt from 'bcrypt'
import { supabase } from '../services/supabase.js'
import { authenticateSuperadmin } from '../middleware/auth.js'

export default async function adminRoutes(fastify) {

  /*
    GET ALL COMPANIES
  */

  fastify.get(
    '/api/admin/companies',
    { preHandler: authenticateSuperadmin },
    async (request, reply) => {

      try {

        const {
          data: companies,
          error
        } = await supabase
          .from('company')
          .select('id, nome, slug, created_at')
          .order('created_at', { ascending: false })

        if (error) {
          console.log(error)
          return reply.status(500).send({
            success: false,
            error: 'DB_ERROR'
          })
        }

        const result = await Promise.all(
          companies.map(async (company) => {

            const { data: users } = await supabase
              .from('user_account')
              .select('id, username, email, created_at')
              .eq('company_id', company.id)
              .neq('role', 'superadmin')

            const { data: fasce } = await supabase
              .from('fasce_orarie')
              .select('*')
              .eq('company_id', company.id)
              .order('ora_inizio', { ascending: true })

            return {
              ...company,
              users:  users  || [],
              fasce:  fasce  || []
            }

          })
        )

        return reply.send({
          success: true,
          companies: result
        })

      } catch (err) {

        console.log(err)
        return reply.status(500).send({
          success: false,
          error: 'SERVER_ERROR'
        })

      }

    }
  )

  /*
    CREATE COMPANY + ACCOUNT
  */

  fastify.post(
    '/api/admin/companies',
    { preHandler: authenticateSuperadmin },
    async (request, reply) => {

      try {

        const {
          company_name,
          username,
          password
        } = request.body

        if (!company_name || !username || !password) {
          return reply.status(400).send({
            success: false,
            error: 'MISSING_FIELDS'
          })
        }

        const { data: existingUser } = await supabase
          .from('user_account')
          .select('id')
          .eq('username', username)
          .maybeSingle()

        if (existingUser) {
          return reply.status(400).send({
            success: false,
            error: 'USERNAME_ALREADY_EXISTS'
          })
        }

        const slug = company_name
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '')

        const {
          data: company,
          error: companyError
        } = await supabase
          .from('company')
          .insert({ nome: company_name, slug })
          .select()
          .single()

        if (companyError) {
          console.log(companyError)
          return reply.status(500).send({
            success: false,
            error: 'COMPANY_CREATE_ERROR'
          })
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        const {
          data: user,
          error: userError
        } = await supabase
          .from('user_account')
          .insert({
            username,
            password: hashedPassword,
            role: 'owner',
            company_id: company.id
          })
          .select()
          .single()

        if (userError) {
          console.log(userError)
          return reply.status(500).send({
            success: false,
            error: 'USER_CREATE_ERROR'
          })
        }

        return reply.send({
          success: true,
          company,
          user: {
            id:         user.id,
            username:   user.username,
            role:       user.role,
            company_id: user.company_id
          }
        })

      } catch (err) {

        console.log(err)
        return reply.status(500).send({
          success: false,
          error: 'SERVER_ERROR'
        })

      }

    }
  )

  /*
    DELETE COMPANY
  */

  fastify.delete(
    '/api/admin/companies/:id',
    { preHandler: authenticateSuperadmin },
    async (request, reply) => {

      try {

        const { id } = request.params

        await supabase
          .from('user_account')
          .delete()
          .eq('company_id', id)

        await supabase
          .from('fasce_orarie')
          .delete()
          .eq('company_id', id)

        const { error } = await supabase
          .from('company')
          .delete()
          .eq('id', id)

        if (error) {
          console.log(error)
          return reply.status(500).send({
            success: false,
            error: 'DELETE_ERROR'
          })
        }

        return reply.send({ success: true })

      } catch (err) {

        console.log(err)
        return reply.status(500).send({
          success: false,
          error: 'SERVER_ERROR'
        })

      }

    }
  )

  /*
    CAMBIA PASSWORD ACCOUNT AZIENDA
  */

  fastify.put(
    '/api/admin/users/:id/password',
    { preHandler: authenticateSuperadmin },
    async (request, reply) => {

      try {

        const { id }       = request.params
        const { password } = request.body

        if (!password) {
          return reply.status(400).send({
            success: false,
            error: 'MISSING_PASSWORD'
          })
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        const { error } = await supabase
          .from('user_account')
          .update({ password: hashedPassword })
          .eq('id', id)
          .neq('role', 'superadmin')

        if (error) {
          console.log(error)
          return reply.status(500).send({
            success: false,
            error: 'UPDATE_ERROR'
          })
        }

        return reply.send({ success: true })

      } catch (err) {

        console.log(err)
        return reply.status(500).send({
          success: false,
          error: 'SERVER_ERROR'
        })

      }

    }
  )

  /*
    GET FASCE ORARIE AZIENDA
  */

  fastify.get(
    '/api/admin/companies/:id/fasce',
    { preHandler: authenticateSuperadmin },
    async (request, reply) => {

      try {

        const { id } = request.params

        const { data, error } = await supabase
          .from('fasce_orarie')
          .select('*')
          .eq('company_id', id)
          .order('ora_inizio', { ascending: true })

        if (error) {
          console.log(error)
          return reply.status(500).send({
            success: false,
            error: 'DB_ERROR'
          })
        }

        return reply.send({
          success: true,
          fasce: data || []
        })

      } catch (err) {

        console.log(err)
        return reply.status(500).send({
          success: false,
          error: 'SERVER_ERROR'
        })

      }

    }
  )

  /*
    CREATE FASCIA ORARIA
  */

  fastify.post(
    '/api/admin/companies/:id/fasce',
    { preHandler: authenticateSuperadmin },
    async (request, reply) => {

      try {

        const { id } = request.params

        const {
          nome,
          ora_inizio,
          ora_fine,
          tipo
        } = request.body

        if (!ora_inizio || !ora_fine || !tipo) {
          return reply.status(400).send({
            success: false,
            error: 'MISSING_FIELDS'
          })
        }

        if (!['ENTRATA', 'USCITA'].includes(tipo)) {
          return reply.status(400).send({
            success: false,
            error: 'TIPO_INVALIDO'
          })
        }

        const { data, error } = await supabase
          .from('fasce_orarie')
          .insert({
            company_id: id,
            nome:       nome || `${tipo} ${ora_inizio}-${ora_fine}`,
            ora_inizio,
            ora_fine,
            tipo
          })
          .select()
          .single()

        if (error) {
          console.log(error)
          return reply.status(500).send({
            success: false,
            error: 'INSERT_ERROR'
          })
        }

        return reply.send({
          success: true,
          fascia: data
        })

      } catch (err) {

        console.log(err)
        return reply.status(500).send({
          success: false,
          error: 'SERVER_ERROR'
        })

      }

    }
  )

  /*
    DELETE FASCIA ORARIA
  */

  fastify.delete(
    '/api/admin/fasce/:id',
    { preHandler: authenticateSuperadmin },
    async (request, reply) => {

      try {

        const { id } = request.params

        const { error } = await supabase
          .from('fasce_orarie')
          .delete()
          .eq('id', id)

        if (error) {
          console.log(error)
          return reply.status(500).send({
            success: false,
            error: 'DELETE_ERROR'
          })
        }

        return reply.send({ success: true })

      } catch (err) {

        console.log(err)
        return reply.status(500).send({
          success: false,
          error: 'SERVER_ERROR'
        })

      }

    }
  )

}