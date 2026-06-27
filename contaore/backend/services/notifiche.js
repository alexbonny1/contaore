import { supabase } from './supabase.js'
import {
  sendNotificaAssente,
  sendNotificaRitardo,
  sendNotificaStraordinario,
  sendNotificaLettoreOffline,
  sendNotificaComponenteErrore,
  sendRiepilogoGiornaliero,
  sendRiepilogoSettimanale,
  sendNotificaBadgeNonRiconosciuto,
  sendNotificaTimbraturaMancante
} from './email.js'
import { GIORNI, timeToMinutes, shiftDurationMins, shiftExpectedHours } from '../utils/timeHelpers.js'

// ─── helpers ─────────────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function calcHours(reads = []) {
  const sorted = [...reads].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
  let mins = 0, last = null
  for (const r of sorted) {
    if (r.tipo === 'ENTRATA') { last = r }
    else if (r.tipo === 'USCITA' && last) {
      const d = new Date(r.created_at) - new Date(last.created_at)
      if (d > 0) mins += d / 60000
      last = null
    }
  }
  return mins / 60
}

// ─── dedup — prevent duplicate emails in the same day ────────────────────────

const sentSet  = new Set()
let dedupDate  = todayStr()

function canSend(key) {
  const today = todayStr()
  if (today !== dedupDate) { sentSet.clear(); dedupDate = today }
  if (sentSet.has(key)) return false
  sentSet.add(key)
  return true
}

// ─── DB helpers ──────────────────────────────────────────────────────────────

async function ownerEmail(companyId) {
  const { data } = await supabase
    .from('user_account').select('email')
    .eq('company_id', companyId).eq('role', 'owner').maybeSingle()
  return data?.email || null
}

async function companyNome(companyId) {
  const { data } = await supabase
    .from('company').select('nome').eq('id', companyId).maybeSingle()
  return data?.nome || ''
}

async function getActive(tipo) {
  const { data } = await supabase
    .from('notifiche_settings').select('*').eq('tipo', tipo).eq('attiva', true)
  return data || []
}

async function ctx(companyId, emailOverride) {
  const [email, nome] = await Promise.all([ownerEmail(companyId), companyNome(companyId)])
  return { email: emailOverride || email, nome }
}

// ─── event-based (called from scan route) ────────────────────────────────────

export async function onBadgeNonRiconosciuto({ uid, readerId, companyId }) {
  try {
    const key = `${companyId}:badge_nr:${uid}:${todayStr()}`
    if (!canSend(key)) return
    const settings = await getActive('badge_non_riconosciuto')
    const setting  = settings.find(s => s.company_id === companyId)
    if (!setting) return
    const targetIds = setting.target_ids?.length ? setting.target_ids : null
    if (targetIds) {
      const { data: device } = await supabase.from('dispositivo')
        .select('id').eq('reader_id', readerId).eq('company_id', companyId).maybeSingle()
      if (!device || !targetIds.includes(device.id)) return
    }
    const { email, nome } = await ctx(companyId, setting.email_destinatario)
    if (!email) return
    await sendNotificaBadgeNonRiconosciuto({ emailOwner: email, companyNome: nome, uid, readerId })
  } catch (e) { console.error('onBadgeNonRiconosciuto:', e) }
}

