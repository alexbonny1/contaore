/*
  EMAIL SERVICE — usa Resend (gratis fino a 3000 email/mese)

  Setup:
  1. Vai su https://resend.com e crea un account
  2. Crea un API key
  3. Aggiungi in Railway: RESEND_API_KEY=re_xxxxxxxxxxxx
  4. Aggiungi in Railway: EMAIL_FROM=noreply@timbry.it
     (oppure usa l'indirizzo di default Resend: onboarding@resend.dev
      finché non hai un dominio verificato)

  Installa: npm install resend
*/

import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

const FROM = process.env.EMAIL_FROM || 'Timbry <onboarding@resend.dev>'

// ─── Invia credenziali al TITOLARE quando il superadmin crea l'azienda ───────
export async function sendCredenzialiOwner({ email, username, password, companyNome }) {
  try {
    const { data, error } = await resend.emails.send({
      from:    FROM,
      to:      email,
      subject: `Benvenuto su Timbry — Le credenziali di ${companyNome}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f5f4f0;">
          <div style="background:#fff;border-radius:8px;padding:32px;border:1px solid #dddbd7;">
            <p style="font-family:monospace;font-size:13px;color:#2563eb;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 16px;">TIMBRY</p>
            <h2 style="font-size:22px;font-weight:600;color:#1a1a1a;margin:0 0 8px;">Benvenuto su Timbry!</h2>
            <p style="font-size:15px;color:#6b6b6b;margin:0 0 24px;line-height:1.6;">
              L'azienda <strong style="color:#1a1a1a;">${companyNome}</strong> è stata creata con successo.
              Usa le credenziali qui sotto per accedere al pannello di gestione.
            </p>

            <div style="background:#f5f4f0;border-radius:6px;padding:20px 24px;margin-bottom:24px;">
              <p style="margin:0 0 8px;font-size:13px;color:#6b6b6b;">Username</p>
              <p style="margin:0 0 16px;font-family:monospace;font-size:18px;font-weight:600;color:#1a1a1a;">${username}</p>
              <p style="margin:0 0 8px;font-size:13px;color:#6b6b6b;">Password</p>
              <p style="margin:0;font-family:monospace;font-size:18px;font-weight:600;color:#1a1a1a;">${password}</p>
            </div>

            <p style="font-size:13px;color:#6b6b6b;margin:0 0 20px;line-height:1.6;">
              Dal pannello puoi gestire i dipendenti, visualizzare le presenze,
              approvare richieste di ferie e giustificazioni, e configurare i turni.
            </p>

            <p style="font-size:12px;color:#aaa;margin:0;line-height:1.5;">
              Conserva questa email in un posto sicuro.
              Per motivi di sicurezza non possiamo recuperare la password.
            </p>
          </div>
        </div>
      `
    })

    if (error) {
      console.error('Resend error (owner):', error)
      return false
    }

    console.log('Email credenziali owner inviata a', email, '- ID:', data?.id)
    return true

  } catch (err) {
    console.error('sendCredenzialiOwner error:', err)
    return false
  }
}

// ─── Invia credenziali al dipendente appena creato ───────────────────────────
export async function sendCredenziali({ email, nome, username, password, companyNome }) {
  try {
    const { data, error } = await resend.emails.send({
      from:    FROM,
      to:      email,
      subject: `Le tue credenziali Timbry — ${companyNome}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f5f4f0;">
          <div style="background:#fff;border-radius:8px;padding:32px;border:1px solid #dddbd7;">
            <p style="font-family:monospace;font-size:13px;color:#2563eb;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 16px;">TIMBRY</p>
            <h2 style="font-size:22px;font-weight:600;color:#1a1a1a;margin:0 0 8px;">Ciao ${nome}!</h2>
            <p style="font-size:15px;color:#6b6b6b;margin:0 0 24px;line-height:1.6;">
              L'azienda <strong style="color:#1a1a1a;">${companyNome}</strong> ti ha aggiunto al portale presenze Timbry.
              Usa le credenziali qui sotto per accedere.
            </p>

            <div style="background:#f5f4f0;border-radius:6px;padding:20px 24px;margin-bottom:24px;">
              <p style="margin:0 0 8px;font-size:13px;color:#6b6b6b;">Username</p>
              <p style="margin:0 0 16px;font-family:monospace;font-size:18px;font-weight:600;color:#1a1a1a;">${username}</p>
              <p style="margin:0 0 8px;font-size:13px;color:#6b6b6b;">Password</p>
              <p style="margin:0;font-family:monospace;font-size:18px;font-weight:600;color:#1a1a1a;">${password}</p>
            </div>

            <p style="font-size:13px;color:#6b6b6b;margin:0 0 20px;line-height:1.6;">
              Dal portale puoi vedere i tuoi turni, le ore lavorate, le assenze
              e fare richieste di ferie o giustificazioni.
            </p>

            <p style="font-size:12px;color:#aaa;margin:0;line-height:1.5;">
              Conserva questa email in un posto sicuro. 
              Per motivi di sicurezza non possiamo recuperare la password — 
              se la perdi contatta il tuo responsabile.
            </p>
          </div>
        </div>
      `
    })

    if (error) {
      console.error('Resend error:', error)
      return false
    }

    console.log('Email credenziali inviata a', email, '- ID:', data?.id)
    return true

  } catch (err) {
    console.error('sendCredenziali error:', err)
    return false
  }
}

