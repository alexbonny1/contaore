import { supabase } from '../services/supabase.js'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function createAuditLogger() {
  return async (request, reply) => {
    if (!['POST', 'PUT', 'DELETE', 'PATCH'].includes(request.method)) {
      return
    }

    const onSend = async (request, reply, payload) => {
      try {
        if (reply.statusCode >= 400) return payload

        const auditEntry = {
          company_id: request.user?.company_id,
          user_id: request.user?.id,
          action: `${request.method.toLowerCase()}_${extractResourceType(request.url)}`,
          resource_type: extractResourceType(request.url),
          resource_id: extractResourceId(request.url),
          old_state: request.previousState || null,
          new_state: request.body || null,
          ip_address: request.ip,
          user_agent: request.headers['user-agent']
        }

        if (auditEntry.company_id && auditEntry.user_id) {
          await supabase.from('audit_log').insert(auditEntry)
        }

        const logDir = path.join(__dirname, '..', 'logs')
        if (!fs.existsSync(logDir)) fs.mkdirSync(logDir)

        const today = new Date().toISOString().split('T')[0]
        const logFile = path.join(logDir, `audit-${today}.jsonl`)
        fs.appendFileSync(logFile, JSON.stringify(auditEntry) + '\n')
      } catch (err) {
        console.error('Audit logging error:', err)
      }

      return payload
    }

    reply.addHook('onSend', onSend)
  }
}

function extractResourceType(url) {
  const parts = url.split('/').filter(p => p)
  return parts[1] || 'unknown'
}

function extractResourceId(url) {
  const parts = url.split('/').filter(p => p)
  return parts[2] || null
}
