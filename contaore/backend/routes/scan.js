import { supabase }    from '../services/supabase.js'
import { authenticate } from '../middleware/auth.js'
import latestReads      from '../state/LatestReads.js'
import { onBadgeNonRiconosciuto, onRitardo } from '../services/notifiche.js'

const GIORNI_IT = ['Domenica','Lunedì','Martedì','Mercoledì','Giovedì','Venerdì','Sabato']
function timeMins(t) { const [h, m] = t.split(':').map(Number); return h * 60 + m }

export default async function scanRoutes(fastify) {

  /*
    REGISTER PRESENCE
  */
 
  fastify.post(
    '/api/scan',
    async (request, reply) => {

      try {

        const {
          uid,
          reader_id
        } = request.body

        if (!uid) {
          return reply.send({ success: false })
        }
 
        // SECURITY FIX: Validate that reader_id is provided (REQUIRED)
        if (!reader_id) {
          return reply.send({
            success: false,
            error: 'READER_ID_REQUIRED'
          })
        }

        // SECURITY FIX: Validate that reader exists and get its company_id
        const { data: reader, error: readerError } = await supabase
          .from('dispositivo')
          .select('company_id')
          .eq('reader_id', reader_id)
          .maybeSingle()

        // Reader must exist and have a company_id association
        if (readerError || !reader) {
          return reply.send({
            success: false,
            error: 'READER_NOT_FOUND'
          })
        }

        const readerCompanyId = reader.company_id

        latestReads[readerCompanyId] = {
          uid,
          reader_id,
          timestamp: Date.now()
        }

        // SECURITY FIX: Query tag with company_id filter (prevent cross-company reads)
        const {
          data: tag,
          error: tagError
        } = await supabase
          .from('tag')
          .select('*')
          .eq('uid', uid)
          .eq('company_id', readerCompanyId)
          .single()

        if (tagError || !tag) {
          // Fire-and-forget notification for unknown badge
          onBadgeNonRiconosciuto({ uid, readerId, companyId: readerCompanyId })
          return reply.send({
            success: false,
            error: 'TAG_COMPANY_MISMATCH'
          })
        }

        const limitDate =
          new Date(Date.now() - 5000).toISOString()

        // SECURITY FIX: Add company_id filter to latestPresence query
        const { data: latestPresence } = await supabase
          .from('presenza')
          .select('*')
          .eq('tag_uid', uid)
          .eq('company_id', readerCompanyId)
          .gte('created_at', limitDate)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (latestPresence) {
          return reply.send({ success: true, ignored: true })
        }

        // SECURITY FIX: Add company_id filter to lastPresence query
        // Fetch recent scans to determine session state (session-aware, not just last scan tipo)
        const twoDaysAgo = new Date(Date.now() - 2 * 24 * 3600000).toISOString()
        const { data: recentScans } = await supabase
          .from('presenza')
          .select('tipo, created_at')
          .eq('tag_uid', uid)
          .eq('company_id', readerCompanyId)
          .gte('created_at', twoDaysAgo)
          .order('created_at', { ascending: true })

        // Determine session state: track open/closed sessions with 18h stale limit
        // This prevents "forgot USCITA yesterday → today's entry becomes USCITA" bug
        let sessionOpen = false
        let lastEntrataTime = null
        for (const s of (recentScans || [])) {
          if (s.tipo === 'ENTRATA') {
            sessionOpen = true
            lastEntrataTime = new Date(s.created_at)
          } else if (s.tipo === 'USCITA' && sessionOpen) {
            sessionOpen = false
            lastEntrataTime = null
          }
        }
        // Stale session (>18h since ENTRATA with no USCITA) → treat as outside
        if (sessionOpen && lastEntrataTime && Date.now() - lastEntrataTime > 18 * 3600000) {
          sessionOpen = false
        }

        // Shift-aware: if session is closed but employee is in their shift window
        // and has NO ENTRATA today → they probably forgot to enter → force USCITA
        if (!sessionOpen) {
          try {
            const { data: emp } = await supabase
              .from('dipendenti').select('id, turni_attivi')
              .eq('badge_uid', uid).eq('company_id', readerCompanyId).maybeSingle()

            if (emp?.turni_attivi) {
              const now     = new Date()
              const dayName = GIORNI_IT[now.getDay()]
              const nowMins = now.getHours() * 60 + now.getMinutes()
              const todayStr = now.toISOString().split('T')[0]

              const { data: turni } = await supabase
                .from('turni').select('ingresso_1, uscita_1, ingresso_2, uscita_2')
                .eq('dipendente_id', emp.id).eq('giorno_settimana', dayName)

              if (turni?.length > 0) {
                const hasEntrataToday = (recentScans || []).some(s =>
                  s.tipo === 'ENTRATA' && s.created_at.startsWith(todayStr)
                )

                if (!hasEntrataToday) {
                  const inShiftWindow = turni.some(t => {
                    if (!t.ingresso_1 || !t.uscita_1) return false
                    const ingr  = timeMins(t.ingresso_1)
                    const usc1  = timeMins(t.uscita_1)
                    const usc2  = t.uscita_2 ? timeMins(t.uscita_2) : null
                    const inF1  = nowMins >= ingr  && nowMins <= usc1 + 120
                    const inF2  = usc2 && t.ingresso_2 && nowMins >= timeMins(t.ingresso_2) && nowMins <= usc2 + 120
                    return inF1 || inF2
                  })
                  if (inShiftWindow) sessionOpen = true // no ENTRATA today + in shift window → USCITA
                }
              }
            }
          } catch (_) { /* shift lookup failed, use session-based tipo */ }
        }

        const tipo = sessionOpen ? 'USCITA' : 'ENTRATA'

        const { error } = await supabase
          .from('presenza')
          .insert({
            company_id: readerCompanyId,
            tag_uid:    uid,
            reader_id:  reader_id || null,
            tipo
          })

        if (error) {
          console.log(error)
          return reply.send({ success: false })
        }

        // Fire-and-forget: check for late arrival
        if (tipo === 'ENTRATA') {
          onRitardo({ uid, companyId: readerCompanyId })
        }

        return reply.send({ success: true, tipo })

      } catch (err) {

        console.log(err)
        return reply.send({ success: false })

      }

    }
  )

  /*
    GET LATEST READ
  */

  fastify.get(
    '/api/latest-read',
    { preHandler: authenticate },
    async (request, reply) => {

      try {

        const companyId = request.user.company_id
        const { after } = request.query

        const lastRead = latestReads[companyId]

        if (!lastRead) {
          return reply.send({ success: false })
        }

        if (after && lastRead.timestamp <= new Date(after).getTime()) {
          return reply.send({ success: false })
        }

        return reply.send({
          success: true,
          uid: lastRead.uid
        })

      } catch (err) {

        console.log(err)
        return reply.send({ success: false })

      }

    }
  )

}
