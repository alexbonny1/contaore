import { createRequire } from 'module'
import { createWriteStream } from 'fs'
const require = createRequire(import.meta.url)
const PDF = require('/home/user/contaore/contaore/backend/node_modules/pdfkit')

const OUT = '/home/user/contaore/Timbry_Guida.pdf'
const doc = new PDF({ size: 'A4', margin: 0, bufferPages: true })
doc.pipe(createWriteStream(OUT))

const PW = 595.28, PH = 841.89
const L = 48, TW = PW - L - 48

const BLU   = '#0099FF'
const DARK  = '#111827'
const GRAY  = '#6B7280'
const LGRAY = '#F3F4F6'
const WHITE = '#FFFFFF'
const GREEN = '#16a34a'
const RED   = '#DC2626'
const AMBER = '#D97706'

// ── helpers ────────────────────────────────────────────────

function checkPage(h) {
  if (doc.y + (h || 40) > PH - 44) {
    doc.addPage({ size: 'A4', margin: 0 })
    doc.y = 48
  }
}

// intestazione pagina nuova
function page(title, sub) {
  doc.addPage({ size: 'A4', margin: 0 })
  doc.rect(0, 0, PW, 50).fillColor(DARK).fill()
  doc.rect(0, 0, PW, 4).fillColor(BLU).fill()
  doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(16).text(title, L, 14, { width: TW })
  if (sub) doc.fillColor('#9CA3AF').font('Helvetica').fontSize(9).text(sub, L, 34, { width: TW })
  doc.y = 62
}

// titoletto sezione
function sec(text) {
  checkPage(36)
  doc.moveDown(0.4)
  const sy = doc.y
  doc.rect(L, sy, TW, 22).fillColor(LGRAY).fill()
  doc.rect(L, sy, 3, 22).fillColor(BLU).fill()
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(10).text(text, L + 10, sy + 6, { width: TW - 14 })
  doc.y = sy + 27
}

// testo paragrafo
function txt(t) {
  checkPage(28)
  doc.fillColor(GRAY).font('Helvetica').fontSize(9.5)
     .text(t, L, doc.y, { width: TW, lineGap: 2.5 })
  doc.moveDown(0.3)
}

// voce puntata semplice
function li(t, color) {
  checkPage(20)
  const cy = doc.y
  doc.circle(L + 4, cy + 5, 2.5).fillColor(color || BLU).fill()
  doc.fillColor(DARK).font('Helvetica').fontSize(9.5)
     .text(t, L + 12, cy, { width: TW - 12, lineGap: 2.5 })
  doc.moveDown(0.1)
}

// riga chiave → valore (righe alternate)
let _r = 0
function kvReset() { _r = 0 }
function kv(k, v) {
  checkPage(20)
  const ky = doc.y
  doc.rect(L, ky, TW, 19).fillColor(_r++ % 2 ? WHITE : LGRAY).fill()
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9).text(k, L + 8, ky + 5, { width: 148 })
  doc.fillColor(GRAY).font('Helvetica').fontSize(9).text(v, L + 160, ky + 5, { width: TW - 164 })
  doc.y = ky + 21
}

// box colorato con testo — calcola h prima di disegnare
function box(text, bg, border) {
  checkPage(44)
  bg = bg || '#EFF6FF'; border = border || BLU
  const h = doc.heightOfString(text, { width: TW - 22, fontSize: 9, lineGap: 2.5 }) + 18
  const by = doc.y
  doc.rect(L, by, TW, h).fillColor(bg).fill()
  doc.rect(L, by, 3, h).fillColor(border).fill()
  doc.fillColor(GRAY).font('Helvetica').fontSize(9)
     .text(text, L + 12, by + 9, { width: TW - 22, lineGap: 2.5 })
  doc.y = by + h + 8
}

// step numerato
function step(n, bold, desc) {
  checkPage(28)
  const sy = doc.y
  doc.rect(L, sy, 18, 18).fillColor(BLU).fill()
  doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(8.5).text(String(n), L, sy + 4, { width: 18, align: 'center' })
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9.5).text(bold, L + 24, sy + 2, { width: TW - 24 })
  if (desc) {
    doc.fillColor(GRAY).font('Helvetica').fontSize(9)
       .text(desc, L + 24, doc.y + 1, { width: TW - 24, lineGap: 2.5 })
  }
  doc.moveDown(0.35)
}

// ══════════════════════════════════════════════════════════
// COPERTINA
// ══════════════════════════════════════════════════════════
doc.rect(0, 0, PW, PH).fillColor('#0F172A').fill()
doc.rect(0, 0, PW, 5).fillColor(BLU).fill()
doc.rect(0, PH - 5, PW, 5).fillColor(BLU).fill()
doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(54)
   .text('TIMBRY', 0, 255, { align: 'center', width: PW })
