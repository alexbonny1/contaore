import { createRequire } from 'module'
import { createWriteStream } from 'fs'
const require = createRequire(import.meta.url)
const PDF = require('/home/user/contaore/contaore/backend/node_modules/pdfkit')

const OUT = '/home/user/contaore/Timbry_Guida.pdf'
const doc = new PDF({ size: 'A4', margin: 0, bufferPages: true })
doc.pipe(createWriteStream(OUT))

// ── costanti layout ────────────────────────────────
const PW   = 595.28
const PH   = 841.89
const L    = 50          // margine sinistro
const R    = 50          // margine destro
const TW   = PW - L - R // larghezza testo

// ── colori ────────────────────────────────────────
const C = {
  blue:   '#0099FF',
  dark:   '#111827',
  gray:   '#6B7280',
  lgray:  '#F3F4F6',
  white:  '#FFFFFF',
  green:  '#059669',
  red:    '#DC2626',
  amber:  '#D97706',
  stripe: '#F9FAFB',
}

// ── helpers ───────────────────────────────────────

function y() { return doc.y }
function setY(v) { doc.y = v }

function checkPage(needed = 60) {
  if (doc.y + needed > PH - 50) {
    doc.addPage({ size: 'A4', margin: 0 })
    doc.y = 50
  }
}

function rule(color = '#E5E7EB') {
  doc.save()
  doc.moveTo(L, doc.y).lineTo(PW - R, doc.y)
     .lineWidth(0.5).strokeColor(color).stroke()
  doc.restore()
  doc.y += 1
}

// Titolo di capitolo — rettangolo pieno
function chapterTitle(text) {
  doc.addPage({ size: 'A4', margin: 0 })
  doc.rect(0, 0, PW, 52).fillColor(C.blue).fill()
  doc.fillColor(C.white).font('Helvetica-Bold').fontSize(17)
     .text(text, L, 16, { width: TW })
  doc.y = 68
}

// Titolo di sezione — banda grigio chiaro
function secTitle(text) {
  checkPage(40)
  doc.moveDown(0.3)
  const sy = doc.y
  doc.rect(L, sy, TW, 22).fillColor(C.lgray).fill()
  doc.rect(L, sy, 3, 22).fillColor(C.blue).fill()
  doc.fillColor(C.dark).font('Helvetica-Bold').fontSize(10.5)
     .text(text, L + 10, sy + 6, { width: TW - 14 })
  doc.y = sy + 28
}

// Testo normale
function body(text) {
  checkPage(30)
  doc.fillColor(C.gray).font('Helvetica').fontSize(10)
     .text(text, L, doc.y, { width: TW, lineGap: 2, align: 'justify' })
  doc.moveDown(0.3)
}

// Voce con pallino colorato
function item(dot, text, dotColor) {
  checkPage(22)
  const iy = doc.y
  const dc = dotColor || C.blue
  doc.circle(L + 5, iy + 5, 3).fillColor(dc).fill()
  doc.fillColor(C.dark).font('Helvetica').fontSize(10)
     .text(text, L + 14, iy, { width: TW - 14, lineGap: 2 })
  doc.moveDown(0.15)
}

// Step numerato
function step(n, title, desc) {
  checkPage(30)
  const sy = doc.y
  // numero
  doc.rect(L, sy, 20, 20).fillColor(C.blue).fill()
  doc.fillColor(C.white).font('Helvetica-Bold').fontSize(9)
     .text(String(n), L, sy + 5, { width: 20, align: 'center' })
  // titolo
  doc.fillColor(C.dark).font('Helvetica-Bold').fontSize(10)
     .text(title, L + 26, sy + 3, { width: TW - 26 })
  if (desc) {
    doc.fillColor(C.gray).font('Helvetica').fontSize(9.5)
       .text(desc, L + 26, doc.y + 1, { width: TW - 26, lineGap: 2 })
  }
  doc.moveDown(0.4)
}

