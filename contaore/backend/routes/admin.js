import bcrypt from 'bcrypt'
import { supabase } from '../services/supabase.js'
import { authenticateSuperadmin } from '../middleware/auth.js'
import { sendCredenziali, sendCredenzialiOwner } from '../services/email.js'

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

            // numero account dipendenti creati
            const accountDipendenti = (users || []).filter(u => u.role === 'dipendente').length

            return {
              ...company,
              users:               (users || []).filter(u => u.role !== 'dipendente'),
              fasce:               fasce || [],
              account_dipendenti:  accountDipendenti
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
    CREATE COMPANY + ACCOUNT
  */
  fastify.post(
    '/api/admin/companies',
    { preHandler: authenticateSuperadmin },
    async (request, reply) => {
      try {
        const { company_name, username, password, email } = request.body

        if (!company_name || !username || !password) {
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

        const hashedPassword = await bcrypt.hash(password, 10)

        const { data: user, error: userError } = await supabase
          .from('user_account')
          .insert({
            username,
            password:   hashedPassword,
            email:      email || null,
            role:       'owner',
            company_id: company.id
          })
          .select()
          .single()

        if (userError) {
          console.log(userError)
          return reply.status(500).send({ success: false, error: 'USER_CREATE_ERROR' })
        }

        // Invia email con credenziali al titolare se email è fornita
        if (email) {
          try {
            const emailSent = await sendCredenzialiOwner({
              email,
              username,
              password,
              companyNome: company_name
            })
            if (emailSent) {
              console.log('Email credenziali inviata a', email)
            }
          } catch (mailErr) {
            console.log('Errore invio email credenziali:', mailErr.message)
            // Non blocc l'operazione se l'email fallisce
          }
        }

        return reply.send({
          success: true,
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
          return reply.status(400).send({ success: false, error: 'MISSING_PASSWORD' })
        }

        const hashedPassword = await bcrypt.hash(password, 10)

        const { error } = await supabase
          .from('user_account')
          .update({ password: hashedPassword })
          .eq('id', id)
          .neq('role', 'superadmin')

        if (error) {
          console.log(error)
          return reply.status(500).send({ success: false, error: 'UPDATE_ERROR' })
        }

        return reply.send({ success: true })

      } catch (err) {
        console.log(err)
        return reply.status(500).send({ success: false, error: 'SERVER_ERROR' })
      }
    }
  )

  /*
    ── PORTALE DIPENDENTI ───────────────────────────────────────────────────────
    PUT /api/admin/companies/:id/portale
    Abilita o disabilita il portale self-service per una specifica azienda
    body: { attivo: true | false }
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
    ── ACCOUNT DIPENDENTI ───────────────────────────────────────────────────────
    GET /api/admin/companies/:id/accounts
    Lista degli account dipendenti creati per una specifica azienda
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
    Supporta creazione di fasce per giorni singoli o multipli
    body: {
      nome: 'Turno mattina',
      ora_inizio: '08:00',
      ora_fine: '13:00',
      tipo: 'ENTRATA',
      giorni: ['lunedì'] | ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì']
    }
  */
  fastify.post(
    '/api/admin/companies/:id/fasce',
    { preHandler: authenticateSuperadmin },
    async (request, reply) => {
      try {
        const { id } = request.params
        const { nome, ora_inizio, ora_fine, tipo, giorni } = request.body

        if (!ora_inizio || !ora_fine || !tipo) {
          return reply.status(400).send({ success: false, error: 'MISSING_FIELDS' })
        }

        if (!['ENTRATA', 'USCITA'].includes(tipo)) {
          return reply.status(400).send({ success: false, error: 'TIPO_INVALIDO' })
        }

        const GIORNI_VALIDI = ['lunedì', 'martedì', 'mercoledì', 'giovedì', 'venerdì', 'sabato', 'domenica']
        const giorniSelezionati = (giorni && Array.isArray(giorni)) ? giorni : ['lunedì']

        // Valida i giorni selezionati
        for (const giorno of giorniSelezionati) {
          if (!GIORNI_VALIDI.includes(giorno.toLowerCase())) {
            return reply.status(400).send({ success: false, error: 'GIORNO_INVALIDO' })
          }
        }

        // Crea una fascia per ogni giorno selezionato
        const fascePromises = giorniSelezionati.map(giorno =>
          supabase
            .from('fasce_orarie')
            .insert({
              company_id: id,
              giorno_settimana: giorno.charAt(0).toUpperCase() + giorno.slice(1).toLowerCase(),
              nome:       nome || `${tipo} ${ora_inizio}-${ora_fine}`,
              ora_inizio,
              ora_fine,
              tipo
            })
            .select()
            .single()
        )

        const results = await Promise.all(fascePromises)
        const errors = results.filter(r => r.error)

        if (errors.length > 0) {
          console.log('Errori inserimento fasce:', errors)
          return reply.status(500).send({ success: false, error: 'INSERT_ERROR' })
        }

        const fasce = results.map(r => r.data)

        return reply.send({
          success: true,
          fasce,
          message: `${fasce.length} fascia/e oraria/e create per i giorni selezionati`
        })

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