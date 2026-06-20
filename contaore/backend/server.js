import Fastify from 'fastify'
import cors from '@fastify/cors'
import rateLimit from '@fastify/rate-limit'
import helmet from '@fastify/helmet'
import dotenv from 'dotenv'
import fs from 'fs'
import { runMigrations } from './migrations/runMigrations.js'
import { createAuditLogger } from './middleware/audit.js'
import deviceRoutes from './routes/devices.js'
import scanRoutes from './routes/scan.js'
import authRoutes from './routes/auth.js'
import userSettingsRoutes from './routes/user-settings.js'
import employeeRoutes from './routes/employees.js'
import tagRoutes from './routes/tags.js'
import hardwareRoutes from './routes/hardware.js'
import presenzeRoutes from './routes/presenze.js'
import adminRoutes from './routes/admin.js'
import exportRoutes from './routes/export.js'
import dipendenteRoutes from './routes/dipendente.js'   // ← nuovo
import ferieRoutes      from './routes/ferie.js'
import requestsRoutes   from './routes/requests.js'    // ← nuovo
import pauseRoutes      from './routes/pause.js'       // ← nuovo
import notificheRoutes  from './routes/notifiche.js'
import { startScheduler } from './services/notifiche.js'

dotenv.config()

const options = {
  logger: {
    level: process.env.LOG_LEVEL || 'info',
    transport: process.env.NODE_ENV === 'production' ? undefined : {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname'
      }
    }
  }
}

if (process.env.NODE_ENV === 'production' && process.env.TLS_KEY_PATH && process.env.TLS_CERT_PATH) {
  options.https = {
    key: fs.readFileSync(process.env.TLS_KEY_PATH),
    cert: fs.readFileSync(process.env.TLS_CERT_PATH)
  }
}

const fastify = Fastify(options)

await fastify.register(cors, {
  origin: process.env.FRONTEND_URL || 'http://localhost:5173'
})

await fastify.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  frameguard: { action: 'deny' },
  noSniff: true,
  xssFilter: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
})

await fastify.register(rateLimit, {
  max: 30,
  timeWindow: '1 minute',
  cache: 10000,
  allowList: ['127.0.0.1']
})

fastify.addHook('preHandler', createAuditLogger())

await fastify.register(exportRoutes)
await fastify.register(presenzeRoutes)
await fastify.register(hardwareRoutes)
await fastify.register(tagRoutes)
await fastify.register(employeeRoutes)
await fastify.register(deviceRoutes)
await fastify.register(authRoutes)
await fastify.register(userSettingsRoutes)
await fastify.register(scanRoutes)
await fastify.register(adminRoutes)
await fastify.register(dipendenteRoutes)   // ← nuovo
await fastify.register(ferieRoutes)
await fastify.register(requestsRoutes)     // ← nuovo
await fastify.register(pauseRoutes)        // ← nuovo
await fastify.register(notificheRoutes)

fastify.get('/', async () => {
  return {
    status: 'ok'
  }
})

const start = async () => {

  try {

    // Run database migrations
    await runMigrations()

    await fastify.listen({
      port: process.env.PORT || 3000,
      host: '0.0.0.0'
    })

    console.log(`SERVER ONLINE PORT ${process.env.PORT || 3000}`)
    startScheduler()

  } catch (err) {

    fastify.log.error(err)
    process.exit(1)

  }

}

start()