// Riquadro nota — calcola altezza PRIMA di disegnare
function note(text, borderColor) {
  checkPage(50)
  const bc = borderColor || C.blue
  const textH = doc.heightOfString(text, { width: TW - 22, lineGap: 2, fontSize: 9.5 })
  const bh = textH + 18
  const by = doc.y
  doc.rect(L, by, TW, bh).fillColor('#EFF6FF').fill()
  doc.rect(L, by, 3, bh).fillColor(bc).fill()
  doc.fillColor(C.gray).font('Helvetica').fontSize(9.5)
     .text(text, L + 12, by + 9, { width: TW - 22, lineGap: 2 })
  doc.y = by + bh + 10
}

// Riga tabella chiave–valore alternata
let _rowIdx = 0
function kvRow(label, value) {
  checkPage(22)
  const ry = doc.y
  const bg = (_rowIdx++ % 2 === 0) ? C.stripe : C.white
  doc.rect(L, ry, TW, 20).fillColor(bg).fill()
  doc.fillColor(C.dark).font('Helvetica-Bold').fontSize(9.5)
     .text(label, L + 8, ry + 5, { width: 155 })
  doc.fillColor(C.gray).font('Helvetica').fontSize(9.5)
     .text(value, L + 168, ry + 5, { width: TW - 172 })
  doc.y = ry + 22
}
function kvStart() { _rowIdx = 0 }

// ══════════════════════════════════════════════════════════
// COPERTINA
// ══════════════════════════════════════════════════════════
doc.rect(0, 0, PW, PH).fillColor('#0F172A').fill()
doc.rect(0, 0, PW, 6).fillColor(C.blue).fill()
doc.rect(0, PH - 6, PW, 6).fillColor(C.blue).fill()

doc.fillColor(C.white).font('Helvetica-Bold').fontSize(52)
   .text('TIMBRY', 0, 260, { align: 'center', width: PW })

doc.fillColor(C.blue).font('Helvetica').fontSize(16)
   .text('Guida rapida all\'utilizzo', 0, 326, { align: 'center', width: PW })

doc.save()
doc.moveTo(140, 358).lineTo(PW - 140, 358).lineWidth(0.8).strokeColor(C.blue).stroke()
doc.restore()

doc.fillColor('#94A3B8').font('Helvetica').fontSize(12)
   .text('Per il titolare  ·  Per il dipendente', 0, 370, { align: 'center', width: PW })

doc.fillColor('#475569').font('Helvetica').fontSize(9)
   .text(
     'Sistema di presenze NFC  ·  ' +
     new Date().toLocaleDateString('it-IT', { month: 'long', year: 'numeric' }),
     0, PH - 36, { align: 'center', width: PW }
   )

// ══════════════════════════════════════════════════════════
// INDICE
// ══════════════════════════════════════════════════════════
doc.addPage({ size: 'A4', margin: 0 })
doc.rect(0, 0, PW, 52).fillColor('#0F172A').fill()
doc.fillColor(C.white).font('Helvetica-Bold').fontSize(18).text('Indice', L, 16)
doc.fillColor(C.blue).font('Helvetica').fontSize(10)
   .text('Timbry · Guida rapida', L, 37)
doc.y = 68

const TOC = [
  ['A', 'Il titolare — Dashboard',                 'Cosa mostra la pagina principale'],
  ['B', 'Il titolare — Dipendenti',                'Lista, scheda, storico presenze, export'],
  ['C', 'Il titolare — Badge NFC',                 'Registrare badge e creare account dipendente'],
  ['D', 'Il titolare — Lettori NFC',               'Monitorare i dispositivi fisici'],
  ['E', 'Il titolare — Fasce orarie',              'Definire regole entrata / uscita'],
  ['F', 'Il titolare — Richieste',                 'Gestire ferie, permessi e timbrature mancate'],
  ['G', 'Il titolare — Pausa aziendale',           'Chiudere l\'azienda per un intero periodo'],
  ['H', 'Il dipendente — Portale personale',       'Presenze, ferie, richieste'],
]

