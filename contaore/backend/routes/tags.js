import bcrypt    from 'bcrypt'
import { supabase }         from '../services/supabase.js'
import { authenticate }     from '../middleware/auth.js'
import { sendCredenziali }  from '../services/email.js'
import { generatePassword, buildUsername, findAvailableUsername } from '../utils/userHelpers.js'

export default async function tagRoutes(fastify) {

  fastify.get(
    '/api/tags',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const companyId = request.user.company_id
        const { data, error } = await supabase
          .from('tag')
          .select('*, dipendenti(id, nome, cognome, email, user_account(id))')
          .eq('company_id', companyId)
          .order('created_at', { ascending: false })

        if (error) {
          request.log.error(error)
          return reply.send({ success: false })
        }

        const tags = (data || []).map(tag => ({
          ...tag,
          nome:         tag.dipendenti ? `${tag.dipendenti.nome} ${tag.dipendenti.cognome}` : tag.uid,
          nome_raw:     tag.dipendenti?.nome     || '',
          cognome_raw:  tag.dipendenti?.cognome  || '',
          email:        tag.dipendenti?.email    || null,
          ha_account:   !!(tag.dipendenti?.user_account?.length)
        }))

        return reply.send({ success: true, tags })
      } catch (err) {
        request.log.error(err)
        return reply.send({ success: false })
      }
    }
  )

  fastify.post(
    '/api/tags/register',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const {
          uid,
          employee_name,
          employee_cognome,
          employee_email,
          informativa_consegnata
        } = request.body

        const companyId = request.user.company_id

        if (!uid || !employee_name) {
          return reply.send({ success: false, error: 'MISSING_FIELDS' })
        }

        const { data: existingTag } = await supabase
          .from('tag')
          .select('id')
          .eq('uid', uid)
          .eq('company_id', companyId)
          .maybeSingle()

        if (existingTag) {
          return reply.send({ success: false, error: 'UID_ALREADY_EXISTS' })
        }

        const { data: existingEmployee } = await supabase
          .from('dipendenti')
          .select('id')
          .eq('badge_uid', uid)
          .eq('company_id', companyId)
          .maybeSingle()

        if (existingEmployee) {
          return reply.send({ success: false, error: 'UID_ALREADY_EXISTS' })
        }

        const { data: company } = await supabase
          .from('company')
          .select('id, nome, portale_dipendenti')
          .eq('id', companyId)
          .single()

        const portaleAttivo = !!company?.portale_dipendenti

        const informativaFlag = informativa_consegnata === true
        const { data: employee, error: employeeError } = await supabase
          .from('dipendenti')
          .insert({
            company_id:                companyId,
            nome:                      employee_name,
            cognome:                   employee_cognome || '-',
            badge_uid:                 uid,
            email:                     employee_email || null,
            informativa_consegnata:    informativaFlag,
            informativa_consegnata_il: informativaFlag ? new Date().toISOString() : null
          })
          .select()
          .single()

        if (employeeError) {
          request.log.error(employeeError)
          return reply.send({ success: false, error: employeeError.message })
        }

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
          request.log.error(tagError)
          await supabase.from('dipendenti').delete().eq('id', employee.id)
          return reply.send({ success: false, error: tagError.message })
        }

        let accountCreato = false
        if (portaleAttivo && employee_email) {
          try {
            const usernameBase = buildUsername(employee_name, employee_cognome || '')
            const username     = await findAvailableUsername(usernameBase)
            const plainPwd     = generatePassword(10)
            const hashedPwd    = await bcrypt.hash(plainPwd, 10)

            const { error: accountError } = await supabase
              .from('user_account')
              .insert({
                company_id:         companyId,
                dipendente_id:      employee.id,
                username,
                email:              employee_email,
                password:           hashedPwd,
                role:               'dipendente',
                two_factor_enabled: false
              })

            if (accountError) {
              console.error('Errore creazione account dipendente:', accountError)
            } else {
              accountCreato = true
              const loginUrl = process.env.FRONTEND_URL || 'https://contaore-eight.vercel.app'
              await sendCredenziali({
                email:       employee_email,
                nome:        employee_name,
                username,
                password:    plainPwd,
                companyNome: company.nome,
                loginUrl
              })
            }
          } catch (accErr) {
            console.error('Errore creazione account:', accErr)
          }
        }

        return reply.send({
          success:        true,
          employee,
          tag,
          account_creato: accountCreato
        })

      } catch (err) {
        request.log.error(err)
        return reply.send({ success: false })
      }
    }
  )

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

        await supabase.from('tag').update({ uid }).eq('id', id).eq('company_id', companyId)

        if (tag.dipendente_id) {
          await supabase.from('dipendenti').update({ badge_uid: uid }).eq('id', tag.dipendente_id).eq('company_id', companyId)
        }

        await supabase.from('presenza').update({ tag_uid: uid }).eq('tag_uid', tag.uid).eq('company_id', companyId)

        return reply.send({ success: true })
      } catch (err) {
        request.log.error(err)
        return reply.send({ success: false })
      }
    }
  )

  fastify.patch(
    '/api/tags/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const { id }               = request.params
        const { nome, cognome, email } = request.body
        const companyId            = request.user.company_id

        const { data: tag } = await supabase
          .from('tag')
          .select('*, dipendenti(id, nome, cognome)')
          .eq('id', id)
          .eq('company_id', companyId)
          .single()

        if (!tag) return reply.send({ success: false, error: 'NOT_FOUND' })
        const empId = tag.dipendente_id

        if (nome !== undefined || cognome !== undefined) {
          await supabase.from('dipendenti').update({
            ...(nome    !== undefined && { nome }),
            ...(cognome !== undefined && { cognome })
          }).eq('id', empId).eq('company_id', companyId)
        }

        let accountCreato = false
        if (email) {
          const { data: company } = await supabase
            .from('company').select('id, nome, portale_dipendenti').eq('id', companyId).single()

          await supabase.from('dipendenti').update({ email }).eq('id', empId)

          if (company?.portale_dipendenti) {
            const { data: existingAccount } = await supabase
              .from('user_account').select('id').eq('dipendente_id', empId).eq('company_id', companyId).maybeSingle()

            if (!existingAccount) {
              const empNome    = nome    ?? tag.dipendenti?.nome    ?? ''
              const empCognome = cognome ?? tag.dipendenti?.cognome ?? ''
              const usernameBase = buildUsername(empNome, empCognome)
              const username     = await findAvailableUsername(usernameBase)
              const plainPwd     = generatePassword(10)
              const hashedPwd    = await bcrypt.hash(plainPwd, 10)

              const { error: accErr } = await supabase.from('user_account').insert({
                company_id:    companyId,
                dipendente_id: empId,
                username,
                email,
                password:      hashedPwd,
                role:          'dipendente'
              })

              if (!accErr) {
                accountCreato = true
                try {
                  const loginUrl = process.env.FRONTEND_URL || 'https://contaore-eight.vercel.app'
                  await sendCredenziali({ email, nome: empNome, username, password: plainPwd, companyNome: company.nome, loginUrl })
                } catch (_) {}
              }
            } else {
              const { error: updateErr } = await supabase.from('user_account')
                .update({ email })
                .eq('dipendente_id', empId)
                .eq('company_id', companyId)
            }
          }
        }

        return reply.send({ success: true, account_creato: accountCreato })
      } catch (err) {
        request.log.error(err)
        return reply.send({ success: false })
      }
    }
  )

  fastify.delete(
    '/api/tags/:id',
    { preHandler: authenticate },
    async (request, reply) => {
      try {
        const { id }    = request.params
        const companyId = request.user.company_id

        const { data: tag, error: tagError } = await supabase
          .from('tag').select('*').eq('id', id).eq('company_id', companyId).single()

        if (tagError || !tag) return reply.send({ success: false })

        let employee = null
        if (tag.dipendente_id) {
          const { data } = await supabase.from('dipendenti').select('*').eq('id', tag.dipendente_id).eq('company_id', companyId).maybeSingle()
          employee = data
        } else if (tag.uid) {
          const { data } = await supabase.from('dipendenti').select('*').eq('badge_uid', tag.uid).eq('company_id', companyId).maybeSingle()
          employee = data
        }

        await supabase.from('tag').delete().eq('id', id).eq('company_id', companyId)

        if (employee) {
          await supabase.from('user_account').delete().eq('dipendente_id', employee.id)
          await supabase.from('presenza').delete().eq('tag_uid', employee.badge_uid).eq('company_id', companyId)
          await supabase.from('turni').delete().eq('dipendente_id', employee.id).eq('company_id', companyId)
          await supabase.from('richieste_ferie').delete().eq('dipendente_id', employee.id)
          await supabase.from('giustificazioni').delete().eq('dipendente_id', employee.id)
          await supabase.from('dipendenti').delete().eq('id', employee.id).eq('company_id', companyId)
        }

        return reply.send({ success: true })
      } catch (err) {
        request.log.error(err)
        return reply.send({ success: false })
      }
    }
  )
}
