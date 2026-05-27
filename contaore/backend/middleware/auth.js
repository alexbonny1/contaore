import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'

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
    request.user  = decoded
  } catch (err) {
    console.log(err)
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
    request.user = decoded
  } catch (err) {
    console.log(err)
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
    request.user = decoded
  } catch (err) {
    console.log(err)
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
    request.user = decoded
  } catch (err) {
    console.log(err)
    return reply.status(401).send({ error: 'INVALID_TOKEN' })
  }
}