TOC.forEach(([letter, title, sub], i) => {
  const ry = doc.y
  doc.rect(L, ry, TW, 36).fillColor(i % 2 === 0 ? C.stripe : C.white).fill()
  doc.rect(L, ry, 3, 36).fillColor(C.blue).fill()
  // lettera
  doc.rect(L + 10, ry + 8, 20, 20).fillColor(C.blue).fill()
  doc.fillColor(C.white).font('Helvetica-Bold').fontSize(10)
     .text(letter, L + 10, ry + 12, { width: 20, align: 'center' })
  // testi
  doc.fillColor(C.dark).font('Helvetica-Bold').fontSize(10.5)
     .text(title, L + 38, ry + 6, { width: TW - 42 })
  doc.fillColor(C.gray).font('Helvetica').fontSize(9)
     .text(sub, L + 38, ry + 21, { width: TW - 42 })
  doc.y = ry + 38
})

// ══════════════════════════════════════════════════════════
// A — DASHBOARD TITOLARE
// ══════════════════════════════════════════════════════════
chapterTitle('A  ·  Dashboard — cosa vedi appena entri')

body('La dashboard è la prima schermata dopo il login. In un colpo d\'occhio vedi la situazione di tutta l\'azienda in questo momento.')

secTitle('I quattro riquadri in cima')
kvStart()
kvRow('Presenti adesso',     'Dipendenti che hanno timbrato entrata ma non ancora uscita → sono in azienda ora.')
kvRow('Assenti oggi',        'Dipendenti che non hanno ancora timbrato l\'entrata stamattina.')
kvRow('In ferie',            'Dipendenti con ferie approvate o coperti da una pausa aziendale.')
kvRow('Richieste in attesa', 'Numero di richieste di ferie o permessi che aspettano la tua risposta.')

secTitle('Grafico settimanale')
body('Mostra le ore lavorate da ogni dipendente negli ultimi 7 giorni. Utile per vedere subito chi è in regola e chi ha ore anomale.')

secTitle('Ultima timbratura ricevuta')
body('In fondo alla pagina trovi l\'ultima timbratura arrivata dal lettore NFC: nome del dipendente, tipo (ENTRATA / USCITA) e orario preciso.')

secTitle('Menu di navigazione')
item('', 'Dashboard — la pagina dove sei adesso.')
item('', 'Richieste — ferie, permessi e timbrature mancate (appare un numero rosso se ci sono richieste in attesa).')
item('', 'Pausa aziendale — chiudi l\'intera azienda per un periodo.')
item('', 'Dipendenti — anagrafica e storico presenze.')
item('', 'Badge — registra badge NFC e crea account dipendenti.')
item('', 'Lettori NFC — vedi lo stato dei dispositivi fisici.')

// ══════════════════════════════════════════════════════════
// B — DIPENDENTI
// ══════════════════════════════════════════════════════════
chapterTitle('B  ·  Dipendenti — gestione e storico presenze')

secTitle('Lista dipendenti')
body('Mostra tutti i dipendenti dell\'azienda con nome, stato attuale (presente / assente / fuori turno) e le ore lavorate questo mese.')

step(1, 'Aggiungere un dipendente', 'Clicca + Aggiungi dipendente. Inserisci nome e cognome (email opzionale). Poi vai su Badge per associargli un badge NFC.')
step(2, 'Aprire la scheda', 'Clicca sul nome del dipendente per vedere tutto il dettaglio.')

secTitle('Scheda dipendente — statistiche')
kvStart()
kvRow('Ore questo mese',   'Totale ore lavorate nel mese corrente, calcolate automaticamente.')
kvRow('Presenze totali',   'Numero di giorni in cui ha timbrato almeno una volta.')
kvRow('Assenze',           'Giorni con turno programmato ma nessuna timbratura (solo se turni attivi).')
kvRow('Straordinari',      'Ore lavorate oltre il turno previsto (solo se turni attivi).')

