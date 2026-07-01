import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import { validateSession } from '../services/sessions.js'

dotenv.config()

const JWT_SECRET = process.env.JWT_SECRET || 'SUPER_SECRET_KEY'

// ─── qualsiasi utente loggato (owner, superadmin, dipendente) ────────────────
export async function authenticate(request, reply) {
  try {
    const authHeader = request.headers.authorization
    if (!authHeader) {
      return reply.status(401).send({ error: 'TOKEN_MISSING' })
    }
    const token   = authHeader.replace('Bearer ', '')
    const decoded = jwt.verify(token, JWT_SECRET)
    if (!await validateSession(token)) {
      return reply.status(401).send({ error: 'SESSION_EXPIRED' })
    }
    request.user = decoded
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
    if (!await validateSession(token)) {
      return reply.status(401).send({ error: 'SESSION_EXPIRED' })
    }
    request.user = decoded
  } catch (err) {
    request.log.error(err)
    return reply.status(401).send({ error: 'INVALID_TOKEN' })
  }
}

// ─── owner, admin o superadmin (gestione azienda) ────────────────────────────
export async function authenticateOwner(request, reply) {
  try {
    const authHeader = request.headers.authorization
    if (!authHeader) {
      return reply.status(401).send({ error: 'TOKEN_MISSING' })
    }
    const token   = authHeader.replace('Bearer ', '')
    const decoded = jwt.verify(token, JWT_SECRET)
    if (!['owner', 'superadmin', 'admin'].includes(decoded.role)) {
      return reply.status(403).send({ error: 'FORBIDDEN' })
    }
    if (!await validateSession(token)) {
      return reply.status(401).send({ error: 'SESSION_EXPIRED' })
    }
    request.user = decoded
  } catch (err) {
    request.log.error(err)
    return reply.status(401).send({ error: 'INVALID_TOKEN' })
  }
}

// ─── controllo permesso granulare (solo per role === 'admin') ─────────────────
export function requirePermission(perm) {
  return async function (request, reply) {
    if (['owner', 'superadmin'].includes(request.user?.role)) return
    const perms = request.user?.permissions || {}
    if (!perms[perm]) return reply.status(403).send({ error: 'FORBIDDEN' })
  }
}

// ─── basta almeno uno dei permessi indicati (solo per role === 'admin') ───────
export function requireAnyPermission(permsList) {
  return async function (request, reply) {
    if (['owner', 'superadmin'].includes(request.user?.role)) return
    const perms = request.user?.permissions || {}
    if (!permsList.some(p => perms[p])) return reply.status(403).send({ error: 'FORBIDDEN' })
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
    if (!await validateSession(token)) {
      return reply.status(401).send({ error: 'SESSION_EXPIRED' })
    }
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
    const token   = authHeader.replace('Bearer ', '')
    const decoded = jwt.verify(token, JWT_SECRET)
    if (!await validateSession(token)) {
      return reply.status(401).send({ error: 'SESSION_EXPIRED' })
    }
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

    const token   = authHeader.replace('Bearer ', '')
    const decoded = jwt.verify(token, JWT_SECRET)

    if (!await validateSession(token)) {
      return reply.status(401).send({ error: 'SESSION_EXPIRED' })
    }

    // Se 2FA non è abilitato, passa
    if (!decoded.two_factor_enabled) {
      request.user = decoded
      return
    }

    // Calcola inattività
    const lastActivityTime  = new Date(decoded.last_activity_timestamp)
    const now               = new Date()
    const inactivityMinutes = (now - lastActivityTime) / (1000 * 60)

    // Se inattività <= 15 minuti, aggiorna timestamp e procedi
    if (inactivityMinutes <= 15) {
      const jwt_module = (await import('jsonwebtoken')).default
      const newToken   = jwt_module.sign(
        {
          ...decoded,
          last_activity_timestamp: new Date().toISOString()
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      )

      // Rotazione sessione: registra il nuovo token, elimina il vecchio
      const { createSession, deleteSession } = await import('../services/sessions.js')
      await createSession(decoded.id, newToken)
      await deleteSession(token)

      request.user     = decoded
      request.newToken = newToken
      return
    }

    // Inattività > 15 minuti: RICHIEDI 2FA
    reply.status(403).send({
      error:  'TWO_FACTOR_REQUIRED',
      status: 'INACTIVITY_2FA_REQUIRED'
    })
  } catch (err) {
    request.log.error(err)
    return reply.status(401).send({ error: 'INVALID_TOKEN' })
  }
}
