import jwt from 'jsonwebtoken'
import bcrypt from 'bcrypt'
import { supabase } from '../services/supabase.js'
import { sendTwoFactorEmail, sendCredenzialiOwner } from '../services/email.js'
import { generateTwoFactorCode, sendTwoFactorCode } from '../services/twilio.js'
import { generatePassword, buildUsername, findAvailableUsername } from '../utils/userHelpers.js'
import { authenticateOwner } from '../middleware/auth.js'

const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) throw new Error('JWT_SECRET env var missing')

// ─── Helper: Verify JWT Token ─────────────────────────────────────────────────
function verifyToken(authHeader) {
  if (!authHeader) throw new Error('TOKEN_MISSING')

  try {
    return jwt.verify(authHeader.replace('Bearer ', ''), JWT_SECRET)
  } catch (err) {
    throw new Error('INVALID_TOKEN')
  }
}

export default async function userSettingsRoutes(fastify) {

  // ─── GET USER SETTINGS (check 2FA status) ──────────────────────────────────
  fastify.get('/api/user/settings', async (request, reply) => {
    try {
      const decoded = verifyToken(request.headers.authorization)

      const { data: user, error } = await supabase
        .from('user_account')
        .select('id, username, email, role, phone_number, two_factor_enabled, two_factor_method')
        .eq('id', decoded.id)
        .single()

      if (error || !user) {
        return reply.status(404).send({ error: 'USER_NOT_FOUND' })
      }

      return reply.send({
        success: true,
        settings: {
          two_factor_enabled: user.two_factor_enabled,
          two_factor_method: user.two_factor_method,
          phone_number: user.phone_number ? user.phone_number.replace(/(?<=.{2}).(?=.{2})/g, '*') : null,
          phone_number_full: user.phone_number // Only return if user requests it
        }
      })

    } catch (err) {
      request.log.error(err)
      if (err.message === 'TOKEN_MISSING') return reply.status(401).send({ error: 'TOKEN_MISSING' })
      if (err.message === 'INVALID_TOKEN') return reply.status(401).send({ error: 'INVALID_TOKEN' })
      return reply.status(500).send({ error: 'SERVER_ERROR' })
    }
  })

  // ─── UPDATE 2FA SETTINGS (method + phone number) ────────────────────────────
  fastify.put('/api/user/2fa-settings', {
    config: {
      rateLimit: {
        max: 5,
        timeWindow: '15 minutes',
        errorResponseBuilder: () => ({ error: 'TOO_MANY_REQUESTS' })
      }
    }
  }, async (request, reply) => {
    try {
      const decoded = verifyToken(request.headers.authorization)
      const { method, phoneNumber } = request.body

      // Validate method
      const validMethods = ['email', 'sms', 'whatsapp']
      if (!method || !validMethods.includes(method)) {
        return reply.status(400).send({ error: 'INVALID_METHOD' })
      }

      // If SMS or WhatsApp, require phone number
      if ((method === 'sms' || method === 'whatsapp') && !phoneNumber) {
        return reply.status(400).send({ error: 'PHONE_NUMBER_REQUIRED' })
      }

      // Get user
      const { data: user, error: userError } = await supabase
        .from('user_account')
        .select('*')
        .eq('id', decoded.id)
        .single()

      if (userError || !user) {
        return reply.status(404).send({ error: 'USER_NOT_FOUND' })
      }

      // Generate verification code
      const code = generateTwoFactorCode()

      // Save 2FA attempt for verification
      const { error: insertError } = await supabase
        .from('two_factor_attempts')
        .insert({
          user_id: user.id,
          code,
          method,
          verified: false
        })

      if (insertError) {
        console.error('2FA settings: error saving code:', insertError.message)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }

      // Send code via new method
      try {
        await sendTwoFactorCode(
          phoneNumber,
          user.email,
          code,
          method,
          sendTwoFactorEmail
        )
      } catch (sendErr) {
        console.error('2FA settings: error sending code:', sendErr.message)
        return reply.status(500).send({ error: 'SEND_CODE_ERROR' })
      }

      // Generate tempToken for verification (include metadata)
      const tempToken = jwt.sign(
        {
          userId: user.id,
          type: '2fa_method_setup',
          method,
          phoneNumber
        },
        JWT_SECRET,
        { expiresIn: '5m' }
      )

      return reply.send({
        status: 'VERIFY_REQUIRED',
        tempToken,
        method,
        message: `Codice inviato via ${method}`
      })

    } catch (err) {
      request.log.error(err)
      if (err.message === 'TOKEN_MISSING') return reply.status(401).send({ error: 'TOKEN_MISSING' })
      if (err.message === 'INVALID_TOKEN') return reply.status(401).send({ error: 'INVALID_TOKEN' })
      return reply.status(500).send({ error: 'SERVER_ERROR' })
    }
  })

  // ─── VERIFY NEW 2FA METHOD ─────────────────────────────────────────────────
  fastify.post('/api/user/verify-2fa-method', async (request, reply) => {
    try {
      const { tempToken, code } = request.body

      if (!tempToken || !code) {
        return reply.status(400).send({ error: 'MISSING_FIELDS' })
      }

      // Verify tempToken
      let decoded
      try {
        decoded = jwt.verify(tempToken, JWT_SECRET)
      } catch {
        return reply.status(401).send({ error: 'INVALID_TOKEN' })
      }

      if (decoded.type !== '2fa_method_setup') {
        return reply.status(401).send({ error: 'INVALID_TOKEN_TYPE' })
      }

      // Find 2FA attempt
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

      // Check attempt limit
      if (attempt.attempts_count >= 5) {
        return reply.status(429).send({ error: 'TOO_MANY_ATTEMPTS' })
      }

      // Mark as verified
      const { error: updateError } = await supabase
        .from('two_factor_attempts')
        .update({ verified: true })
        .eq('id', attempt.id)

      if (updateError) {
        console.error('2FA method verify: error updating attempt:', updateError.message)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }

      // Update user with new method + phone number
      const { error: userUpdateError } = await supabase
        .from('user_account')
        .update({
          two_factor_method: decoded.method,
          phone_number: decoded.phoneNumber || null
        })
        .eq('id', decoded.userId)

      if (userUpdateError) {
        console.error('2FA method verify: error updating user:', userUpdateError.message)
        return reply.status(500).send({ error: 'UPDATE_ERROR' })
      }

      return reply.send({
        success: true,
        message: `Metodo 2FA cambiato a ${decoded.method}`
      })

    } catch (err) {
      request.log.error(err)
      return reply.status(500).send({ error: 'SERVER_ERROR' })
    }
  })

  // ─── TOGGLE 2FA (enable/disable) ────────────────────────────────────────────
  fastify.put('/api/user/toggle-2fa', async (request, reply) => {
    try {
      const decoded = verifyToken(request.headers.authorization)
      const { enabled } = request.body

      if (typeof enabled !== 'boolean') {
        return reply.status(400).send({ error: 'INVALID_ENABLED_VALUE' })
      }

      const { error: updateError } = await supabase
        .from('user_account')
        .update({ two_factor_enabled: enabled })
        .eq('id', decoded.id)

      if (updateError) {
        console.error('2FA toggle: error updating user:', updateError.message)
        return reply.status(500).send({ error: 'UPDATE_ERROR' })
      }

      return reply.send({
        success: true,
        two_factor_enabled: enabled,
        message: `2FA ${enabled ? 'abilitato' : 'disabilitato'}`
      })

    } catch (err) {
      request.log.error(err)
      if (err.message === 'TOKEN_MISSING') return reply.status(401).send({ error: 'TOKEN_MISSING' })
      if (err.message === 'INVALID_TOKEN') return reply.status(401).send({ error: 'INVALID_TOKEN' })
      return reply.status(500).send({ error: 'SERVER_ERROR' })
    }
  })

  // ─── RESEND 2FA CODE (for 2FA settings setup) ──────────────────────────────
  fastify.post('/api/user/resend-2fa-setup-code', {
    config: {
      rateLimit: {
        max: 3,
        timeWindow: '1 minute',
        errorResponseBuilder: () => ({ error: 'TOO_MANY_REQUESTS' })
      }
    }
  }, async (request, reply) => {
    try {
      const { tempToken } = request.body

      if (!tempToken) {
        return reply.status(400).send({ error: 'MISSING_TOKEN' })
      }

      // Verify tempToken
      let decoded
      try {
        decoded = jwt.verify(tempToken, JWT_SECRET)
      } catch {
        return reply.status(401).send({ error: 'INVALID_TOKEN' })
      }

      if (decoded.type !== '2fa_method_setup') {
        return reply.status(401).send({ error: 'INVALID_TOKEN_TYPE' })
      }

      const { data: user } = await supabase
        .from('user_account')
        .select('email')
        .eq('id', decoded.userId)
        .single()

      if (!user) {
        return reply.status(404).send({ error: 'USER_NOT_FOUND' })
      }

      // Invalidate old codes
      await supabase
        .from('two_factor_attempts')
        .update({ verified: true })
        .eq('user_id', decoded.userId)
        .eq('verified', false)

      // Generate new code
      const code = generateTwoFactorCode()

      const { error: insertError } = await supabase
        .from('two_factor_attempts')
        .insert({
          user_id: decoded.userId,
          code,
          method: decoded.method,
          verified: false
        })

      if (insertError) {
        console.error('2FA resend setup: error saving code:', insertError.message)
        return reply.status(500).send({ error: 'SERVER_ERROR' })
      }

      // Send code
      try {
        await sendTwoFactorCode(
          decoded.phoneNumber,
          user.email,
          code,
          decoded.method,
          sendTwoFactorEmail
        )
      } catch (sendErr) {
        console.error('2FA resend setup: error sending code:', sendErr.message)
      }

      return reply.send({
        success: true,
        method: decoded.method,
        message: `Nuovo codice inviato via ${decoded.method}`
      })

    } catch (err) {
      request.log.error(err)
      return reply.status(500).send({ error: 'SERVER_ERROR' })
    }
  })

  // ─── OWNER PROFILE UPDATE ──────────────────────────────────────────────────
  fastify.put('/api/owner/profile', { preHandler: authenticateOwner }, async (request, reply) => {
    try {
      const userId     = request.user.id
      const companyId  = request.user.company_id
      const { nome, cognome, email } = request.body

      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return reply.status(400).send({ error: 'EMAIL_INVALID' })
      }

      // Carica dati attuali — maybeSingle non lancia mai eccezione
      let { data: currentUser, error: fetchErr } = await supabase
        .from('user_account')
        .select('username, email, nome, cognome')
        .eq('id', userId)
        .maybeSingle()

      if (fetchErr || !currentUser) {
        const { data: fallback } = await supabase
          .from('user_account')
          .select('username, email')
          .eq('id', userId)
          .maybeSingle()
        if (!fallback) return reply.status(404).send({ error: 'USER_NOT_FOUND' })
        currentUser = { ...fallback, nome: null, cognome: null }
      }

      // Per account vecchi (nome/cognome null): deriva i valori effettivi dall'username
      const usernameParts    = (currentUser.username || '').split('.')
      const effectiveNome    = currentUser.nome    ?? (usernameParts[0] || null)
      const effectiveCognome = currentUser.cognome ?? (usernameParts.slice(1).join('.') || null)

      const newNome    = nome    !== undefined ? (nome?.trim()    || null) : effectiveNome
      const newCognome = cognome !== undefined ? (cognome?.trim() || null) : effectiveCognome
      const emailChanged   = email   !== undefined && (email?.trim()    || null) !== (currentUser.email || null)
      const nomeChanged    = nome    !== undefined && (nome?.trim()     || null) !== effectiveNome
      const cognomeChanged = cognome !== undefined && (cognome?.trim()  || null) !== effectiveCognome

      // Aggiorna email solo se cambiata
      if (emailChanged) {
        const { error: updateErr } = await supabase
          .from('user_account')
          .update({ email: email?.trim() || null })
          .eq('id', userId)
        if (updateErr) {
          request.log.error(updateErr)
          return reply.status(500).send({ error: 'SERVER_ERROR' })
        }
      }

      // Aggiorna nome/cognome — silente se colonne non esistono ancora
      const extUpdate = {}
      if (nome    !== undefined) extUpdate.nome    = nome?.trim()    || null
      if (cognome !== undefined) extUpdate.cognome = cognome?.trim() || null
      if (Object.keys(extUpdate).length > 0) {
        await supabase.from('user_account').update(extUpdate).eq('id', userId)
      }

      // Se nome, cognome o email cambiano → rigenera username + credenziali
      if (nomeChanged || cognomeChanged || emailChanged) {
        const emailDest = (emailChanged ? email?.trim() : null) || currentUser.email

        // Rigenera username se nome/cognome cambiati — esclude l'utente stesso dal check collisioni
        let newUsername = currentUser.username
        if ((nomeChanged || cognomeChanged) && newNome) {
          const candidateUsername = buildUsername(newNome, newCognome || '')
          const { data: conflict } = await supabase
            .from('user_account').select('id')
            .eq('username', candidateUsername).neq('id', userId).maybeSingle()
          newUsername = conflict ? await findAvailableUsername(candidateUsername) : candidateUsername
          await supabase.from('user_account').update({ username: newUsername }).eq('id', userId)
        }

        // Rigenera password e invia credenziali solo se c'è un'email destinatario
        if (emailDest) {
          const newPwd    = generatePassword()
          const hashedPwd = await bcrypt.hash(newPwd, 10)
          await supabase.from('user_account').update({ password: hashedPwd }).eq('id', userId)

          const { data: company } = await supabase
            .from('company').select('nome').eq('id', companyId).maybeSingle()

          await sendCredenzialiOwner({
            email:       emailDest,
            username:    newUsername,
            password:    newPwd,
            companyNome: company?.nome || '',
            loginUrl:    process.env.FRONTEND_URL || 'https://timbry.it'
          }).catch(e => request.log.error(e))
        }

        return reply.send({ success: true, credenziali_reinviate: !!emailDest })
      }

      return reply.send({ success: true, credenziali_reinviate: false })

    } catch (err) {
      request.log.error(err)
      return reply.status(500).send({ error: 'SERVER_ERROR' })
    }
  })

  // ─── GET OWNER PROFILE ────────────────────────────────────────────────────
  fastify.get('/api/owner/profile', { preHandler: authenticateOwner }, async (request, reply) => {
    try {
      // Prova prima con nome/cognome, poi fallback se le colonne non esistono ancora
      let { data: user, error } = await supabase
        .from('user_account')
        .select('username, email, nome, cognome')
        .eq('id', request.user.id)
        .single()

      if (error) {
        const fallback = await supabase
          .from('user_account')
          .select('username, email')
          .eq('id', request.user.id)
          .single()
        if (fallback.error || !fallback.data) return reply.status(404).send({ error: 'NOT_FOUND' })
        user = { ...fallback.data, nome: null, cognome: null }
      }

      if (!user) return reply.status(404).send({ error: 'NOT_FOUND' })

      return reply.send({ success: true, profile: user })
    } catch (err) {
      request.log.error(err)
      return reply.status(500).send({ error: 'SERVER_ERROR' })
    }
  })

}