doc.fillColor(BLU).font('Helvetica').fontSize(15)
   .text('Guida rapida all\'utilizzo', 0, 323, { align: 'center', width: PW })
doc.save()
doc.moveTo(130, 353).lineTo(PW - 130, 353).lineWidth(0.7).strokeColor(BLU).stroke()
doc.restore()
doc.fillColor('#94A3B8').font('Helvetica').fontSize(11)
   .text('Per il titolare  ·  Per il dipendente', 0, 364, { align: 'center', width: PW })
doc.fillColor('#475569').font('Helvetica').fontSize(8.5)
   .text('Timbry · Sistema presenze NFC  ·  ' +
         new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }),
         0, PH - 30, { align: 'center', width: PW })

// ══════════════════════════════════════════════════════════
// INDICE
// ══════════════════════════════════════════════════════════
doc.addPage({ size: 'A4', margin: 0 })
doc.rect(0, 0, PW, 50).fillColor(DARK).fill()
doc.rect(0, 0, PW, 4).fillColor(BLU).fill()
doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(18).text('Indice', L, 16)
doc.fillColor('#9CA3AF').font('Helvetica').fontSize(9).text('Timbry · Guida rapida', L, 36)
doc.y = 62

const TOC = [
  ['1', 'Login',                      'Come accedere e differenza tra titolare e dipendente'],
  ['2', 'Dashboard — titolare',        'Presenti ora, assenti, fuori turno'],
  ['3', 'Dipendenti',                 'Lista, scheda individuale, storico presenze'],
  ['4', 'Badge NFC',                  'Registrare un badge e creare account dipendente'],
  ['5', 'Lettori NFC',                'Monitoraggio dispositivi fisici'],
  ['6', 'Fasce orarie',               'Regole automatiche entrata / uscita'],
  ['7', 'Richieste',                  'Gestire ferie, giustificazioni, timbrature mancate'],
  ['8', 'Pausa aziendale',            'Chiusura collettiva per un periodo'],
  ['9', 'Portale dipendente',         'Storico personale, ferie, richieste dal portale'],
]
TOC.forEach(([n, t, d], i) => {
  const ry = doc.y
  doc.rect(L, ry, TW, 33).fillColor(i % 2 === 0 ? LGRAY : WHITE).fill()
  doc.rect(L, ry, 3, 33).fillColor(BLU).fill()
  doc.rect(L + 8, ry + 7, 18, 18).fillColor(BLU).fill()
  doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(9).text(n, L + 8, ry + 11, { width: 18, align: 'center' })
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(10).text(t, L + 34, ry + 5, { width: TW - 38 })
  doc.fillColor(GRAY).font('Helvetica').fontSize(8.5).text(d, L + 34, ry + 19, { width: TW - 38 })
  doc.y = ry + 35
})

// ══════════════════════════════════════════════════════════
// 1 — LOGIN
// ══════════════════════════════════════════════════════════
page('1 · Login', 'Come accedere a Timbry')

txt('Vai all\'indirizzo del sito Timbry nel browser. Inserisci username e password e clicca Accedi.')

sec('Il sistema riconosce il tuo ruolo')
txt('Dopo il login vieni indirizzato automaticamente all\'area giusta:')
li('Titolare (owner): vai alla Dashboard con la vista completa dell\'azienda.')
li('Dipendente: vai al portale personale con le tue presenze e richieste.')

box('Le credenziali vengono inviate via email dal titolare al momento della creazione dell\'account. In caso di problemi contatta chi gestisce il sistema.')

// ══════════════════════════════════════════════════════════
// 2 — DASHBOARD TITOLARE
// ══════════════════════════════════════════════════════════
page('2 · Dashboard — titolare', 'La situazione dell\'azienda in tempo reale')

txt('È la prima schermata dopo il login. Si aggiorna automaticamente ogni 5 secondi.')

sec('I quattro numeri in cima alla pagina')
kvReset()
kv('Dipendenti',   'Quanti dipendenti sono registrati in totale nel sistema.')
kv('Presenti ora', 'Chi ha timbrato l\'entrata e non ancora l\'uscita — è in azienda adesso. Numero in verde.')
kv('Assenti',      'Chi non ha ancora timbrato oggi. Numero in rosso.')
kv('Fuori turno',  'Dipendenti non considerati presenti né assenti (es. turno non ancora iniziato). Numero in grigio.')

