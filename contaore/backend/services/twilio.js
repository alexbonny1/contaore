import twilio from 'twilio';

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER; // +39...
const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER; // whatsapp:+39...

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
  try {
    const message = `Il tuo codice di verifica è: ${code}\nValido per 10 minuti.`;

    const result = await twilioClient.messages.create({
      body: message,
      from: TWILIO_PHONE_NUMBER,
      to: phoneNumber // Deve essere in formato +39...
    });

    return {
      success: true,
      sid: result.sid,
      method: 'sms'
    };
  } catch (error) {
    console.error('[2FA SMS] Errore:', error.message);
    throw error;
  }
}

/**
 * Invia codice 2FA via WhatsApp
 */
export async function sendTwoFactorWhatsApp(phoneNumber, code) {
  try {
    const message = `Il tuo codice di verifica è: ${code}\nValido per 10 minuti.`;

    // Formato: whatsapp:+39...
    const whatsappTo = phoneNumber.startsWith('whatsapp:')
      ? phoneNumber
      : `whatsapp:${phoneNumber}`;

    const result = await twilioClient.messages.create({
      body: message,
      from: TWILIO_WHATSAPP_NUMBER,
      to: whatsappTo
    });

    return {
      success: true,
      sid: result.sid,
      method: 'whatsapp'
    };
  } catch (error) {
    console.error('[2FA WhatsApp] Errore:', error.message);
    throw error;
  }
}

/**
 * Invia codice 2FA via SMS con fallback a WhatsApp se fallisce
 */
export async function sendTwoFactorViaSMS(phoneNumber, code) {
  try {
    // Prova SMS
    const smsResult = await sendTwoFactorSMS(phoneNumber, code);
    return smsResult;
  } catch (smsError) {
    console.warn('[2FA] SMS fallito, provo WhatsApp...');
    try {
      const whatsappResult = await sendTwoFactorWhatsApp(phoneNumber, code);
      return whatsappResult;
    } catch (whatsappError) {
      console.error('[2FA] SMS e WhatsApp entrambi falliti');
      throw new Error('Impossibile inviare codice via SMS o WhatsApp');
    }
  }
}

/**
 * Invia codice 2FA via WhatsApp con fallback a SMS se fallisce
 */
export async function sendTwoFactorViaWhatsApp(phoneNumber, code) {
  try {
    // Prova WhatsApp
    const whatsappResult = await sendTwoFactorWhatsApp(phoneNumber, code);
    return whatsappResult;
  } catch (whatsappError) {
    console.warn('[2FA] WhatsApp fallito, provo SMS...');
    try {
      const smsResult = await sendTwoFactorSMS(phoneNumber, code);
      return smsResult;
    } catch (smsError) {
      console.error('[2FA] WhatsApp e SMS entrambi falliti');
      throw new Error('Impossibile inviare codice via WhatsApp o SMS');
    }
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