secTitle('Storico presenze mensile')
body('Clicca su Storico per aprire il calendario mensile. Usa le frecce ‹ › per navigare tra i mesi. Ogni riga è un giorno e mostra:')
item('', 'Gli orari di entrata e uscita registrati dal lettore NFC.')
item('', 'Le ore lavorate quel giorno, calcolate in automatico.')
item('', 'Lo stato del giorno: Presente, Assente, In ferie, Giustificata, Straordinario.')

secTitle('Aggiungere una timbratura manuale')
body('Disponibile solo quando il portale dipendenti è disattivato. Serve per correggere dimenticanze.')
step(1, 'Clicca il pulsante +', 'presente in fondo ad ogni riga del giorno, oppure il pulsante + Timbratura nell\'header.')
step(2, 'Compila il form', 'Seleziona data, ora e tipo (ENTRATA o USCITA).')
step(3, 'Salva', 'La timbratura appare nella tabella evidenziata in ambra con l\'icona ✎ — le timbrature manuali si distinguono sempre da quelle del lettore.')

note('Puoi eliminare solo le timbrature aggiunte manualmente (icona ✕ rossa). Le timbrature registrate dal lettore NFC non possono essere cancellate dal sito.')

secTitle('Export presenze')
body('Dal menu della scheda dipendente puoi scaricare le presenze del mese selezionato:')
item('', 'PDF — report stampabile con tabella giornaliera, ore per giorno e totale mensile.')
item('', 'Excel — foglio di calcolo con tutti i dati, utile per elaborazioni o archiviazione.')
note('Le timbrature manuali nei file di export hanno il suffisso (M) accanto all\'orario, così si distinguono facilmente.')

// ══════════════════════════════════════════════════════════
// C — BADGE NFC
// ══════════════════════════════════════════════════════════
chapterTitle('C  ·  Badge NFC — registrazione e account')

body('Prima che un dipendente possa timbrare, il suo badge fisico deve essere associato al suo profilo. Questa operazione va fatta una sola volta.')

secTitle('Come associare un badge')
step(1, 'Avvicina il badge al lettore', 'Il lettore legge il badge e lo invia al server. Sul sito appare in tempo reale il messaggio con l\'UID del badge rilevato.')
step(2, 'Inserisci nome e cognome', 'Digita i dati del dipendente nel form. Se il portale dipendenti è attivo, inserisci anche l\'email (necessaria per l\'invio credenziali).')
step(3, 'Clicca Registra', 'Il badge viene associato e il dipendente è creato nel sistema. Da questo momento può timbrare.')

secTitle('Eliminare un badge')
body('Clicca l\'icona del cestino accanto al badge nella lista. Questa operazione elimina anche il dipendente associato e tutte le sue presenze, turni e richieste. È irreversibile.')

secTitle('Creare l\'account portale per un dipendente')
body('Se il portale dipendenti è attivo (vedi Sezione G del pannello superadmin), puoi creare credenziali di accesso per ogni dipendente:')
item('', 'Nella pagina Badge, accanto ad ogni dipendente compare il pulsante Crea account.')
item('', 'Inserisci username e password. Le credenziali vengono inviate via email al dipendente.')
item('', 'Il dipendente potrà accedere al portale con quelle credenziali.')

// ══════════════════════════════════════════════════════════
// D — LETTORI NFC
// ══════════════════════════════════════════════════════════
chapterTitle('D  ·  Lettori NFC — monitoraggio dispositivi')

body('La pagina Lettori NFC mostra tutti i dispositivi fisici collegati alla tua azienda. Non è richiesta nessuna azione — è solo una vista di monitoraggio.')

secTitle('Informazioni per ogni lettore')
kvStart()
kvRow('Reader ID',        'Il nome identificativo del lettore, impostato durante la configurazione del dispositivo.')
kvRow('Stato',            'ONLINE (verde) se il lettore ha mandato un segnale negli ultimi 2 minuti. OFFLINE (rosso) altrimenti.')
kvRow('Ultimo ping',      'Data e ora esatte dell\'ultimo segnale ricevuto.')
kvRow('Firmware',         'Versione del software installato sul dispositivo.')

