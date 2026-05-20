process.env.TZ = 'Europe/Rome'

import Fastify from 'fastify'
import cors from '@fastify/cors'
import dotenv from 'dotenv'
import deviceRoutes from './routes/devices.js'
import scanRoutes from './routes/scan.js'
import authRoutes from './routes/auth.js'
import employeeRoutes from './routes/employees.js'
import tagRoutes from './routes/tags.js'
import hardwareRoutes from './routes/hardware.js'
import presenzeRoutes from './routes/presenze.js'
import adminRoutes from './routes/admin.js'

dotenv.config()

const fastify = Fastify({
  logger: true
})

await fastify.register(cors, {
  origin: true
})

await fastify.register(presenzeRoutes)
await fastify.register(hardwareRoutes)
await fastify.register(tagRoutes)
await fastify.register(employeeRoutes)
await fastify.register(deviceRoutes)
await fastify.register(authRoutes)
await fastify.register(scanRoutes)
await fastify.register(adminRoutes)

fastify.get('/', async () => {
  return { status: 'ok' }
})

fastify.get('/api/debug-tz', async (request, reply) => {
  const now = new Date()
  return {
    utc:    now.toISOString(),
    locale: now.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }),
    tz:     process.env.TZ,
    offset: now.getTimezoneOffset()
  }
})

const start = async () => {
  try {
    await fastify.listen({
      port: process.env.PORT || 3000,
      host: '0.0.0.0'
    })
    console.log(`SERVER ONLINE PORT ${process.env.PORT || 3000}`)
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

start()