// ─── Notifica al titolare: nuova richiesta ferie ──────────────────────────────
export async function sendNotificaRichiestaFerie({ emailOwner, nomeDipendente, dataInizio, dataFine, companyNome }) {
  try {
    await resend.emails.send({
      from:    FROM,
      to:      emailOwner,
      subject: `Nuova richiesta ferie — ${nomeDipendente}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f5f4f0;">
          <div style="background:#fff;border-radius:8px;padding:32px;border:1px solid #dddbd7;">
            <p style="font-family:monospace;font-size:13px;color:#2563eb;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 16px;">TIMBRY — ${companyNome}</p>
            <h2 style="font-size:20px;font-weight:600;color:#1a1a1a;margin:0 0 16px;">Nuova richiesta ferie</h2>
            <p style="font-size:15px;color:#6b6b6b;margin:0 0 20px;line-height:1.6;">
              <strong style="color:#1a1a1a;">${nomeDipendente}</strong> ha richiesto un periodo di ferie:
            </p>
            <div style="background:#f5f4f0;border-radius:6px;padding:16px 20px;margin-bottom:24px;">
              <p style="margin:0;font-size:15px;color:#1a1a1a;">
                Dal <strong>${dataInizio}</strong> al <strong>${dataFine}</strong>
              </p>
            </div>
            <p style="font-size:13px;color:#6b6b6b;">Accedi al pannello per approvare o rifiutare la richiesta.</p>
          </div>
        </div>
      `
    })
    return true
  } catch (err) {
    console.error('sendNotificaRichiestaFerie error:', err)
    return false
  }
}