secTitle('Il lettore è offline — cosa fare')
item('', 'Verifica che il dispositivo sia acceso e alimentato.')
item('', 'Controlla che sia connesso alla rete WiFi aziendale (lo schermo del lettore mostra ONLINE / OFFLINE).')
item('', 'Se necessario, stacca e riattacca l\'alimentazione — il lettore si riconnette automaticamente.')

// ══════════════════════════════════════════════════════════
// E — FASCE ORARIE
// ══════════════════════════════════════════════════════════
chapterTitle('E  ·  Fasce orarie — entrata e uscita automatica')

body('Le fasce orarie dicono al sistema quando una timbratura vale come ENTRATA e quando come USCITA. Senza fasce il sistema alterna automaticamente entrata e uscita per ogni dipendente.')

secTitle('Esempio pratico')
body('Un\'azienda con un turno standard può usare due fasce:')
item('', 'Mattina   07:30 – 09:30   tipo ENTRATA')
item('', 'Sera       17:00 – 19:30   tipo USCITA')
body('Chiunque timbri nella fascia mattutina viene registrato come in entrata. Chiunque timbri nella fascia serale come in uscita. Fuori dalle fasce il sistema usa l\'alternanza automatica.')

secTitle('Aggiungere una fascia')
step(1, 'Vai su Fasce orarie', '(o dalla scheda azienda nel pannello superadmin).')
step(2, 'Clicca + Nuova fascia', 'Inserisci nome (opzionale), ora inizio, ora fine e tipo ENTRATA o USCITA.')
step(3, 'Salva', 'La fascia è attiva immediatamente.')

note('Se un dipendente timbra due volte nella stessa fascia (badge passato per errore due volte), il sistema inverte automaticamente il tipo per la seconda lettura.')

// ══════════════════════════════════════════════════════════
// F — RICHIESTE
// ══════════════════════════════════════════════════════════
chapterTitle('F  ·  Richieste — ferie, permessi, timbrature mancate')

body('Quando il portale dipendenti è attivo, i dipendenti possono inviare richieste direttamente dal loro portale. Tu le gestisci da questa sezione.')

secTitle('Tipi di richiesta')
kvStart()
kvRow('Ferie',               'Il dipendente chiede un periodo di ferie con date di inizio e fine.')
kvRow('Giustificazione',     'Il dipendente giustifica un\'assenza passata indicando il motivo.')
kvRow('Timbratura mancata',  'Il dipendente chiede di aggiungere una timbratura che ha dimenticato di fare.')

secTitle('Come gestire una richiesta')
step(1, 'Apri Richieste dal menu', 'Il numero rosso nel menu indica quante richieste aspettano una risposta.')
step(2, 'Leggi la richiesta', 'Vedi dipendente, tipo, periodo e note scritte dal dipendente.')
step(3, 'Approva o Rifiuta', 'Clicca il pulsante verde Approva o il pulsante rosso Rifiuta. Puoi aggiungere una nota di risposta.')

secTitle('Cosa succede dopo')
item('', 'Ferie approvate: il dipendente appare come "In ferie" in dashboard per le date indicate. Il sistema invia un\'email di conferma al dipendente.', C.green)
item('', 'Timbratura mancata approvata: la timbratura viene aggiunta automaticamente con data e ora indicate dal dipendente.', C.green)
item('', 'Richiesta rifiutata: il dipendente riceve una notifica e vede lo stato "Rifiutata" nel suo portale.', C.red)

// ══════════════════════════════════════════════════════════
// G — PAUSA AZIENDALE
// ══════════════════════════════════════════════════════════
chapterTitle('G  ·  Pausa aziendale — chiusura collettiva')

body('La pausa aziendale segna tutti i dipendenti come in ferie per un intervallo di date senza dover creare una richiesta per ognuno. Utile per ferie estive, chiusura natalizia e simili.')