export async function onRitardo({ uid, companyId }) {
  try {
    const now     = new Date()
    const nowMins = now.getHours() * 60 + now.getMinutes()
    const todayName = GIORNI[now.getDay()]

    const settings = await getActive('ritardo')
    const setting  = settings.find(s => s.company_id === companyId)
    if (!setting) return

    const minutiTolleranza = setting.parametri?.minuti_tolleranza ?? 5
    const targetIds        = setting.target_ids?.length ? setting.target_ids : null

    const { data: emp } = await supabase.from('dipendenti')
      .select('id, nome, turni_attivi').eq('badge_uid', uid)
      .eq('company_id', companyId).maybeSingle()
    if (!emp?.turni_attivi) return
    if (targetIds && !targetIds.includes(emp.id)) return

    const { data: shifts } = await supabase.from('turni')
      .select('ingresso_1').eq('dipendente_id', emp.id).eq('giorno_settimana', todayName)
    if (!shifts?.length) return

    const isLate = shifts.some(s => s.ingresso_1 && nowMins > timeToMinutes(s.ingresso_1) + minutiTolleranza)
    if (!isLate) return

    const key = `${companyId}:ritardo:${emp.id}:${todayStr()}`
    if (!canSend(key)) return

    const { email, nome } = await ctx(companyId, setting.email_destinatario)
    if (!email) return

    const h = String(now.getHours()).padStart(2, '0')
    const m = String(now.getMinutes()).padStart(2, '0')
    await sendNotificaRitardo({
      emailOwner: email, nomeDipendente: emp.nome, companyNome: nome,
      orarioTurno:  shifts.find(s => s.ingresso_1)?.ingresso_1 || '',
      orarioArrivo: `${h}:${m}`
    })
  } catch (e) { console.error('onRitardo:', e) }
}

// ─── periodic: assenti ────────────────────────────────────────────────────────

export async function checkAssenti() {
  const settings = await getActive('assente')
  if (!settings.length) return

  const now       = new Date()
  const nowMins   = now.getHours() * 60 + now.getMinutes()
  const todayName = GIORNI[now.getDay()]
  const today     = todayStr()

  for (const setting of settings) {
    const cid       = setting.company_id
    const tol       = setting.parametri?.minuti_tolleranza ?? 30
    const targetIds = setting.target_ids?.length ? setting.target_ids : null

    const [{ data: emps }, { data: shifts }, { data: pres }] = await Promise.all([
      supabase.from('dipendenti').select('id, nome, badge_uid').eq('company_id', cid).eq('turni_attivi', true),
      supabase.from('turni').select('*').eq('company_id', cid).eq('giorno_settimana', todayName),
      supabase.from('presenza').select('tag_uid, tipo').eq('company_id', cid).gte('created_at', today + 'T00:00:00.000Z')
    ])

    if (!emps?.length || !shifts?.length) continue

    const entered      = new Set((pres || []).filter(p => p.tipo === 'ENTRATA').map(p => p.tag_uid))
    const filteredEmps = targetIds ? emps.filter(e => targetIds.includes(e.id)) : emps

    for (const emp of filteredEmps) {
      if (entered.has(emp.badge_uid)) continue
      const empShifts = (shifts || []).filter(s => s.dipendente_id === emp.id)
      if (!empShifts.length) continue
      const late = empShifts.some(s => s.ingresso_1 && nowMins >= timeToMinutes(s.ingresso_1) + tol)
      if (!late) continue
      const key = `${cid}:assente:${emp.id}:${today}`
      if (!canSend(key)) continue
      const { email, nome } = await ctx(cid, setting.email_destinatario)
      if (!email) continue
      await sendNotificaAssente({
        emailOwner: email, nomeDipendente: emp.nome, companyNome: nome,
        turnoOra: empShifts.find(s => s.ingresso_1)?.ingresso_1 || ''
      })
    }
  }
}

// ─── periodic: timbratura mancante ───────────────────────────────────────────