// ─── Notifica al dipendente: ferie approvate o rifiutate ─────────────────────
export async function sendEsitoFerie({ emailDipendente, nome, dataInizio, dataFine, approvata }) {
  try {
    await resend.emails.send({
      from:    FROM,
      to:      emailDipendente,
      subject: `Richiesta ferie ${approvata ? 'approvata' : 'rifiutata'}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f5f4f0;">
          <div style="background:#fff;border-radius:8px;padding:32px;border:1px solid #dddbd7;">
            <p style="font-family:monospace;font-size:13px;color:#2563eb;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 16px;">TIMBRY</p>
            <h2 style="font-size:20px;font-weight:600;color:#1a1a1a;margin:0 0 16px;">
              Ciao ${nome}, la tua richiesta è stata <span style="color:${approvata ? '#16a34a' : '#dc2626'}">${approvata ? 'approvata' : 'rifiutata'}</span>
            </h2>
            <p style="font-size:15px;color:#6b6b6b;line-height:1.6;">
              Periodo richiesto: dal <strong>${dataInizio}</strong> al <strong>${dataFine}</strong>
            </p>
          </div>
        </div>
      `
    })
    return true
  } catch (err) {
    console.error('sendEsitoFerie error:', err)
    return false
  }
}
// ─── Reset password: invia link all'utente (owner o dipendente) ──────────────
export async function sendResetPassword({ email, username, resetUrl }) {
  try {
    const { data, error } = await resend.emails.send({
      from:    FROM,
      to:      email,
      subject: 'Reimposta la tua password — Timbry',
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f5f4f0;">
          <div style="background:#fff;border-radius:8px;padding:32px;border:1px solid #dddbd7;">
            <p style="font-family:monospace;font-size:13px;color:#2563eb;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 16px;">TIMBRY</p>
            <h2 style="font-size:22px;font-weight:600;color:#1a1a1a;margin:0 0 8px;">Reimposta la password</h2>
            <p style="font-size:15px;color:#6b6b6b;margin:0 0 24px;line-height:1.6;">
              Ciao <strong style="color:#1a1a1a;">${username}</strong>, hai richiesto di reimpostare la password.<br/>
              Clicca il pulsante qui sotto. Il link è valido per <strong>1 ora</strong>.
            </p>

            <a href="${resetUrl}"
               style="display:inline-block;background:#1a1a1a;color:#fff;text-decoration:none;
                      font-size:15px;font-weight:600;padding:14px 28px;border-radius:8px;margin-bottom:24px;">
              Reimposta password
            </a>

            <p style="font-size:13px;color:#6b6b6b;margin:0 0 8px;line-height:1.6;">
              Se non hai richiesto il reset, ignora questa email — la tua password rimane invariata.
            </p>
            <p style="font-size:12px;color:#aaa;margin:0;line-height:1.5;">
              Oppure copia questo link nel browser:<br/>
              <span style="word-break:break-all;">${resetUrl}</span>
            </p>
          </div>
        </div>
      `
    })

    if (error) {
      console.error('Resend error (reset):', error)
      return false
    }

    console.log('Email reset password inviata a', email, '- ID:', data?.id)
    return true

  } catch (err) {
    console.error('sendResetPassword error:', err)
    return false
  }
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function emailWrap(companyNome, title, accentColor, bodyHtml) {
  return `
    <div style="font-family:sans-serif;max-width:500px;margin:0 auto;padding:28px 20px;background:#f5f4f0;">
      <div style="background:#fff;border-radius:8px;padding:28px;border:1px solid #dddbd7;">
        <p style="font-family:monospace;font-size:12px;color:#2563eb;letter-spacing:0.15em;text-transform:uppercase;margin:0 0 14px;">TIMBRY — ${companyNome}</p>
        <h2 style="font-size:18px;font-weight:700;color:${accentColor};margin:0 0 16px;">${title}</h2>
        ${bodyHtml}
        <p style="font-size:11px;color:#aaa;margin:20px 0 0;">Timbry · notifica automatica</p>
      </div>
    </div>`
}

async function send(to, subject, html) {
  try {
    const { error } = await resend.emails.send({ from: FROM, to, subject, html })
    if (error) console.error('Resend error:', error)
    return !error
  } catch (e) { console.error('email send error:', e); return false }
}

// ─── Dipendente assente ───────────────────────────────────────────────────────

export async function sendNotificaAssente({ emailOwner, nomeDipendente, companyNome, turnoOra }) {
  const html = emailWrap(companyNome, '⚠️ Dipendente assente', '#dc2626', `
    <p style="font-size:14px;color:#444;margin:0 0 12px;line-height:1.6;">
      <strong>${nomeDipendente}</strong> non ha timbrato l'entrata${turnoOra ? ` (turno dalle <strong>${turnoOra}</strong>)` : ''}.
    </p>
    <p style="font-size:13px;color:#888;">Verifica dal pannello Timbry.</p>
  `)
  return send(emailOwner, `Assente: ${nomeDipendente} — ${companyNome}`, html)
}

// ─── Ritardo ─────────────────────────────────────────────────────────────────

export async function sendNotificaRitardo({ emailOwner, nomeDipendente, companyNome, orarioTurno, orarioArrivo }) {
  const html = emailWrap(companyNome, '🕐 Ritardo', '#d97706', `
    <p style="font-size:14px;color:#444;margin:0 0 12px;line-height:1.6;">
      <strong>${nomeDipendente}</strong> ha timbrato alle <strong>${orarioArrivo}</strong>${orarioTurno ? ` (turno dalle <strong>${orarioTurno}</strong>)` : ''}.
    </p>
  `)
  return send(emailOwner, `Ritardo: ${nomeDipendente} — ${companyNome}`, html)
}

// ─── Straordinario mensile ────────────────────────────────────────────────────

export async function sendNotificaStraordinario({ emailOwner, nomeDipendente, companyNome, oreStraord, soglia }) {
  const html = emailWrap(companyNome, '📈 Straordinario superato', '#7c3aed', `
    <p style="font-size:14px;color:#444;margin:0 0 12px;line-height:1.6;">
      <strong>${nomeDipendente}</strong> ha accumulato <strong>${oreStraord}h</strong> di straordinario questo mese
      (soglia impostata: ${soglia}h).
    </p>
  `)
  return send(emailOwner, `Straordinario: ${nomeDipendente} — ${companyNome}`, html)
}

// ─── Lettore NFC offline ──────────────────────────────────────────────────────

export async function sendNotificaLettoreOffline({ emailOwner, companyNome, nomeReader, minutiAssenza }) {
  const ore = minutiAssenza >= 60 ? `${Math.round(minutiAssenza / 60)}h` : `${minutiAssenza} min`
  const html = emailWrap(companyNome, '📡 Lettore NFC offline', '#dc2626', `
    <p style="font-size:14px;color:#444;margin:0 0 12px;line-height:1.6;">
      Il lettore <strong>${nomeReader}</strong> non invia dati da <strong>${ore}</strong>.
    </p>
    <p style="font-size:13px;color:#888;">Controlla che il lettore sia acceso e connesso alla rete.</p>
  `)
  return send(emailOwner, `Lettore offline: ${nomeReader} — ${companyNome}`, html)
}

// ─── Badge non riconosciuto ───────────────────────────────────────────────────

export async function sendNotificaBadgeNonRiconosciuto({ emailOwner, companyNome, uid, readerId }) {
  const html = emailWrap(companyNome, '🔴 Badge non riconosciuto', '#dc2626', `
    <p style="font-size:14px;color:#444;margin:0 0 12px;line-height:1.6;">
      È stato scansionato un badge non registrato nel sistema.
    </p>
    <div style="background:#f5f4f0;border-radius:6px;padding:12px 16px;margin-bottom:12px;">
      <p style="margin:0 0 6px;font-size:12px;color:#888;">UID badge</p>
      <p style="margin:0;font-family:monospace;font-size:15px;font-weight:600;color:#1a1a1a;">${uid}</p>
      ${readerId ? `<p style="margin:6px 0 0;font-size:12px;color:#888;">Lettore: ${readerId}</p>` : ''}
    </div>
    <p style="font-size:13px;color:#888;">Se è un nuovo dipendente, aggiungilo dal pannello Timbry.</p>
  `)
  return send(emailOwner, `Badge non riconosciuto — ${companyNome}`, html)
}

// ─── Timbratura mancante ──────────────────────────────────────────────────────

export async function sendNotificaTimbraturaMancante({ emailOwner, nomeDipendente, companyNome, orarioEntrata }) {
  const html = emailWrap(companyNome, '🚪 Timbratura uscita mancante', '#d97706', `
    <p style="font-size:14px;color:#444;margin:0 0 12px;line-height:1.6;">
      <strong>${nomeDipendente}</strong> ha timbrato l'entrata alle <strong>${orarioEntrata}</strong>
      ma non ha ancora timbrato l'uscita.
    </p>
    <p style="font-size:13px;color:#888;">Potrebbe aver dimenticato di timbrare l'uscita.</p>
  `)
  return send(emailOwner, `Uscita mancante: ${nomeDipendente} — ${companyNome}`, html)
}

// ─── Riepilogo giornaliero ────────────────────────────────────────────────────

export async function sendRiepilogoGiornaliero({ emailOwner, companyNome, data, presenti, assenti }) {
  const dataFmt = new Date(data + 'T12:00:00').toLocaleDateString('it-IT', { weekday: 'long', day: '2-digit', month: 'long' })

  const listHtml = (arr, color) =>
    arr.length ? arr.map(n => `<li style="margin:3px 0;color:${color};">${n}</li>`).join('') :
    `<li style="color:#aaa;">Nessuno</li>`

  const html = emailWrap(companyNome, `📊 Riepilogo ${dataFmt}`, '#2563eb', `
    <div style="display:flex;gap:16px;margin-bottom:16px;">
      <div style="flex:1;background:#f0fdf4;border-radius:6px;padding:12px 16px;">
        <p style="margin:0 0 4px;font-size:11px;color:#15803d;font-weight:600;text-transform:uppercase;">Presenti (${presenti.length})</p>
        <ul style="margin:0;padding:0 0 0 16px;font-size:13px;">${listHtml(presenti, '#15803d')}</ul>
      </div>
      <div style="flex:1;background:#fef2f2;border-radius:6px;padding:12px 16px;">
        <p style="margin:0 0 4px;font-size:11px;color:#dc2626;font-weight:600;text-transform:uppercase;">Assenti (${assenti.length})</p>
        <ul style="margin:0;padding:0 0 0 16px;font-size:13px;">${listHtml(assenti, '#dc2626')}</ul>
      </div>
    </div>
  `)
  return send(emailOwner, `Riepilogo ${dataFmt} — ${companyNome}`, html)
}

// ─── Riepilogo settimanale ────────────────────────────────────────────────────

export async function sendRiepilogoSettimanale({ emailOwner, companyNome, weekStart, weekEnd, empHours }) {
  const fmt = d => new Date(d + 'T12:00:00').toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
  const rows = Object.entries(empHours)
    .sort((a, b) => b[1] - a[1])
    .map(([nome, ore]) => `
      <tr>
        <td style="padding:7px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;">${nome}</td>
        <td style="padding:7px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;text-align:right;font-weight:600;">${ore}h</td>
      </tr>`).join('')

  const html = emailWrap(companyNome, `📅 Riepilogo settimana ${fmt(weekStart)} – ${fmt(weekEnd)}`, '#2563eb', `
    <table style="width:100%;border-collapse:collapse;margin-bottom:12px;">
      <thead>
        <tr style="background:#1e293b;">
          <th style="padding:8px 12px;text-align:left;font-size:11px;color:#fff;font-weight:600;">Dipendente</th>
          <th style="padding:8px 12px;text-align:right;font-size:11px;color:#fff;font-weight:600;">Ore lavorate</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `)
  return send(emailOwner, `Riepilogo settimanale — ${companyNome}`, html)
}
