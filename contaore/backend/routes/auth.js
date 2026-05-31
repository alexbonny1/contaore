import bcrypt from 'bcrypt'
import jwt    from 'jsonwebtoken'
import crypto from 'crypto'
import { supabase } from '../services/supabase.js'
import { sendResetPassword } from '../services/email.js'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error('Variabile d\'ambiente JWT_SECRET mancante')

export default async function authRoutes(fastify) {

  // ─── LOGIN ────────────────────────────────────────────────────────────────
  fastify.post('/api/auth/login', {
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '1 minute',
        errorResponseBuilder: () => ({
          error: 'TOO_MANY_REQUESTS'
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { username, password } = request.body

      if (!username || !password) {
        return reply.status(400).send({ error: 'MISSING_FIELDS' })
      }

      const { data: user, error } = await supabase
        .from('user_account')
        .select('*, company:company(portale_dipendenti)')
        .or(`username.eq.${username},email.eq.${username}`)
        .single()

      if (error || !user) {
        return reply.status(401).send({ error: 'INVALID_CREDENTIALS' })
      }

      const validPassword = await bcrypt.compare(password, user.password)

      if (!validPassword) {
        return reply.status(401).send({ error: 'INVALID_CREDENTIALS' })
      }

      const portale_dipendenti = user.company?.portale_dipendenti ?? false

      const token = jwt.sign(
        {
          id:                  user.id,
          username:            user.username,
          email:               user.email,
          company_id:          user.company_id,
          role:                user.role,
          dipendente_id:       user.dipendente_id || null,
          portale_dipendenti
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      )

      return reply.send({
        success: true,
        token,
        user: {
          id:                  user.id,
          username:            user.username,
          email:               user.email,
          role:                user.role,
          company_id:          user.company_id,
          dipendente_id:       user.dipendente_id || null,
          portale_dipendenti
        }
      })

    } catch (err) {
      console.log(err)
      return reply.status(500).send({ error: 'SERVER_ERROR' })
    }
  })

  // ─── CAMBIA PASSWORD (utente loggato) ─────────────────────────────────────
  fastify.post('/api/auth/change-password', async (request, reply) => {
    try {
      const authHeader = request.headers.authorization
      if (!authHeader) return reply.status(401).send({ error: 'TOKEN_MISSING' })

      let decoded
      try {
        decoded = jwt.verify(authHeader.replace('Bearer ', ''), JWT_SECRET)
      } catch {
        return reply.status(401).send({ error: 'INVALID_TOKEN' })
      }

      const { currentPassword, newPassword } = request.body

      if (!currentPassword || !newPassword) {
        return reply.status(400).send({ error: 'MISSING_FIELDS' })
      }

      if (newPassword.length < 6) {
        return reply.status(400).send({ error: 'PASSWORD_TOO_SHORT' })
      }

      const { data: user, error } = await supabase
        .from('user_account')
        .select('*')
        .eq('id', decoded.id)
        .single()

      if (error || !user) {
        return reply.status(404).send({ error: 'USER_NOT_FOUND' })
      }

      const valid = await bcrypt.compare(currentPassword, user.password)
      if (!valid) {
        return reply.status(401).send({ error: 'WRONG_CURRENT_PASSWORD' })
      }

      const hashed = await bcrypt.hash(newPassword, 10)

      const { error: updateError } = await supabase
        .from('user_account')
        .update({ password: hashed })
        .eq('id', decoded.id)

      if (updateError) {
        return reply.status(500).send({ error: 'UPDATE_ERROR' })
      }

      return reply.send({ success: true })

    } catch (err) {
      console.log(err)
      return reply.status(500).send({ error: 'SERVER_ERROR' })
    }
  })

  // ─── FORGOT PASSWORD — invia email con link reset ─────────────────────────
  fastify.post('/api/auth/forgot-password', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '15 minutes',
        errorResponseBuilder: () => ({
          error: 'TOO_MANY_REQUESTS'
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { email } = request.body

      if (!email) {
        return reply.status(400).send({ error: 'MISSING_EMAIL' })
      }

      const { data: user, error: findError } = await supabase
        .from('user_account')
        .select('id, username, email, role')
        .eq('email', email.trim().toLowerCase())
        .maybeSingle()

      // Rispondi sempre success per non rivelare se l'email esiste
      if (findError || !user) {
        return reply.send({ success: true })
      }

      // Genera token reset (valido 1 ora)
      const resetToken = crypto.randomBytes(32).toString('hex')
      const expiresAt  = new Date(Date.now() + 60 * 60 * 1000).toISOString()

      const { error: updateError } = await supabase
        .from('user_account')
        .update({
          reset_token:            resetToken,
          reset_token_expires_at: expiresAt
        })
        .eq('id', user.id)

      if (updateError) {
        // Le colonne reset_token / reset_token_expires_at potrebbero non esistere nel DB.
        // Aggiungile su Supabase: ALTER TABLE user_account ADD COLUMN reset_token text, ADD COLUMN reset_token_expires_at timestamptz;
        console.error('forgot-password: errore update reset_token:', updateError.message)
        console.error('VERIFICA: le colonne reset_token e reset_token_expires_at esistono in user_account?')
        return reply.status(500).send({ error: 'DB_RESET_TOKEN_ERROR' })
      }

      const frontendUrl = request.headers.origin || process.env.FRONTEND_URL || 'http://localhost:5173'
      const resetUrl = `${frontendUrl}/reset-password?token=${resetToken}`

      const emailInviata = await sendResetPassword({
        email:    user.email,
        username: user.username,
        resetUrl
      })

      if (!emailInviata) {
        console.error('forgot-password: invio email fallito per', user.email)
        // Non bloccare — l'utente vede messaggio generico
      }

      console.log('forgot-password: reset richiesto - email inviata:', emailInviata)
      return reply.send({ success: true })

    } catch (err) {
      console.log(err)
      return reply.status(500).send({ error: 'SERVER_ERROR' })
    }
  })

  // ─── RESET PASSWORD — imposta nuova password dal token ────────────────────
  fastify.post('/api/auth/reset-password', async (request, reply) => {
    try {
      const { token, newPassword } = request.body

      if (!token || !newPassword) {
        return reply.status(400).send({ error: 'MISSING_FIELDS' })
      }

      if (newPassword.length < 6) {
        return reply.status(400).send({ error: 'PASSWORD_TOO_SHORT' })
      }

      const { data: user, error: findError } = await supabase
        .from('user_account')
        .select('id, reset_token_expires_at')
        .eq('reset_token', token)
        .maybeSingle()

      if (findError || !user) {
        return reply.status(400).send({ error: 'INVALID_TOKEN' })
      }

      if (new Date(user.reset_token_expires_at) < new Date()) {
        return reply.status(400).send({ error: 'TOKEN_EXPIRED' })
      }

      const hashed = await bcrypt.hash(newPassword, 10)

      const { error: updateError } = await supabase
        .from('user_account')
        .update({
          password:               hashed,
          reset_token:            null,
          reset_token_expires_at: null
        })
        .eq('id', user.id)

      if (updateError) {
        console.error('reset-password: errore update:', updateError.message)
        return reply.status(500).send({ error: 'UPDATE_ERROR' })
      }

      return reply.send({ success: true })

    } catch (err) {
      console.log(err)
      return reply.status(500).send({ error: 'SERVER_ERROR' })
    }
  })
}