export async function checkTimbraturaMancante() {
  const settings = await getActive('timbratura_mancante')
  if (!settings.length) return

  const now   = new Date()
  const today = todayStr()

  for (const setting of settings) {
    const cid       = setting.company_id
    const ore       = setting.parametri?.ore_soglia ?? 10
    const targetIds = setting.target_ids?.length ? setting.target_ids : null

    const [{ data: emps }, { data: pres }] = await Promise.all([
      supabase.from('dipendenti').select('id, nome, badge_uid').eq('company_id', cid),
      supabase.from('presenza').select('tag_uid, tipo, created_at').eq('company_id', cid)
        .gte('created_at', today + 'T00:00:00.000Z').order('created_at', { ascending: true })
    ])

    const filteredEmps = targetIds ? (emps || []).filter(e => targetIds.includes(e.id)) : (emps || [])

    for (const emp of filteredEmps) {
      const empP   = (pres || []).filter(p => p.tag_uid === emp.badge_uid)
      let lastIn   = null
      for (const p of empP) {
        if (p.tipo === 'ENTRATA') lastIn = p
        else if (p.tipo === 'USCITA') lastIn = null
      }
      if (!lastIn) continue
      const hoursSince = (now - new Date(lastIn.created_at)) / 3600000
      if (hoursSince < ore) continue
      const key = `${cid}:mancante:${emp.id}:${today}`
      if (!canSend(key)) continue
      const { email, nome } = await ctx(cid, setting.email_destinatario)
      if (!email) continue
      const dt = new Date(lastIn.created_at)
      const orario = `${String(dt.getHours()).padStart(2,'0')}:${String(dt.getMinutes()).padStart(2,'0')}`
      await sendNotificaTimbraturaMancante({ emailOwner: email, nomeDipendente: emp.nome, companyNome: nome, orarioEntrata: orario })
    }
  }
}

// ─── periodic: lettori offline ───────────────────────────────────────────────

export async function checkLettoriOffline() {
  const settings = await getActive('lettore_offline')
  if (!settings.length) return

  const now   = new Date()
  const today = todayStr()

  for (const setting of settings) {
    const cid       = setting.company_id
    const mins      = setting.parametri?.minuti_assenza ?? 60
    const targetIds = setting.target_ids?.length ? setting.target_ids : null

    const { data: readers } = await supabase.from('dispositivo')
      .select('id, reader_id, nome').eq('company_id', cid)
    if (!readers?.length) continue

    const filteredReaders = targetIds ? readers.filter(r => targetIds.includes(r.id)) : readers

    for (const reader of filteredReaders) {
      const { data: last } = await supabase.from('presenza')
        .select('created_at').eq('company_id', cid).eq('reader_id', reader.reader_id)
        .order('created_at', { ascending: false }).limit(1).maybeSingle()
      if (!last) continue
      const minSince = (now - new Date(last.created_at)) / 60000
      if (minSince < mins) continue
      const key = `${cid}:reader_off:${reader.reader_id}:${today}`
      if (!canSend(key)) continue
      const { email, nome } = await ctx(cid, setting.email_destinatario)
      if (!email) continue
      await sendNotificaLettoreOffline({
        emailOwner: email, companyNome: nome,
        nomeReader: reader.nome || reader.reader_id,
        minutiAssenza: Math.round(minSince)
      })
    }
  }
}

// ─── periodic: riepilogo giornaliero ─────────────────────────────────────────