sec('Le tre colonne sotto i numeri')
txt('Ogni colonna ha il nome e l\'icona del gruppo (spunta verde / X rossa / orologio grigio) e mostra le card dei dipendenti. Ogni card riporta:')
li('Nome e cognome del dipendente.')
li('UID del badge NFC associato.')
li('Etichetta di stato: ENTRATO, ASSENTE o FUORI ORARIO.')

sec('Header e menu')
txt('In alto a destra ci sono i pulsanti: Luna/Sole per cambiare tema, Password per cambiare la tua password, Logout per uscire.')
txt('Il menu sotto l\'header ha le voci: Dashboard · Richieste · Pausa aziendale · Dipendenti · Badge · Lettori NFC.')
box('La voce "Richieste" appare solo se il portale dipendenti è attivo. Se è attivo e ci sono richieste in attesa, compare un numero rosso sul pulsante.')

// ══════════════════════════════════════════════════════════
// 3 — DIPENDENTI
// ══════════════════════════════════════════════════════════
page('3 · Dipendenti', 'Lista e scheda individuale')

sec('Pagina lista dipendenti')
txt('In alto a destra c\'è il pulsante Esporta per scaricare le presenze in PDF o Excel. La pagina mostra le card di tutti i dipendenti aggiornate ogni 5 secondi. Ogni card mostra:')
kvReset()
kv('Nome e cognome',   'Con il pallino verde (presente ora) o grigio (non presente).')
kv('Badge UID',        'Il codice del badge NFC associato. "Nessun badge" se non ancora assegnato.')
kv('Letture oggi',     'Quante volte ha passato il badge oggi.')
kv('Letture mese',     'Totale letture del mese corrente.')
kv('Ore totali',       'Ore lavorate nel mese corrente (aggiornate in tempo reale).')
kv('Ultima presenza',  'Data e ora dell\'ultima timbratura registrata.')

txt('Clicca su una card per aprire la scheda del dipendente.')

sec('Scheda dipendente — storico presenze')
txt('Mostra il dettaglio mensile. Usa le frecce ‹ › per navigare tra i mesi. Ogni riga della tabella è un giorno e contiene:')
li('Gli orari di entrata e uscita rilevati dal lettore NFC.')
li('Le ore lavorate quel giorno, calcolate automaticamente.')
li('Lo stato: Presente · Assente · In ferie · Giustificata · Straordinario.')

sec('Aggiungere una timbratura manuale')
txt('Disponibile solo quando il portale dipendenti è disattivato.')
step(1, 'Clicca il pulsante + vicino al giorno', 'Oppure il pulsante "+ Timbratura" in cima alla sezione storico.')
step(2, 'Scegli data, ora e tipo', 'ENTRATA o USCITA.')
step(3, 'Salva', 'La timbratura compare in ambra con l\'icona matita — distinguibile da quelle del lettore.')
box('Puoi eliminare solo le timbrature aggiunte manualmente (icona X rossa). Le timbrature registrate dal lettore NFC non si eliminano dalla UI.', '#FFF7ED', AMBER)

sec('Esportare le presenze')
txt('Dalla pagina Dipendenti clicca Esporta in alto a destra. Si apre una finestra dove puoi:')
li('Scegliere il periodo: tutto lo storico oppure un singolo mese.')
li('Selezionare quali dipendenti includere (tutti o solo alcuni, con checkbox).')
li('Cliccare PDF (rosso) o Excel (verde) per scaricare il file.')
box('Le timbrature manuali nel PDF e nell\'Excel hanno il suffisso (M) accanto all\'orario.')

// ══════════════════════════════════════════════════════════
// 4 — BADGE NFC
// ══════════════════════════════════════════════════════════
page('4 · Badge NFC', 'Registrare badge e creare account dipendente')

txt('Prima che un dipendente possa timbrare, il suo badge fisico va associato al suo profilo. L\'operazione si fa una volta sola.')

sec('Registrare un nuovo badge')
step(1, 'Clicca "Leggi Tag NFC"', 'Il pulsante è in alto nel form. Il sito attende che il badge venga avvicinato al lettore fisico.')
step(2, 'Avvicina il badge al lettore', 'Il lettore legge il badge e lo invia al server. Il sito mostra automaticamente il codice UID rilevato.')
step(3, 'Compila Nome e Cognome', 'Digita i dati del dipendente nel form che appare sotto l\'UID.')
step(4, 'Clicca "Registra Badge"', 'Il badge è associato. Il dipendente può timbrare da subito.')

