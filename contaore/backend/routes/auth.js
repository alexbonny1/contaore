import bcrypt from 'bcrypt'
import jwt    from 'jsonwebtoken'
import crypto from 'crypto'
import { supabase } from '../services/supabase.js'
import { sendResetPassword, sendTwoFactorEmail } from '../services/email.js'
import {
  generateTwoFactorCode,
  sendTwoFactorCode,
  sendTwoFactorSMS,
  sendTwoFactorWhatsApp
} from '../services/twilio.js'

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

      // ─── LOGIN SENZA 2FA (al primo login) ──────────────────────────────────
      // 2FA verrà richiesto SOLO dopo 15 minuti di inattività, non al login
      const portale_dipendenti = user.company?.portale_dipendenti ?? false
      const lastActivityTimestamp = new Date().toISOString()

      const token = jwt.sign(
        {
          id:                    user.id,
          username:              user.username,
          email:                 user.email,
          company_id:            user.company_id,
          role:                  user.role,
          dipendente_id:         user.dipendente_id || null,
          portale_dipendenti,
          two_factor_enabled:    user.two_factor_enabled || false,
          last_activity_timestamp: lastActivityTimestamp
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
      console.error(err)
      return reply.status(500).send({ error: 'SERVER_ERROR' })
    }
  })

  // ─── VERIFY 2FA (login) ────────────────────────────────────────────────────
  fastify.post('/api/auth/verify-2fa', {
    config: {
      rateLimit: {
        max: 15,
        timeWindow: '1 minute',
        errorResponseBuilder: () => ({
          error: 'TOO_MANY_REQUESTS'
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { tempToken, code } = request.body

      if (!tempToken || !code) {
        return reply.status(400).send({ error: 'MISSING_FIELDS' })
      }

      // Verifica tempToken
      let decoded
      try {
        decoded = jwt.verify(tempToken, JWT_SECRET)
      } catch {
        return reply.status(401).send({ error: 'INVALID_TOKEN' })
      }

      if (decoded.type !== '2fa_login') {
        return reply.status(401).send({ error: 'INVALID_TOKEN_TYPE' })
      }

      // Cerca il tentativo 2FA
      const { data: attempt, error: findError } = await supabase
        .from('two_factor_attempts')
        .select('*, user:user_account(*)')
        .eq('user_id', decoded.userId)
        .eq('code', code)
        .eq('verified', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (findError || !attempt) {
        // Incrementa tentativo fallito
        await supabase
          .from('two_factor_attempts')
          .update({ attempts_count: attempt?.attempts_count + 1 || 1 })
          .eq('user_id', decoded.userId)

        return reply.status(400).send({ error: 'INVALID_CODE' })
      }

      // Controlla limit tentativi
      if (attempt.attempts_count >= 5) {
        return reply.status(429).send({ error: 'TOO_MANY_ATTEMPTS' })
      }

      // Marca come verificato
      const { error: updateError } = await supabase
        .from('two_factor_attempts')
        .update({ verified: true })
        .eq('id', attempt.id)

      if (updateError) {
        console.error('2FA verify: errore update:', updateError.message)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }

      // Genera JWT completo
      const user = attempt.user
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
      console.error(err)
      return reply.status(500).send({ error: 'SERVER_ERROR' })
    }
  })

  // ─── RESEND 2FA CODE ───────────────────────────────────────────────────────
  fastify.post('/api/auth/resend-2fa-code', {
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '1 minute',
        errorResponseBuilder: () => ({
          error: 'TOO_MANY_REQUESTS'
        })
      }
    }
  }, async (request, reply) => {
    try {
      const { tempToken } = request.body

      if (!tempToken) {
        return reply.status(400).send({ error: 'MISSING_TOKEN' })
      }

      // Verifica tempToken
      let decoded
      try {
        decoded = jwt.verify(tempToken, JWT_SECRET)
      } catch {
        return reply.status(401).send({ error: 'INVALID_TOKEN' })
      }

      if (decoded.type !== '2fa_login') {
        return reply.status(401).send({ error: 'INVALID_TOKEN_TYPE' })
      }

      const { data: user } = await supabase
        .from('user_account')
        .select('*')
        .eq('id', decoded.userId)
        .single()

      if (!user) {
        return reply.status(404).send({ error: 'USER_NOT_FOUND' })
      }

      // Invalida vecchi codici
      await supabase
        .from('two_factor_attempts')
        .update({ verified: true })
        .eq('user_id', user.id)
        .eq('verified', false)

      // Genera nuovo codice
      const code = generateTwoFactorCode()
      const method = user.two_factor_method || 'email'

      const { error: insertError } = await supabase
        .from('two_factor_attempts')
        .insert({
          user_id: user.id,
          code,
          method,
          verified: false
        })

      if (insertError) {
        console.error('2FA resend: errore salvataggio:', insertError.message)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }

      // Invia nuovo codice
      try {
        await sendTwoFactorCode(
          user.phone_number,
          user.email,
          code,
          method,
          sendTwoFactorEmail
        )
      } catch (sendErr) {
        console.error('2FA resend: errore invio:', sendErr.message)
      }

      return reply.send({
        success: true,
        method,
        message: `Nuovo codice inviato via ${method}`
      })

    } catch (err) {
      console.error(err)
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
      console.error(err)
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
      console.error(err)
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
        .select('id, reset_token_expires_at, two_factor_enabled, two_factor_method, phone_number, email')
        .eq('reset_token', token)
        .maybeSingle()

      if (findError || !user) {
        return reply.status(400).send({ error: 'INVALID_TOKEN' })
      }

      if (new Date(user.reset_token_expires_at) < new Date()) {
        return reply.status(400).send({ error: 'TOKEN_EXPIRED' })
      }

      // Hash della nuova password (ma non salvare ancora)
      const hashed = await bcrypt.hash(newPassword, 10)

      // ─── 2FA CHECK PER RESET PASSWORD ──────────────────────────────────────
      if (user.two_factor_enabled === true) {
        // Genera codice 2FA per reset password
        const code = generateTwoFactorCode()
        const method = user.two_factor_method || 'email'

        // Salva in DB con hashedPassword come metadata
        const { error: insertError } = await supabase
          .from('two_factor_attempts')
          .insert({
            user_id: user.id,
            code,
            method,
            verified: false
          })

        if (insertError) {
          console.error('2FA reset: errore salvataggio:', insertError.message)
          return reply.status(500).send({ error: 'SERVER_ERROR' })
        }

        // Invia codice
        try {
          await sendTwoFactorCode(
            user.phone_number,
            user.email,
            code,
            method,
            sendTwoFactorEmail
          )
        } catch (sendErr) {
          console.error('2FA reset: errore invio:', sendErr.message)
        }

        // Genera tempToken2FA (include hashedPassword come payload)
        const tempToken2FA = jwt.sign(
          {
            userId: user.id,
            type: '2fa_reset',
            hashedPassword: hashed,
            resetToken: token,
            method
          },
          JWT_SECRET,
          { expiresIn: '5m' }
        )

        return reply.send({
          status: 'TWO_FACTOR_REQUIRED',
          tempToken: tempToken2FA,
          method,
          message: `Codice inviato via ${method}`
        })
      }

      // ─── RESET SENZA 2FA ───────────────────────────────────────────────────
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
      console.error(err)
      return reply.status(500).send({ error: 'SERVER_ERROR' })
    }
  })

  // ─── VERIFY 2FA FOR RESET PASSWORD ─────────────────────────────────────────
  fastify.post('/api/auth/verify-2fa-reset', async (request, reply) => {
    try {
      const { tempToken, code } = request.body

      if (!tempToken || !code) {
        return reply.status(400).send({ error: 'MISSING_FIELDS' })
      }

      // Verifica tempToken
      let decoded
      try {
        decoded = jwt.verify(tempToken, JWT_SECRET)
      } catch {
        return reply.status(401).send({ error: 'INVALID_TOKEN' })
      }

      if (decoded.type !== '2fa_reset') {
        return reply.status(401).send({ error: 'INVALID_TOKEN_TYPE' })
      }

      // Cerca il tentativo 2FA
      const { data: attempt, error: findError } = await supabase
        .from('two_factor_attempts')
        .select('*')
        .eq('user_id', decoded.userId)
        .eq('code', code)
        .eq('verified', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (findError || !attempt) {
        return reply.status(400).send({ error: 'INVALID_CODE' })
      }

      // Controlla limit tentativi
      if (attempt.attempts_count >= 5) {
        return reply.status(429).send({ error: 'TOO_MANY_ATTEMPTS' })
      }

      // Marca come verificato
      const { error: updateError } = await supabase
        .from('two_factor_attempts')
        .update({ verified: true })
        .eq('id', attempt.id)

      if (updateError) {
        console.error('2FA reset verify: errore update:', updateError.message)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }

      // Completa reset password con hashedPassword dal tempToken
      const { error: resetError } = await supabase
        .from('user_account')
        .update({
          password:               decoded.hashedPassword,
          reset_token:            null,
          reset_token_expires_at: null
        })
        .eq('id', decoded.userId)

      if (resetError) {
        console.error('2FA reset: errore update password:', resetError.message)
        return reply.status(500).send({ error: 'UPDATE_ERROR' })
      }

      return reply.send({ success: true, message: 'Password resettata con successo' })

    } catch (err) {
      console.error(err)
      return reply.status(500).send({ error: 'SERVER_ERROR' })
    }
  })

  // ─── GET 2FA STATUS ────────────────────────────────────────────────────────
  fastify.get('/api/auth/2fa-status', async (request, reply) => {
    try {
      const authHeader = request.headers.authorization
      if (!authHeader) return reply.status(401).send({ error: 'TOKEN_MISSING' })

      let decoded
      try {
        decoded = jwt.verify(authHeader.replace('Bearer ', ''), JWT_SECRET)
      } catch {
        return reply.status(401).send({ error: 'INVALID_TOKEN' })
      }

      const { data: user } = await supabase
        .from('user_account')
        .select('two_factor_enabled, role')
        .eq('id', decoded.id)
        .single()

      if (!user) return reply.status(404).send({ error: 'USER_NOT_FOUND' })

      // Solo titolari possono visualizzare il 2FA
      if (user.role !== 'owner' && user.role !== 'superadmin') {
        return reply.status(403).send({ error: 'FORBIDDEN' })
      }

      return reply.send({ success: true, enabled: user.two_factor_enabled || false })
    } catch (err) {
      console.error(err)
      return reply.status(500).send({ error: 'SERVER_ERROR' })
    }
  })

  // ─── PUT 2FA SETTINGS ──────────────────────────────────────────────────────
  fastify.put('/api/auth/2fa-settings', async (request, reply) => {
    try {
      const authHeader = request.headers.authorization
      if (!authHeader) return reply.status(401).send({ error: 'TOKEN_MISSING' })

      let decoded
      try {
        decoded = jwt.verify(authHeader.replace('Bearer ', ''), JWT_SECRET)
      } catch {
        return reply.status(401).send({ error: 'INVALID_TOKEN' })
      }

      const { two_factor_enabled } = request.body

      if (typeof two_factor_enabled !== 'boolean') {
        return reply.status(400).send({ error: 'INVALID_PARAMS' })
      }

      const { data: user } = await supabase
        .from('user_account')
        .select('role')
        .eq('id', decoded.id)
        .single()

      if (!user) return reply.status(404).send({ error: 'USER_NOT_FOUND' })

      // Solo titolari e superadmin possono cambiare 2FA
      if (user.role !== 'owner' && user.role !== 'superadmin') {
        return reply.status(403).send({ error: 'FORBIDDEN' })
      }

      const { error } = await supabase
        .from('user_account')
        .update({ two_factor_enabled })
        .eq('id', decoded.id)

      if (error) {
        console.log(error)
        return reply.status(500).send({ error: 'UPDATE_ERROR' })
      }

      return reply.send({ success: true, enabled: two_factor_enabled })
    } catch (err) {
      console.error(err)
      return reply.status(500).send({ error: 'SERVER_ERROR' })
    }
  })

  // ─── VERIFY 2FA INACTIVITY ────────────────────────────────────────────────
  fastify.post('/api/auth/verify-2fa-inactivity', async (request, reply) => {
    try {
      const { tempToken, code } = request.body

      if (!tempToken || !code) {
        return reply.status(400).send({ error: 'MISSING_FIELDS' })
      }

      let decoded
      try {
        decoded = jwt.verify(tempToken, JWT_SECRET)
      } catch {
        return reply.status(401).send({ error: 'INVALID_TOKEN' })
      }

      if (decoded.type !== '2fa_inactivity') {
        return reply.status(401).send({ error: 'INVALID_TOKEN_TYPE' })
      }

      // Cerca il tentativo 2FA
      const { data: attempt } = await supabase
        .from('two_factor_attempts')
        .select('*')
        .eq('user_id', decoded.userId)
        .eq('code', code)
        .eq('verified', false)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (!attempt) {
        return reply.status(400).send({ error: 'INVALID_CODE' })
      }

      if (attempt.attempts_count >= 5) {
        return reply.status(429).send({ error: 'TOO_MANY_ATTEMPTS' })
      }

      // Marca come verificato
      const { error: updateError } = await supabase
        .from('two_factor_attempts')
        .update({ verified: true })
        .eq('id', attempt.id)

      if (updateError) {
        console.error('2FA inactivity verify: errore update:', updateError.message)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }

      // Genera nuovo JWT con last_activity_timestamp aggiornato
      const { data: user } = await supabase
        .from('user_account')
        .select('*')
        .eq('id', decoded.userId)
        .single()

      const portale_dipendenti = user.company?.portale_dipendenti ?? false
      const lastActivityTimestamp = new Date().toISOString()

      const token = jwt.sign(
        {
          id:                    user.id,
          username:              user.username,
          email:                 user.email,
          company_id:            user.company_id,
          role:                  user.role,
          dipendente_id:         user.dipendente_id || null,
          portale_dipendenti,
          two_factor_enabled:    user.two_factor_enabled || false,
          last_activity_timestamp: lastActivityTimestamp
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
          company_id:          user.company_id
        }
      })
    } catch (err) {
      console.error(err)
      return reply.status(500).send({ error: 'SERVER_ERROR' })
    }
  })

  // ─── CHECK INACTIVITY (per middleware) ─────────────────────────────────────
  fastify.post('/api/auth/check-inactivity', async (request, reply) => {
    try {
      const authHeader = request.headers.authorization
      if (!authHeader) return reply.status(401).send({ error: 'TOKEN_MISSING' })

      let decoded
      try {
        decoded = jwt.verify(authHeader.replace('Bearer ', ''), JWT_SECRET)
      } catch {
        return reply.status(401).send({ error: 'INVALID_TOKEN' })
      }

      // Se 2FA non è abilitato, passa
      if (!decoded.two_factor_enabled) {
        return reply.send({ success: true, needsTwoFactor: false })
      }

      // Calcola inattività
      const lastActivityTime = new Date(decoded.last_activity_timestamp)
      const now = new Date()
      const inactivityMinutes = (now - lastActivityTime) / (1000 * 60)

      // Se inattività > 15 minuti, richiedi 2FA
      if (inactivityMinutes > 15) {
        // Genera codice 2FA
        const code = generateTwoFactorCode()
        const method = decoded.two_factor_method || 'email'

        // Salva tentativo in DB
        const { error: insertError } = await supabase
          .from('two_factor_attempts')
          .insert({
            user_id: decoded.id,
            code,
            method,
            verified: false
          })

        if (insertError) {
          console.error('2FA inactivity: errore salvataggio:', insertError.message)
          return reply.status(500).send({ error: 'SERVER_ERROR' })
        }

        // Invia codice
        try {
          await sendTwoFactorCode(
            decoded.phone_number,
            decoded.email,
            code,
            method,
            sendTwoFactorEmail
          )
        } catch (sendErr) {
          console.error('2FA inactivity: errore invio:', sendErr.message)
        }

        // Genera tempToken
        const tempToken = jwt.sign(
          {
            userId: decoded.id,
            type: '2fa_inactivity',
            method
          },
          JWT_SECRET,
          { expiresIn: '5m' }
        )

        return reply.send({
          success: false,
          status: 'TWO_FACTOR_REQUIRED',
          tempToken,
          method,
          message: `Codice di verifica inviato via ${method}`
        })
      }

      // Inattività < 15 minuti, aggiorna timestamp
      const newToken = jwt.sign(
        {
          ...decoded,
          last_activity_timestamp: new Date().toISOString()
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      )

      return reply.send({ success: true, needsTwoFactor: false, token: newToken })
    } catch (err) {
      console.error(err)
      return reply.status(500).send({ error: 'SERVER_ERROR' })
    }
  })
}