export async function checkRiepilogoGiornaliero() {
  const settings = await getActive('riepilogo_giornaliero')
  if (!settings.length) return

  const now       = new Date()
  const today     = todayStr()
  const nowMins   = now.getHours() * 60 + now.getMinutes()
  const todayName = GIORNI[now.getDay()]

  for (const setting of settings) {
    const cid = setting.company_id
    const ora = setting.parametri?.ora_invio ?? '18:00'
    if (nowMins < timeToMinutes(ora)) continue
    if (setting.last_triggered_at?.startsWith(today)) continue

    const targetIds = setting.target_ids?.length ? setting.target_ids : null

    const [{ data: emps }, { data: pres }, { data: shifts }] = await Promise.all([
      supabase.from('dipendenti').select('id, nome, badge_uid, turni_attivi').eq('company_id', cid),
      supabase.from('presenza').select('tag_uid, tipo').eq('company_id', cid).gte('created_at', today + 'T00:00:00.000Z'),
      supabase.from('turni').select('dipendente_id').eq('company_id', cid).eq('giorno_settimana', todayName)
    ])

    const lastTipo = {}
    ;(pres || []).forEach(p => { lastTipo[p.tag_uid] = p.tipo })

    const withShift    = new Set((shifts || []).map(s => s.dipendente_id))
    const filteredEmps = targetIds ? (emps || []).filter(e => targetIds.includes(e.id)) : (emps || [])
    const presenti     = [], assenti = []

    for (const emp of filteredEmps) {
      if (lastTipo[emp.badge_uid] === 'ENTRATA') { presenti.push(emp.nome) }
      else if (withShift.has(emp.id) && emp.turni_attivi && !lastTipo[emp.badge_uid]) { assenti.push(emp.nome) }
    }

    const { email, nome } = await ctx(cid)
    if (!email) continue

    await sendRiepilogoGiornaliero({ emailOwner: email, companyNome: nome, data: today, presenti, assenti })
    await supabase.from('notifiche_settings').update({ last_triggered_at: now.toISOString() })
      .eq('company_id', cid).eq('tipo', 'riepilogo_giornaliero')
  }
}

// ─── periodic: riepilogo settimanale ─────────────────────────────────────────

export async function checkRiepilogoSettimanale() {
  const settings = await getActive('riepilogo_settimanale')
  if (!settings.length) return

  const now = new Date()
  if (now.getDay() !== 1) return // solo lunedì

  const today   = todayStr()
  const nowMins = now.getHours() * 60 + now.getMinutes()

  for (const setting of settings) {
    const cid = setting.company_id
    const ora = setting.parametri?.ora_invio ?? '08:00'
    if (nowMins < timeToMinutes(ora)) continue
    if (setting.last_triggered_at?.startsWith(today)) continue

    const lastMon = new Date(now)
    lastMon.setDate(lastMon.getDate() - 7); lastMon.setHours(0, 0, 0, 0)
    const lastSun = new Date(lastMon)
    lastSun.setDate(lastSun.getDate() + 6); lastSun.setHours(23, 59, 59, 999)

    const targetIds = setting.target_ids?.length ? setting.target_ids : null

    const [{ data: emps }, { data: pres }] = await Promise.all([
      supabase.from('dipendenti').select('id, nome, badge_uid').eq('company_id', cid),
      supabase.from('presenza').select('tag_uid, tipo, created_at').eq('company_id', cid)
        .gte('created_at', lastMon.toISOString()).lte('created_at', lastSun.toISOString())
    ])

    const filteredEmps = targetIds ? (emps || []).filter(e => targetIds.includes(e.id)) : (emps || [])
    const empHours     = {}
    for (const emp of filteredEmps) {
      const empP = (pres || []).filter(p => p.tag_uid === emp.badge_uid)
      empHours[emp.nome] = Number(calcHours(empP).toFixed(1))
    }

    const { email, nome } = await ctx(cid)
    if (!email) continue

    const wStart = lastMon.toISOString().split('T')[0]
    const wEnd   = lastSun.toISOString().split('T')[0]
    await sendRiepilogoSettimanale({ emailOwner: email, companyNome: nome, weekStart: wStart, weekEnd: wEnd, empHours })
    await supabase.from('notifiche_settings').update({ last_triggered_at: now.toISOString() })
      .eq('company_id', cid).eq('tipo', 'riepilogo_settimanale')
  }
}

// ─── periodic: straordinario mensile ─────────────────────────────────────────