sec('Se il portale dipendenti è attivo')
box('Quando il portale è attivo, nella pagina appare un banner blu: "Portale dipendenti attivo — inserisci l\'email del dipendente per creare automaticamente il suo account e inviargli le credenziali di accesso." In quel caso compare anche il campo email obbligatorio nel form. Dopo la registrazione, il dipendente riceve username e password via email e può accedere al portale.', '#EFF6FF', BLU)

sec('Badge già registrati')
txt('Sotto il form c\'è la griglia con tutti i badge già associati. Ogni card mostra: icona tessera, codice UID e nome del dipendente. Clicca Elimina per rimuovere il badge e il dipendente associato (operazione irreversibile).')

// ══════════════════════════════════════════════════════════
// 5 — LETTORI NFC
// ══════════════════════════════════════════════════════════
page('5 · Lettori NFC', 'Monitoraggio dei dispositivi fisici')

txt('La pagina mostra tutti i lettori NFC fisici collegati all\'azienda. La vista si aggiorna ogni 5 secondi. Non richiede nessuna azione — è solo un pannello di controllo.')

sec('Cosa mostra ogni lettore')
kvReset()
kv('Reader ID',   'Il nome identificativo del lettore, impostato durante la configurazione del dispositivo.')
kv('Stato',       'ONLINE (verde) se il lettore ha inviato un segnale negli ultimi 2 minuti. OFFLINE (rosso) altrimenti.')
kv('Ultimo ping', 'Data e ora dell\'ultimo segnale ricevuto dal lettore.')
kv('Firmware',    'Versione del software installato sul dispositivo.')

sec('Lettore offline')
li('Verifica che il dispositivo sia acceso e alimentato.')
li('Controlla che lo schermo del lettore mostri ONLINE.')
li('Se necessario, stacca e riattacca l\'alimentazione — il lettore si riconnette da solo.')

// ══════════════════════════════════════════════════════════
// 6 — FASCE ORARIE
// ══════════════════════════════════════════════════════════
page('6 · Fasce orarie', 'Regole automatiche entrata / uscita')

txt('Le fasce orarie dicono al sistema quando una timbratura vale come ENTRATA e quando come USCITA. Senza fasce il sistema alterna automaticamente entrata e uscita.')

sec('Esempio')
txt('Vuoi che chi timbra la mattina entri e chi timbra il pomeriggio esca:')
li('Fascia Mattina: 07:30 – 09:30 → tipo ENTRATA')
li('Fascia Sera: 17:00 – 19:30 → tipo USCITA')

sec('Aggiungere una fascia')
step(1, 'Vai su Fasce orarie', 'Dal menu o dalla scheda azienda nel pannello superadmin.')
step(2, 'Compila il form', 'Nome (opzionale), ora inizio, ora fine, tipo ENTRATA o USCITA.')
step(3, 'Salva', 'La fascia è attiva immediatamente per tutte le timbrature successive.')
box('Se un dipendente timbra due volte nella stessa fascia (es. badge passato per errore due volte di mattina), il sistema inverte automaticamente il tipo per la seconda lettura.')

// ══════════════════════════════════════════════════════════
// 7 — RICHIESTE
// ══════════════════════════════════════════════════════════
page('7 · Richieste', 'Ferie, giustificazioni, timbrature mancate')

txt('Questa sezione è visibile solo quando il portale dipendenti è attivo. I dipendenti inviano richieste dal loro portale e tu le gestisci qui.')

sec('Tipi di richiesta')
kvReset()
kv('Ferie',              'Il dipendente chiede un periodo di assenza con date di inizio e fine.')
kv('Giustificazione',    'Il dipendente spiega un\'assenza già avvenuta con un motivo.')
kv('Timbratura mancata', 'Il dipendente chiede di aggiungere una timbratura dimenticata (data, ora, tipo).')

sec('I quattro contatori in cima alla pagina')
txt('Mostrano quante richieste sono in attesa in totale, quante sono ferie, quante giustificazioni e quante timbrature mancate.')

sec('Come gestire una richiesta')
step(1, 'Clicca sulla richiesta', 'Si espande e mostra tutti i dettagli: dipendente, tipo, periodo, note.')
step(2, 'Approva o Rifiuta', 'Usa il pulsante verde Approva o il pulsante rosso Rifiuta.')
step(3, 'Elimina', 'Puoi eliminare qualsiasi richiesta con il pulsante del cestino.')

sec('Cosa succede dopo l\'approvazione')
li('Ferie approvate: il dipendente appare come "In ferie" nella dashboard. Riceve una email di conferma.', GREEN)
li('Timbratura mancata approvata: la timbratura viene creata nel sistema con la data e l\'ora indicate.', GREEN)
li('Rifiuto: il dipendente vede lo stato "Rifiutata" nel suo portale e riceve una email.', RED)

