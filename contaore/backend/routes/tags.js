import { supabase } from '../services/supabase.js'
import { authenticate } from '../middleware/auth.js'

export default async function tagRoutes(fastify) {

  /*
    GET TAGS
  */

  fastify.get(
    '/api/tags',
    { preHandler: authenticate },
    async (request, reply) => {

      try {

        const companyId = request.user.company_id

        const { data, error } = await supabase
          .from('tag')
          .select('*, dipendenti(nome, cognome)')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })

        if (error) {
          console.log(error)
          return reply.send({ success: false })
        }

        const tags = (data || []).map(tag => ({
          ...tag,
          nome: tag.dipendenti
            ? `${tag.dipendenti.nome} ${tag.dipendenti.cognome}`
            : tag.uid
        }))

        return reply.send({ success: true, tags })

      } catch (err) {

        console.log(err)
        return reply.send({ success: false })

      }

    }
  )

  /*
    REGISTER TAG + EMPLOYEE
  */

  fastify.post(
    '/api/tags/register',
    { preHandler: authenticate },
    async (request, reply) => {

      try {

        const {
          uid,
          employee_name,
          employee_cognome
        } = request.body

        const companyId = request.user.company_id

        if (!uid || !employee_name) {
          return reply.send({
            success: false,
            error: 'MISSING_FIELDS'
          })
        }

        /*
          CHECK UID GIA ESISTENTE NEL TAG
        */

        const { data: existingTag } = await supabase
          .from('tag')
          .select('id')
          .eq('uid', uid)
          .eq('company_id', companyId)
          .maybeSingle()

        if (existingTag) {
          return reply.send({
            success: false,
            error: 'UID_ALREADY_EXISTS'
          })
        }

        /*
          CHECK UID GIA USATO IN DIPENDENTI
        */

        const { data: existingEmployee } = await supabase
          .from('dipendenti')
          .select('id')
          .eq('badge_uid', uid)
          .eq('company_id', companyId)
          .maybeSingle()

        if (existingEmployee) {
          return reply.send({
            success: false,
            error: 'UID_ALREADY_EXISTS'
          })
        }

        /*
          CREA DIPENDENTE
        */

        const { data: employee, error: employeeError } = await supabase
          .from('dipendenti')
          .insert({
            company_id: companyId,
            nome:       employee_name,
            cognome:    employee_cognome || '-',
            badge_uid:  uid
          })
          .select()
          .single()

        if (employeeError) {
          console.log(employeeError)
          return reply.send({
            success: false,
            error: employeeError.message
          })
        }

        /*
          CREA TAG
        */

        const { data: tag, error: tagError } = await supabase
          .from('tag')
          .insert({
            company_id:    companyId,
            uid,
            dipendente_id: employee.id
          })
          .select()
          .single()

        if (tagError) {

          console.log(tagError)

          /*
            ROLLBACK: elimina dipendente
            se il tag non e stato creato
          */

          await supabase
            .from('dipendenti')
            .delete()
            .eq('id', employee.id)

          return reply.send({
            success: false,
            error: tagError.message
          })

        }

        return reply.send({ success: true, employee, tag })

      } catch (err) {

        console.log(err)
        return reply.send({ success: false })

      }

    }
  )

  /*
    UPDATE TAG UID
  */

  fastify.put(
    '/api/tags/:id',
    { preHandler: authenticate },
    async (request, reply) => {

      try {

        const { id }    = request.params
        const { uid }   = request.body
        const companyId = request.user.company_id

        if (!uid) {
          return reply.send({ success: false, error: 'UID_REQUIRED' })
        }

        const { data: tag, error: tagError } = await supabase
          .from('tag')
          .select('*')
          .eq('id', id)
          .eq('company_id', companyId)
          .single()

        if (tagError || !tag) {
          return reply.send({ success: false, error: 'TAG_NOT_FOUND' })
        }

        const { data: existingTag } = await supabase
          .from('tag')
          .select('id')
          .eq('uid', uid)
          .eq('company_id', companyId)
          .neq('id', id)
          .maybeSingle()

        if (existingTag) {
          return reply.send({ success: false, error: 'UID_ALREADY_EXISTS' })
        }

        await supabase
          .from('tag')
          .update({ uid })
          .eq('id', id)
          .eq('company_id', companyId)

        if (tag.dipendente_id) {
          await supabase
            .from('dipendenti')
            .update({ badge_uid: uid })
            .eq('id', tag.dipendente_id)
            .eq('company_id', companyId)
        }

        await supabase
          .from('presenza')
          .update({ tag_uid: uid })
          .eq('tag_uid', tag.uid)
          .eq('company_id', companyId)

        return reply.send({ success: true })

      } catch (err) {

        console.log(err)
        return reply.send({ success: false })

      }

    }
  )

  /*
    DELETE TAG + EMPLOYEE
  */

  fastify.delete(
    '/api/tags/:id',
    { preHandler: authenticate },
    async (request, reply) => {

      try {

        const { id }    = request.params
        const companyId = request.user.company_id

        const { data: tag, error: tagError } = await supabase
          .from('tag')
          .select('*')
          .eq('id', id)
          .eq('company_id', companyId)
          .single()

        if (tagError || !tag) {
          return reply.send({ success: false })
        }

        let employee = null

        if (tag.dipendente_id) {
          const { data } = await supabase
            .from('dipendenti')
            .select('*')
            .eq('id', tag.dipendente_id)
            .eq('company_id', companyId)
            .maybeSingle()
          employee = data
        } else if (tag.uid) {
          const { data } = await supabase
            .from('dipendenti')
            .select('*')
            .eq('badge_uid', tag.uid)
            .eq('company_id', companyId)
            .maybeSingle()
          employee = data
        }

        await supabase
          .from('tag')
          .delete()
          .eq('id', id)
          .eq('company_id', companyId)

        if (employee) {

          await supabase
            .from('presenza')
            .delete()
            .eq('tag_uid', employee.badge_uid)
            .eq('company_id', companyId)

          await supabase
            .from('turni')
            .delete()
            .eq('dipendente_id', employee.id)
            .eq('company_id', companyId)

          await supabase
            .from('dipendenti')
            .delete()
            .eq('id', employee.id)
            .eq('company_id', companyId)

        }

        return reply.send({ success: true })

      } catch (err) {

        console.log(err)
        return reply.send({ success: false })

      }

    }
  )

}