export async function checkStraordinarioMensile() {
  const settings = await getActive('straordinario_mensile')
  if (!settings.length) return

  const now        = new Date()
  const thisMonth  = now.toISOString().slice(0, 7)

  for (const setting of settings) {
    const cid       = setting.company_id
    const soglia    = setting.parametri?.ore_soglia ?? 10
    const targetIds = setting.target_ids?.length ? setting.target_ids : null

    const [{ data: emps }, { data: pres }, { data: allShifts }] = await Promise.all([
      supabase.from('dipendenti').select('id, nome, badge_uid').eq('company_id', cid).eq('turni_attivi', true),
      supabase.from('presenza').select('tag_uid, tipo, created_at').eq('company_id', cid).gte('created_at', thisMonth + '-01T00:00:00.000Z'),
      supabase.from('turni').select('*').eq('company_id', cid)
    ])

    const filteredEmps = targetIds ? (emps || []).filter(e => targetIds.includes(e.id)) : (emps || [])

    for (const emp of filteredEmps) {
      const empP      = (pres || []).filter(p => p.tag_uid === emp.badge_uid)
      const empShifts = (allShifts || []).filter(s => s.dipendente_id === emp.id)
      const oreLav    = calcHours(empP)

      // Expected hours: sum of shift hours for each day the employee actually worked
      const workedDays = new Set(empP.map(p => p.created_at.split('T')[0]))
      let oreAtt = 0
      workedDays.forEach(day => {
        const dn = GIORNI[new Date(day).getDay()]
        empShifts.filter(s => s.giorno_settimana === dn).forEach(s => { oreAtt += shiftExpectedHours(s) })
      })

      const straord = oreLav - oreAtt
      if (straord < soglia) continue

      const key = `${cid}:straord:${emp.id}:${thisMonth}`
      if (!canSend(key)) continue

      const { email, nome } = await ctx(cid, setting.email_destinatario)
      if (!email) continue

      await sendNotificaStraordinario({
        emailOwner: email, nomeDipendente: emp.nome, companyNome: nome,
        oreStraord: Number(straord.toFixed(1)), soglia
      })
    }
  }
}

// ─── superadmin alert: lettori offline (periodico) + componenti (evento) ─────

async function getAdminSettings() {
  const { data } = await supabase
    .from('admin_settings').select('*').eq('id', 1).maybeSingle()
  return data || null
}

// Helper: true se l'azienda è abilitata agli alert
// alert_companies vuoto/null → tutte le aziende
function companyAlertEnabled(settings, companyId) {
  const list = settings.alert_companies
  if (!Array.isArray(list) || list.length === 0) return true
  return list.includes(companyId)
}

// EVENTO: chiamato dal ping appena un componente passa a errore → avviso SUBITO
export async function onComponenteErrore({ companyId, nomeReader, issues }) {
  try {
    const settings = await getAdminSettings()
    if (!settings?.alert_email || settings.alert_attivo === false) return
    if (!companyAlertEnabled(settings, companyId)) return
    const nome = await companyNome(companyId)
    await sendNotificaComponenteErrore({
      emailAdmin: settings.alert_email, companyNome: nome, nomeReader, issues
    })
  } catch (e) { console.error('onComponenteErrore:', e) }
}