sec('Filtri per tab')
txt('In cima alla lista ci sono quattro tab: Tutte · Ferie · Giustificazioni · Timbrature. Clicca per filtrare le richieste per tipo.')

// ══════════════════════════════════════════════════════════
// 8 — PAUSA AZIENDALE
// ══════════════════════════════════════════════════════════
page('8 · Pausa aziendale', 'Chiusura collettiva per un intero periodo')

txt('Segna tutti i dipendenti come in ferie per un intervallo di date senza dover creare una richiesta per ognuno. Utile per ferie estive, chiusure natalizie e simili.')

sec('Creare una pausa')
step(1, 'Vai su Pausa aziendale', 'Dal menu principale.')
step(2, 'Clicca "Crea pausa aziendale"', 'Si apre il form con tre campi: Data inizio, Data fine, Motivo.')
step(3, 'Conferma', 'La pausa viene salvata. Il sistema verifica che non si sovrapponga a pause già esistenti.')

sec('Pausa attiva')
txt('Se c\'è una pausa attiva, in cima alla pagina compare un riquadro verde con le date e il motivo. Tutti i dipendenti risultano in ferie per quel periodo nella dashboard.')

sec('Annullare una pausa')
txt('Clicca il pulsante rosso "Annulla pausa" nel riquadro verde. La pausa viene disattivata immediatamente.')

// ══════════════════════════════════════════════════════════
// 9 — PORTALE DIPENDENTE
// ══════════════════════════════════════════════════════════
page('9 · Portale dipendente', 'Cosa vede e può fare il dipendente')

txt('Il dipendente accede con le credenziali ricevute via email. Il sistema mostra solo i propri dati personali.')

sec('Header del portale')
txt('In alto a destra: icona lucchetto per cambiare password, pulsante Logout. Nessun menu di navigazione tra sezioni aziendali — il portale è solo personale.')

sec('Le statistiche in cima')
kvReset()
kv('Ore questo mese',    'Totale ore lavorate nel mese corrente.')
kv('Giorni assenti',     'Giorni con turno programmato ma nessuna timbratura (se i turni sono attivi).')
kv('Ore straordinario',  'Ore oltre il turno previsto (se i turni sono attivi).')
kv('Giorni ferie',       'Ferie approvate nel mese corrente.')

sec('Tab Storico presenze')
txt('Mesi espandibili con le timbrature giornaliere. Usa le frecce per navigare. Ogni giorno mostra lo stato (Presente, Assente, Ferie, Straordinario, Giustificata) con entrata e uscita. I giorni assenti hanno un pulsante "Giustifica assenza" per inviare un motivo.')
box('Il dipendente può solo leggere le proprie presenze. Non può modificarle. Per correzioni deve inviare una richiesta timbratura mancata.')

sec('Tab Ferie — richiedere ferie')
step(1, 'Clicca "Nuova richiesta"', 'Si apre il form con Data inizio, Data fine e Note facoltative.')
step(2, 'Invia', 'La richiesta arriva al titolare con stato "In attesa".')
step(3, 'Attendi risposta', 'Lo stato cambia in Approvata o Rifiutata. Le richieste ancora in attesa possono essere cancellate.')

sec('Tab Richieste — timbratura mancata')
txt('Il dipendente può segnalare una timbratura che ha dimenticato di fare:')
step(1, 'Clicca "Nuova richiesta"', 'Nel form scegli tipo (ENTRATA o USCITA), data, ora e motivo.')
step(2, 'Invia', 'Il titolare la vede nella sua sezione Richieste e può approvarla o rifiutarla.')

sec('Tab Turni')
txt('Mostra i turni di lavoro assegnati per ogni giorno della settimana: orari di ingresso e uscita mattina e pomeriggio (se previsti).')

// ── NUMERI DI PAGINA ────────────────────────────────────
const rng = doc.bufferedPageRange()
for (let i = 1; i < rng.count; i++) {
  doc.switchToPage(rng.start + i)
  const fy = PH - 28
  doc.save()
  doc.moveTo(L, fy - 3).lineTo(PW - 48, fy - 3)
     .lineWidth(0.4).strokeColor('#E5E7EB').stroke()
  doc.restore()
  doc.fillColor('#9CA3AF').font('Helvetica').fontSize(7.5)
     .text('Timbry · Guida rapida all\'utilizzo', L, fy, { width: TW / 2 })
  doc.fillColor(BLU).font('Helvetica-Bold').fontSize(7.5)
     .text(i + ' / ' + (rng.count - 1), L, fy, { width: TW, align: 'right' })
}

doc.end()
doc.on('end', () => console.log('OK → ' + OUT))
