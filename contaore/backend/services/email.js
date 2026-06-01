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

// Initialize Resend with API key if available
// Email service is optional - if no API key, functions will return false
let resend = null
if (process.env.RESEND_API_KEY) {
  try {
    resend = new Resend(process.env.RESEND_API_KEY)
  } catch (err) {
    console.warn('Resend initialization failed (email service disabled):', err.message)
  }
}

const FROM = process.env.EMAIL_FROM || 'Timbry <onboarding@resend.dev>'

// ─── Invia credenziali al TITOLARE quando il superadmin crea l'azienda ───────
export async function sendCredenzialiOwner({ email, username, password, companyNome }) {
  if (!resend) {
    console.warn('Email service disabled: RESEND_API_KEY not configured')
    return false
  }
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
  if (!resend) {
    console.warn('Email service disabled: RESEND_API_KEY not configured')
    return false
  }
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
  if (!resend) {
    console.warn('Email service disabled: RESEND_API_KEY not configured')
    return false
  }
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
  if (!resend) {
    console.warn('Email service disabled: RESEND_API_KEY not configured')
    return false
  }
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
  if (!resend) {
    console.warn('Email service disabled: RESEND_API_KEY not configured')
    return false
  }
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