export async function checkAlertSuperadmin() {
  const settings = await getAdminSettings()
  if (!settings?.alert_email || settings.alert_attivo === false) return

  const alertEmail   = settings.alert_email
  const OFFLINE_MINS = settings.offline_minuti ?? 5
  const now = new Date()

  // select('*') — resiliente a colonne mancanti (nome, alert_inviato_at)
  const { data: allDevices, error: devErr } = await supabase
    .from('dispositivo')
    .select('*')

  if (devErr) { console.error('checkAlertSuperadmin select error:', devErr.message); return }
  if (!allDevices?.length) return

  // Filtra per aziende abilitate (alert_companies vuoto → tutte)
  const devices = allDevices.filter(d => companyAlertEnabled(settings, d.company_id))
  if (!devices.length) return

  const companyIds = [...new Set(devices.map(d => d.company_id))]
  const { data: companies } = await supabase
    .from('company').select('id, nome').in('id', companyIds)
  const companyMap = Object.fromEntries((companies || []).map(c => [c.id, c.nome]))

  for (const device of devices) {
    const lastPing      = device.ultimo_ping ? new Date(device.ultimo_ping) : null
    const minsSincePing = lastPing ? (now - lastPing) / 60000 : Infinity
    const isOffline     = minsSincePing > OFFLINE_MINS
    if (!isOffline) continue

    const companyNomeStr = companyMap[device.company_id] || device.company_id
    const nomeReader     = device.nome || device.reader_id
    const alertInviato   = device.alert_inviato_at ? new Date(device.alert_inviato_at) : null
    // Segnala solo se non abbiamo ancora inviato un alert per questo evento offline
    // (alert_inviato_at < ultimo_ping → il reader è tornato online dopo l'ultimo alert → possiamo rialertare)
    const shouldAlert = !alertInviato || (lastPing && alertInviato < lastPing)
    if (!shouldAlert) continue

    await sendNotificaLettoreOffline({
      emailOwner: alertEmail, companyNome: companyNomeStr, nomeReader,
      minutiAssenza: minsSincePing === Infinity ? 999 : Math.round(minsSincePing)
    })
    const { error: updErr } = await supabase.from('dispositivo')
      .update({ alert_inviato_at: now.toISOString() })
      .eq('id', device.id)
    if (updErr) console.error('alert_inviato_at update fallito (migrazione mancante?):', updErr.message)
  }
}

// ─── pulizia automatica storico presenze ───────────────────────────────────────

async function autoCleanupPresenze() {
  // Per ogni company con pulizia automatica attiva, elimina le presenze
  // più vecchie di retention_months.
  let companies
  try {
    const { data, error } = await supabase
      .from('company')
      .select('id, auto_cleanup_enabled, auto_cleanup_retention_months')
      .eq('auto_cleanup_enabled', true)
    if (error) { return } // colonne non ancora presenti → nessuna pulizia
    companies = data || []
  } catch (_) { return }

  for (const c of companies) {
    try {
      const months = Math.max(1, parseInt(c.auto_cleanup_retention_months) || 12)
      const cutoff = new Date()
      cutoff.setMonth(cutoff.getMonth() - months)
      const { data: old } = await supabase
        .from('presenza')
        .select('id')
        .eq('company_id', c.id)
        .lt('created_at', cutoff.toISOString())
      const ids = (old || []).map(r => r.id)
      for (let i = 0; i < ids.length; i += 500) {
        await supabase.from('presenza').delete().in('id', ids.slice(i, i + 500))
      }
    } catch (e) { console.error('autoCleanupPresenze company:', e) }
  }
}

// ─── scheduler ───────────────────────────────────────────────────────────────

export function startScheduler() {
  // Every 1 min: alert superadmin lettori offline (reattivo)
  setInterval(() => {
    checkAlertSuperadmin().catch(e => console.error('checkAlertSuperadmin:', e))
  }, 60 * 1000)

  // Every 5 min: assenze + lettori offline (notifiche aziendali)
  setInterval(() => {
    checkAssenti().catch(e => console.error('checkAssenti:', e))
    checkLettoriOffline().catch(e => console.error('checkLettoriOffline:', e))
  }, 5 * 60 * 1000)

  // Every 30 min: timbrature mancanti + straordinari + riepiloghi
  setInterval(() => {
    checkTimbraturaMancante().catch(e => console.error('checkTimbraturaMancante:', e))
    checkStraordinarioMensile().catch(e => console.error('checkStraordinarioMensile:', e))
    checkRiepilogoGiornaliero().catch(e => console.error('checkRiepilogoGiornaliero:', e))
    checkRiepilogoSettimanale().catch(e => console.error('checkRiepilogoSettimanale:', e))
  }, 30 * 60 * 1000)

  // Every 24h: pulizia automatica storico presenze
  setInterval(() => {
    autoCleanupPresenze().catch(e => console.error('autoCleanupPresenze:', e))
  }, 24 * 60 * 60 * 1000)

}
