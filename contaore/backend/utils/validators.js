import { z } from 'zod'

export const schemas = {
  createEmployeeSchema: z.object({
    nome: z.string().min(1).max(100),
    cognome: z.string().min(1).max(100),
    email: z.string().email().optional(),
    data_inizio: z.string().date().optional(),
    turni_attivi: z.boolean().optional()
  }),

  updateEmployeeSchema: z.object({
    nome: z.string().min(1).max(100).optional(),
    cognome: z.string().min(1).max(100).optional(),
    email: z.string().email().optional(),
    data_inizio: z.string().date().optional(),
    turni_attivi: z.boolean().optional()
  }),

  createShiftSchema: z.object({
    turno_nome: z.string().max(100).optional(),
    giorno_settimana: z.enum(['Lunedì', 'Martedì', 'Mercoledì', 'Giovedì', 'Venerdì', 'Sabato', 'Domenica']),
    ingresso_1: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    uscita_1: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    ingresso_2: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    uscita_2: z.string().regex(/^\d{2}:\d{2}$/).optional()
  }),

  createRequestSchema: z.object({
    data: z.string().date(),
    tipo: z.enum(['ENTRATA', 'USCITA']),
    ora_uscita: z.string().regex(/^\d{2}:\d{2}$/),
    motivo: z.string().min(3).max(500)
  }),

  createPermessoSchema: z.object({
    data_uscita: z.string().date().optional(),
    ora_uscita: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    data_entrata: z.string().date().optional(),
    ora_entrata: z.string().regex(/^\d{2}:\d{2}$/).optional(),
    tipo: z.enum(['personale', 'medico', 'altro']).default('personale'),
    motivo: z.string().min(3).max(500)
  })
}

export function validateBody(schema) {
  return async (request, reply) => {
    try {
      request.validatedBody = schema.parse(request.body)
    } catch (error) {
      return reply.status(400).send({
        error: 'VALIDATION_ERROR',
        details: error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message
        }))
      })
    }
  }
}
