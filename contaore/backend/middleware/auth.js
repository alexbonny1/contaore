import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import { supabase } from '../services/supabase.js'

dotenv.config()

const JWT_SECRET = process.env.JWT_SECRET || 'SUPER_SECRET_KEY'

// Verifica che il token non sia stato invalidato da un cambio password
async function checkPasswordVersion(decoded, reply) {
  const { data: u } = await supabase
    .from('user_account')
    .select('password_changed_at')
    .eq('id', decoded.id)
    .single()
  const currentVersion = u?.password_changed_at ? new Date(u.password_changed_at).getTime() : 0
  const tokenVersion   = decoded.password_version ?? 0
  if (tokenVersion !== currentVersion) {
    reply.status(401).send({ error: 'SESSION_EXPIRED' })
    return false
  }
  return true
}

// ─── qualsiasi utente loggato (owner, superadmin, dipendente) ────────────────
export async function authenticate(request, reply) {
  try {
    const authHeader = request.headers.authorization
    if (!authHeader) {
      return reply.status(401).send({ error: 'TOKEN_MISSING' })
    }
    const token   = authHeader.replace('Bearer ', '')
    const decoded = jwt.verify(token, JWT_SECRET)
    if (!await checkPasswordVersion(decoded, reply)) return
    request.user  = decoded
  } catch (err) {
    request.log.error(err)
    return reply.status(401).send({ error: 'INVALID_TOKEN' })
  }
}

// ─── solo superadmin ─────────────────────────────────────────────────────────
export async function authenticateSuperadmin(request, reply) {
  try {
    const authHeader = request.headers.authorization
    if (!authHeader) {
      return reply.status(401).send({ error: 'TOKEN_MISSING' })
    }
    const token   = authHeader.replace('Bearer ', '')
    const decoded = jwt.verify(token, JWT_SECRET)
    if (decoded.role !== 'superadmin') {
      return reply.status(403).send({ error: 'FORBIDDEN' })
    }
    if (!await checkPasswordVersion(decoded, reply)) return
    request.user = decoded
  } catch (err) {
    request.log.error(err)
    return reply.status(401).send({ error: 'INVALID_TOKEN' })
  }
}

// ─── solo owner o superadmin (gestione azienda) ───────────────────────────────
export async function authenticateOwner(request, reply) {
  try {
    const authHeader = request.headers.authorization
    if (!authHeader) {
      return reply.status(401).send({ error: 'TOKEN_MISSING' })
    }
    const token   = authHeader.replace('Bearer ', '')
    const decoded = jwt.verify(token, JWT_SECRET)
    if (!['owner', 'superadmin'].includes(decoded.role)) {
      return reply.status(403).send({ error: 'FORBIDDEN' })
    }
    if (!await checkPasswordVersion(decoded, reply)) return
    request.user = decoded
  } catch (err) {
    request.log.error(err)
    return reply.status(401).send({ error: 'INVALID_TOKEN' })
  }
}

// ─── solo dipendente (portale self-service) ───────────────────────────────────
export async function authenticateDipendente(request, reply) {
  try {
    const authHeader = request.headers.authorization
    if (!authHeader) {
      return reply.status(401).send({ error: 'TOKEN_MISSING' })
    }
    const token   = authHeader.replace('Bearer ', '')
    const decoded = jwt.verify(token, JWT_SECRET)
    if (decoded.role !== 'dipendente') {
      return reply.status(403).send({ error: 'FORBIDDEN' })
    }
    if (!await checkPasswordVersion(decoded, reply)) return
    request.user = decoded
  } catch (err) {
    request.log.error(err)
    return reply.status(401).send({ error: 'INVALID_TOKEN' })
  }
}

// ─── autenticazione senza controllo inattività (2FA solo al login) ───────────
export async function authenticateWithInactivity(request, reply) {
  try {
    const authHeader = request.headers.authorization
    if (!authHeader) {
      return reply.status(401).send({ error: 'TOKEN_MISSING' })
    }
    const token = authHeader.replace('Bearer ', '')
    const decoded = jwt.verify(token, JWT_SECRET)
    if (!await checkPasswordVersion(decoded, reply)) return
    request.user = decoded
  } catch (err) {
    request.log.error(err)
    return reply.status(401).send({ error: 'INVALID_TOKEN' })
  }
}

// ─── controlla inattività 2FA (15 minuti) - endpoint helper ──────────────────
export async function checkInactivity(request, reply) {
  try {
    const authHeader = request.headers.authorization
    if (!authHeader) {
      return reply.status(401).send({ error: 'TOKEN_MISSING' })
    }

    const token = authHeader.replace('Bearer ', '')
    const decoded = jwt.verify(token, JWT_SECRET)

    // Se 2FA non è abilitato, passa
    if (!decoded.two_factor_enabled) {
      request.user = decoded
      return
    }

    // Calcola inattività
    const lastActivityTime = new Date(decoded.last_activity_timestamp)
    const now = new Date()
    const inactivityMinutes = (now - lastActivityTime) / (1000 * 60)

    // Se inattività <= 15 minuti, aggiorna timestamp e procedi
    if (inactivityMinutes <= 15) {
      const jwt_module = (await import('jsonwebtoken')).default
      const newToken = jwt_module.sign(
        {
          ...decoded,
          last_activity_timestamp: new Date().toISOString()
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      )
      request.user = decoded
      request.newToken = newToken // Ritorna il nuovo token al client
      return
    }

    // Inattività > 15 minuti: RICHIEDI 2FA
    reply.status(403).send({
      error: 'TWO_FACTOR_REQUIRED',
      status: 'INACTIVITY_2FA_REQUIRED'
    })
  } catch (err) {
    request.log.error(err)
    return reply.status(401).send({ error: 'INVALID_TOKEN' })
  }
}