secTitle('Creare una pausa')
step(1, 'Vai su Pausa aziendale', 'dal menu principale.')
step(2, 'Clicca Crea pausa aziendale', 'Si apre il form.')
step(3, 'Inserisci date e motivo', 'Data inizio, data fine e una descrizione (es: "Ferie agosto 2025").')
step(4, 'Conferma', 'La pausa è attiva. Tutti i dipendenti risultano in ferie per quel periodo.')

secTitle('Annullare una pausa')
body('Se la pausa è attiva, nella pagina compare un riquadro verde con le date e il motivo. Clicca il pulsante rosso Annulla pausa per disattivarla immediatamente.')

note('Il sistema controlla automaticamente che non ci siano sovrapposizioni con pause già esistenti. Se esiste già una pausa in quel periodo, ti avvisa prima di salvare.')

// ══════════════════════════════════════════════════════════
// H — PORTALE DIPENDENTE
// ══════════════════════════════════════════════════════════
chapterTitle('H  ·  Portale dipendente — cosa vede il dipendente')

body('Il dipendente accede allo stesso sito del titolare ma con le proprie credenziali. Il sistema riconosce il ruolo e mostra un\'interfaccia personale con solo i propri dati.')

secTitle('Dashboard personale')
body('La prima schermata mostra il riepilogo del mese in corso:')
kvStart()
kvRow('Ore lavorate',        'Totale ore del mese corrente aggiornato ad oggi.')
kvRow('Giorni assenti',      'Giorni in cui non ha timbrato (e aveva turno programmato).')
kvRow('Ore straordinario',   'Ore lavorate oltre il turno previsto (se i turni sono attivi).')
kvRow('Giorni ferie',        'Ferie approvate nel mese.')

secTitle('Tab Storico presenze')
body('Il dipendente vede il proprio storico mese per mese (frecce ‹ › per navigare). Ogni riga mostra data, entrata, uscita, ore e stato del giorno.')
note('Il dipendente può solo consultare le proprie presenze. Non può modificarle. Per correzioni deve inviare una richiesta al titolare.')

secTitle('Tab Ferie — richiedere un periodo di assenza')
step(1, 'Vai su Ferie', 'nel portale personale.')
step(2, 'Clicca Nuova richiesta', 'Inserisci data inizio, data fine e una nota opzionale per il titolare.')
step(3, 'Invia', 'La richiesta arriva al titolare. Il dipendente la vede con stato "In attesa".')
step(4, 'Risposta del titolare', 'Quando il titolare risponde, lo stato cambia in Approvata o Rifiutata. Se la richiesta è ancora in attesa può essere cancellata.')

secTitle('Tab Richieste — timbratura mancata e giustificazioni')
body('Il dipendente può segnalare timbrature che ha dimenticato di fare o giustificare un\'assenza:')
item('', 'Timbratura mancata: indica il tipo (ENTRATA o USCITA), la data, l\'ora e il motivo. Il titolare la approverà o rifiuterà.')
item('', 'Giustificazione assenza: indica la data e il motivo dell\'assenza. Serve a spiegare un giorno segnato come assente.')

secTitle('Tab Turni')
body('Mostra i turni di lavoro assegnati per ogni giorno della settimana: orari di ingresso e uscita per il mattino e il pomeriggio (se previsti).')

// ── NUMERI DI PAGINA ───────────────────────────────────
const rng = doc.bufferedPageRange()
for (let i = 1; i < rng.count; i++) {
  doc.switchToPage(rng.start + i)
  const fy = PH - 30
  doc.save()
  doc.moveTo(L, fy - 4).lineTo(PW - R, fy - 4)
     .lineWidth(0.4).strokeColor('#E5E7EB').stroke()
  doc.restore()
  doc.fillColor('#9CA3AF').font('Helvetica').fontSize(8)
     .text('Timbry · Guida rapida all\'utilizzo', L, fy, { width: TW / 2 })
  doc.fillColor(C.blue).font('Helvetica-Bold').fontSize(8)
     .text(i + ' / ' + (rng.count - 1), L, fy, { width: TW, align: 'right' })
}

doc.end()
doc.on('end', () => console.log('OK → ' + OUT))
