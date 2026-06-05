import bcrypt from 'bcrypt'
import crypto from 'crypto'
import { supabase } from '../services/supabase.js'
import { authenticateSuperadmin } from '../middleware/auth.js'
import { sendCredenziali, sendCredenzialiOwner } from '../services/email.js'

// Genera password casuale sicura (12 caratteri: lettere + numeri)
function generaPassword() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  let pwd = ''
  const bytes = crypto.randomBytes(12)
  for (let i = 0; i < 12; i++) {
    pwd += chars[bytes[i] % chars.length]
  }
  return pwd
}

export default async function adminRoutes(fastify) {

  /*
    GET ALL COMPANIES
  */
  fastify.get(
    '/api/admin/companies',
    { preHandler: authenticateSuperadmin },
    async (request, reply) => {
      try {
        const { data: companies, error } = await supabase
          .from('company')
          .select('id, nome, slug, portale_dipendenti, created_at')
          .order('created_at', { ascending: false })

        if (error) {
          console.log(error)
          return reply.status(500).send({ success: false, error: 'DB_ERROR' })
        }

        const result = await Promise.all(
          companies.map(async (company) => {
            const { data: users } = await supabase
              .from('user_account')
              .select('id, username, email, role, created_at')
              .eq('company_id', company.id)
              .neq('role', 'superadmin')

            const { data: fasce } = await supabase
              .from('fasce_orarie')
              .select('*')
              .eq('company_id', company.id)
              .order('ora_inizio', { ascending: true })

            const { data: devices } = await supabase
              .from('dispositivo')
              .select('*')
              .eq('company_id', company.id)
              .order('reader_id', { ascending: true })

            const accountDipendenti = (users || []).filter(u => u.role === 'dipendente').length

            return {
              ...company,
              users:              (users || []).filter(u => u.role !== 'dipendente'),
              fasce:              fasce || [],
              devices:            devices || [],
              account_dipendenti: accountDipendenti
            }
          })
        )

        return reply.send({ success: true, companies: result })

      } catch (err) {
        console.log(err)
        return reply.status(500).send({ success: false, error: 'SERVER_ERROR' })
      }
    }
  )

  /*
    CREATE COMPANY + ACCOUNT OWNER
    - password auto-generata se non fornita
    - email obbligatoria: le credenziali vengono inviate via email
  */
  fastify.post(
    '/api/admin/companies',
    { preHandler: authenticateSuperadmin },
    async (request, reply) => {
      try {
        const { company_name, username, email } = request.body
        // password opzionale: se non fornita viene auto-generata
        const passwordInChiaro = request.body.password || generaPassword()

        if (!company_name || !username || !email) {
          return reply.status(400).send({ success: false, error: 'MISSING_FIELDS' })
        }

        const { data: existingUser } = await supabase
          .from('user_account')
          .select('id')
          .eq('username', username)
          .maybeSingle()

        if (existingUser) {
          return reply.status(400).send({ success: false, error: 'USERNAME_ALREADY_EXISTS' })
        }

        const slug = company_name
          .toLowerCase()
          .replace(/\s+/g, '-')
          .replace(/[^a-z0-9-]/g, '')

        const { data: company, error: companyError } = await supabase
          .from('company')
          .insert({ nome: company_name, slug })
          .select()
          .single()

        if (companyError) {
          console.log(companyError)
          return reply.status(500).send({ success: false, error: 'COMPANY_CREATE_ERROR' })
        }

        const hashedPassword = await bcrypt.hash(passwordInChiaro, 10)

        const { data: user, error: userError } = await supabase
          .from('user_account')
          .insert({
            username,
            password:   hashedPassword,
            email,
            role:       'owner',
            company_id: company.id
          })
          .select()
          .single()

        if (userError) {
          console.log(userError)
          // rollback company
          await supabase.from('company').delete().eq('id', company.id)
          return reply.status(500).send({ success: false, error: 'USER_CREATE_ERROR' })
        }

        // Invia email con credenziali al titolare
        let emailInviata = false
        try {
          emailInviata = await sendCredenzialiOwner({
            email,
            username,
            password:    passwordInChiaro,
            companyNome: company_name
          })
          if (emailInviata) {
            console.log('Email credenziali owner inviata a', email)
          } else {
            console.warn('Invio email credenziali owner fallito per', email)
          }
        } catch (mailErr) {
          console.error('Errore invio email credenziali owner:', mailErr.message)
        }

        return reply.send({
          success: true,
          email_inviata: emailInviata,
          company,
          user: {
            id:         user.id,
            username:   user.username,
            email:      user.email,
            role:       user.role,
            company_id: user.company_id
          }
        })

      } catch (err) {
        console.log(err)
        return reply.status(500).send({ success: false, error: 'SERVER_ERROR' })
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

        await supabase.from('user_account').delete().eq('company_id', id)
        await supabase.from('fasce_orarie').delete().eq('company_id', id)

        const { error } = await supabase
          .from('company')
          .delete()
          .eq('id', id)

        if (error) {
          console.log(error)
          return reply.status(500).send({ success: false, error: 'DELETE_ERROR' })
        }

        return reply.send({ success: true })

      } catch (err) {
        console.log(err)
        return reply.status(500).send({ success: false, error: 'SERVER_ERROR' })
      }
    }
  )

  /*
    CAMBIA PASSWORD ACCOUNT AZIENDA (dal pannello superadmin)
    Genera una nuova password casuale e la invia via email al titolare
  */
  fastify.put(
    '/api/admin/users/:id/password',
    { preHandler: authenticateSuperadmin },
    async (request, reply) => {
      try {
        const { id } = request.params
        // Se il body ha una password la usa, altrimenti la auto-genera
        const passwordInChiaro = request.body.password || generaPassword()

        const hashedPassword = await bcrypt.hash(passwordInChiaro, 10)

        // Recupera email e username per invio credenziali
        const { data: userInfo } = await supabase
          .from('user_account')
          .select('username, email, company_id')
          .eq('id', id)
          .neq('role', 'superadmin')
          .maybeSingle()

        const { error } = await supabase
          .from('user_account')
          .update({ password: hashedPassword })
          .eq('id', id)
          .neq('role', 'superadmin')

        if (error) {
          console.log(error)
          return reply.status(500).send({ success: false, error: 'UPDATE_ERROR' })
        }

        // Invia email con nuove credenziali se email disponibile
        let emailInviata = false
        if (userInfo?.email) {
          try {
            // Recupera nome azienda
            const { data: company } = await supabase
              .from('company')
              .select('nome')
              .eq('id', userInfo.company_id)
              .maybeSingle()

            emailInviata = await sendCredenzialiOwner({
              email:       userInfo.email,
              username:    userInfo.username,
              password:    passwordInChiaro,
              companyNome: company?.nome || ''
            })
          } catch (mailErr) {
            console.error('Errore invio email reset password:', mailErr.message)
          }
        }

        return reply.send({ success: true, email_inviata: emailInviata, nuova_password: passwordInChiaro })

      } catch (err) {
        console.log(err)
        return reply.status(500).send({ success: false, error: 'SERVER_ERROR' })
      }
    }
  )

  /*
    TOGGLE PORTALE DIPENDENTI
  */
  fastify.put(
    '/api/admin/companies/:id/portale',
    { preHandler: authenticateSuperadmin },
    async (request, reply) => {
      try {
        const { id }     = request.params
        const { attivo } = request.body

        if (typeof attivo !== 'boolean') {
          return reply.status(400).send({ success: false, error: 'MISSING_FIELDS' })
        }

        const { data, error } = await supabase
          .from('company')
          .update({ portale_dipendenti: attivo })
          .eq('id', id)
          .select('id, nome, portale_dipendenti')
          .single()

        if (error) {
          console.log(error)
          return reply.status(500).send({ success: false, error: 'UPDATE_ERROR' })
        }

        return reply.send({ success: true, company: data })

      } catch (err) {
        console.log(err)
        return reply.status(500).send({ success: false, error: 'SERVER_ERROR' })
      }
    }
  )

  /*
    GET ACCOUNT DIPENDENTI
  */
  fastify.get(
    '/api/admin/companies/:id/accounts',
    { preHandler: authenticateSuperadmin },
    async (request, reply) => {
      try {
        const { id } = request.params

        const { data, error } = await supabase
          .from('user_account')
          .select('id, username, email, created_at, dipendente_id, dipendenti(nome, cognome)')
          .eq('company_id', id)
          .eq('role', 'dipendente')
          .order('created_at', { ascending: false })

        if (error) {
          console.log(error)
          return reply.status(500).send({ success: false, error: 'DB_ERROR' })
        }

        return reply.send({ success: true, accounts: data || [] })

      } catch (err) {
        console.log(err)
        return reply.status(500).send({ success: false, error: 'SERVER_ERROR' })
      }
    }
  )

  /*
    GET DEVICES PER COMPANY (superadmin)
  */
  fastify.get(
    '/api/admin/companies/:id/devices',
    { preHandler: authenticateSuperadmin },
    async (request, reply) => {
      try {
        const { id } = request.params
        const { data, error } = await supabase
          .from('dispositivo')
          .select('*')
          .eq('company_id', id)
          .order('reader_id', { ascending: true })
        if (error) {
          console.log(error)
          return reply.status(500).send({ success: false, error: 'DB_ERROR' })
        }
        return reply.send({ success: true, devices: data || [] })
      } catch (err) {
        console.log(err)
        return reply.status(500).send({ success: false, error: 'SERVER_ERROR' })
      }
    }
  )

  /*
    GET FASCE ORARIE
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
          return reply.status(500).send({ success: false, error: 'DB_ERROR' })
        }

        return reply.send({ success: true, fasce: data || [] })

      } catch (err) {
        console.log(err)
        return reply.status(500).send({ success: false, error: 'SERVER_ERROR' })
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
        const { nome, ora_inizio, ora_fine, tipo, reader_id } = request.body

        if (!ora_inizio || !ora_fine || !tipo) {
          return reply.status(400).send({ success: false, error: 'MISSING_FIELDS' })
        }

        if (!['ENTRATA', 'USCITA'].includes(tipo)) {
          return reply.status(400).send({ success: false, error: 'TIPO_INVALIDO' })
        }

        const { data: fascia, error } = await supabase
          .from('fasce_orarie')
          .insert({
            company_id: id,
            nome:       nome || `${tipo} ${ora_inizio}-${ora_fine}`,
            ora_inizio,
            ora_fine,
            tipo,
            reader_id:  reader_id || null
          })
          .select()
          .single()

        if (error) {
          console.log('Errore inserimento fascia:', error)
          return reply.status(500).send({ success: false, error: 'INSERT_ERROR', detail: error.message })
        }

        return reply.send({ success: true, fasce: [fascia], message: '1 fascia oraria creata' })

      } catch (err) {
        console.log(err)
        return reply.status(500).send({ success: false, error: 'SERVER_ERROR' })
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
          return reply.status(500).send({ success: false, error: 'DELETE_ERROR' })
        }

        return reply.send({ success: true })

      } catch (err) {
        console.log(err)
        return reply.status(500).send({ success: false, error: 'SERVER_ERROR' })
      }
    }
  )
}
