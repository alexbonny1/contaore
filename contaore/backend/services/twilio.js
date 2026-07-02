import twilio from 'twilio';
import { makeBreaker, withRetry } from './circuitBreaker.js';

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const TWILIO_PHONE_NUMBER    = process.env.TWILIO_PHONE_NUMBER;    // +39...
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER; // whatsapp:+39...

const smsBreaker      = makeBreaker(args => twilioClient.messages.create(args), 'twilio-sms')
const whatsappBreaker = makeBreaker(args => twilioClient.messages.create(args), 'twilio-whatsapp')

/**
 * Genera codice 2FA casuale di 6 cifre
 */
export function generateTwoFactorCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Invia codice 2FA via SMS
 */
export async function sendTwoFactorSMS(phoneNumber, code) {
  const message = `Il tuo codice di verifica è: ${code}\nValido per 10 minuti.`;
  try {
    const result = await withRetry(() => smsBreaker.fire({
      body: message,
      from: TWILIO_PHONE_NUMBER,
      to:   phoneNumber
    }));
    return { success: true, sid: result.sid, method: 'sms' };
  } catch (error) {
    console.error('[2FA SMS] Errore:', error.message);
    throw error;
  }
}

/**
 * Invia codice 2FA via WhatsApp
 */
export async function sendTwoFactorWhatsApp(phoneNumber, code) {
  const message = `Il tuo codice di verifica è: ${code}\nValido per 10 minuti.`;
  const whatsappTo = phoneNumber.startsWith('whatsapp:') ? phoneNumber : `whatsapp:${phoneNumber}`;
  try {
    const result = await withRetry(() => whatsappBreaker.fire({
      body: message,
      from: TWILIO_WHATSAPP_NUMBER,
      to:   whatsappTo
    }));
    return { success: true, sid: result.sid, method: 'whatsapp' };
  } catch (error) {
    console.error('[2FA WhatsApp] Errore:', error.message);
    throw error;
  }
}

/**
 * Invia codice 2FA con fallback a email
 * @param {string} phoneNumber - Numero telefonico dell'utente
 * @param {string} email - Email dell'utente (per fallback)
 * @param {string} code - Codice 6 cifre
 * @param {string} method - Metodo preferito: 'sms', 'whatsapp', 'email'
 * @param {function} sendEmailFn - Funzione per inviare email (da email.js)
 */
export async function sendTwoFactorCode(phoneNumber, email, code, method, sendEmailFn) {
  try {
    if (method === 'sms') {
      try {
        return await sendTwoFactorSMS(phoneNumber, code);
      } catch {
        console.warn('[2FA] SMS fallito, invio email...');
        await sendEmailFn(email, code);
        return { success: true, method: 'email_fallback', reason: 'sms_failed' };
      }
    } else if (method === 'whatsapp') {
      try {
        return await sendTwoFactorWhatsApp(phoneNumber, code);
      } catch {
        console.warn('[2FA] WhatsApp fallito, invio email...');
        await sendEmailFn(email, code);
        return { success: true, method: 'email_fallback', reason: 'whatsapp_failed' };
      }
    } else {
      // Default: email
      await sendEmailFn(email, code);
      return { success: true, method: 'email' };
    }
  } catch (error) {
    console.error('[2FA] Errore critico:', error.message);
    throw error;
  }
}
