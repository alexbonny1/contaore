import { createRequire } from 'module'
import { createWriteStream } from 'fs'
const require = createRequire(import.meta.url)
const PDF = require('/home/user/contaore/contaore/backend/node_modules/pdfkit')

const OUT = '/home/user/contaore/Timbry_Guida.pdf'
const doc = new PDF({ size: 'A4', margin: 0, bufferPages: true })
doc.pipe(createWriteStream(OUT))

const PW = 595.28, PH = 841.89
const L = 48, TW = PW - L - 48

const BLU    = '#0099FF'
const DARK   = '#111827'
const GRAY   = '#6B7280'
const LGRAY  = '#F3F4F6'
const WHITE  = '#FFFFFF'
const GREEN  = '#16a34a'
const RED    = '#DC2626'
const AMBER  = '#D97706'
const PURPLE = '#7C3AED'

// ── helpers ────────────────────────────────────────────────

function checkPage(h) {
  if (doc.y + (h || 40) > PH - 44) {
    doc.addPage({ size: 'A4', margin: 0 })
    doc.y = 48
  }
}

function page(title, sub) {
  doc.addPage({ size: 'A4', margin: 0 })
  doc.rect(0, 0, PW, 50).fillColor(DARK).fill()
  doc.rect(0, 0, PW, 4).fillColor(BLU).fill()
  doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(16).text(title, L, 14, { width: TW })
  if (sub) doc.fillColor('#9CA3AF').font('Helvetica').fontSize(9).text(sub, L, 34, { width: TW })
  doc.y = 62
}

function sec(text) {
  checkPage(30)
  doc.y += 6
  const sy = doc.y
  doc.rect(L, sy, TW, 20).fillColor(LGRAY).fill()
  doc.rect(L, sy, 3, 20).fillColor(BLU).fill()
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(10).text(text, L + 10, sy + 5, { width: TW - 14 })
  doc.y = sy + 24
}

function txt(t) {
  checkPage(24)
  doc.fillColor(GRAY).font('Helvetica').fontSize(9.5)
     .text(t, L, doc.y, { width: TW, lineGap: 2 })
  doc.y += 4
}

function li(t, color) {
  checkPage(18)
  const cy = doc.y
  doc.circle(L + 4, cy + 5, 2.5).fillColor(color || BLU).fill()
  doc.fillColor(DARK).font('Helvetica').fontSize(9.5)
     .text(t, L + 12, cy, { width: TW - 12, lineGap: 2 })
  doc.y += 2
}

let _r = 0
function kvReset() { _r = 0 }
function kv(k, v) {
  checkPage(18)
  const ky = doc.y
  doc.rect(L, ky, TW, 18).fillColor(_r++ % 2 ? WHITE : LGRAY).fill()
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9).text(k, L + 8, ky + 4, { width: 148 })
  doc.fillColor(GRAY).font('Helvetica').fontSize(9).text(v, L + 160, ky + 4, { width: TW - 164 })
  doc.y = ky + 19
}

function box(text, bg, border) {
  checkPage(40)
  bg = bg || '#EFF6FF'; border = border || BLU
  const h = doc.heightOfString(text, { width: TW - 22, fontSize: 9, lineGap: 2 }) + 16
  const by = doc.y + 4
  doc.rect(L, by, TW, h).fillColor(bg).fill()
  doc.rect(L, by, 3, h).fillColor(border).fill()
  doc.fillColor(GRAY).font('Helvetica').fontSize(9)
     .text(text, L + 12, by + 8, { width: TW - 22, lineGap: 2 })
  doc.y = by + h + 6
}

function step(n, bold, desc) {
  checkPage(24)
  const sy = doc.y
  doc.rect(L, sy, 18, 18).fillColor(BLU).fill()
  doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(8.5).text(String(n), L, sy + 4, { width: 18, align: 'center' })
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9.5).text(bold, L + 24, sy + 2, { width: TW - 24 })
  if (desc) {
    doc.fillColor(GRAY).font('Helvetica').fontSize(9)
       .text(desc, L + 24, doc.y + 1, { width: TW - 24, lineGap: 2 })
  }
  doc.y += 5
}

// badge colorato inline
function badge(text, bg, fg) {
  checkPage(16)
  const bw = doc.widthOfString(text, { fontSize: 8, font: 'Helvetica-Bold' }) + 10
  const by = doc.y
  doc.roundedRect(L, by, bw, 14, 3).fillColor(bg).fill()
  doc.fillColor(fg || WHITE).font('Helvetica-Bold').fontSize(8).text(text, L + 5, by + 3, { width: bw - 10 })
  doc.y = by + 18
}

// ══════════════════════════════════════════════════════════
// COPERTINA
// ══════════════════════════════════════════════════════════
doc.rect(0, 0, PW, PH).fillColor('#0F172A').fill()
doc.rect(0, 0, PW, 5).fillColor(BLU).fill()
doc.rect(0, PH - 5, PW, 5).fillColor(BLU).fill()
doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(54)
   .text('TIMBRY', 0, 240, { align: 'center', width: PW })
doc.fillColor(BLU).font('Helvetica').fontSize(15)
   .text('Manuale di utilizzo', 0, 308, { align: 'center', width: PW })
doc.save()
doc.moveTo(110, 338).lineTo(PW - 110, 338).lineWidth(0.7).strokeColor(BLU).stroke()
doc.restore()
doc.fillColor('#94A3B8').font('Helvetica').fontSize(11)
   .text('Per il titolare  ·  Per il dipendente', 0, 349, { align: 'center', width: PW })
doc.fillColor('#64748B').font('Helvetica').fontSize(9)
   .text('Dashboard · Turni · Notifiche email · Portale dipendenti', 0, 368, { align: 'center', width: PW })
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
doc.fillColor('#9CA3AF').font('Helvetica').fontSize(9).text('Timbry · Manuale di utilizzo', L, 36)
doc.y = 62

const TOC = [
  ['1',  'Login',                      'Come accedere · differenza tra titolare e dipendente'],
  ['2',  'Dashboard — titolare',        'Presenti, in pausa, assenti, fuori turno — in tempo reale'],
  ['3',  'Dipendenti',                 'Lista, scheda, storico presenze, esportazione'],
  ['4',  'Gestione turni',             'Assegnare turni singoli e in blocco · pausa automatica'],
  ['5',  'Badge NFC',                  'Registrare un badge · creare account dipendente'],
  ['6',  'Lettori NFC',                'Monitoraggio dispositivi fisici'],
  ['7',  'Richieste',                  'Gestire ferie, giustificazioni, timbrature mancate'],
  ['8',  'Pausa aziendale',            'Chiusura collettiva per un intero periodo'],
  ['9',  'Notifiche email',            '8 tipi di avviso configurabili · targeting per dipendente'],
  ['10', 'Portale dipendente',         'Storico personale, ferie e richieste dal portale'],
]
TOC.forEach(([n, t, d], i) => {
  const ry = doc.y
  doc.rect(L, ry, TW, 33).fillColor(i % 2 === 0 ? LGRAY : WHITE).fill()
  doc.rect(L, ry, 3, 33).fillColor(BLU).fill()
  doc.rect(L + 8, ry + 7, 20, 18).fillColor(BLU).fill()
  doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(8.5).text(n, L + 8, ry + 11, { width: 20, align: 'center' })
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(10).text(t, L + 36, ry + 5, { width: TW - 40 })
  doc.fillColor(GRAY).font('Helvetica').fontSize(8.5).text(d, L + 36, ry + 19, { width: TW - 40 })
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

box('Le credenziali vengono create dal titolare al momento della registrazione del badge. Il dipendente riceve username e password via email e può cambiarle dal portale in qualsiasi momento.')

// ══════════════════════════════════════════════════════════
// 2 — DASHBOARD TITOLARE
// ══════════════════════════════════════════════════════════
page('2 · Dashboard — titolare', 'La situazione dell\'azienda in tempo reale')

txt('È la prima schermata dopo il login del titolare. Si aggiorna automaticamente ogni 5 secondi senza dover ricaricare la pagina.')

sec('I cinque contatori in cima alla pagina')
kvReset()
kv('Dipendenti',   'Numero totale di dipendenti registrati nel sistema.')
kv('Presenti ora', 'Chi ha timbrato entrata e non ancora uscita. Numero in verde.')
kv('In pausa',     'Chi si trova nella finestra di pausa prevista dal turno. Numero in arancione.')
kv('Assenti',      'Chi non ha timbrato oggi pur avendo un turno. Numero in rosso.')
kv('Fuori turno',  'Chi non ha ancora il proprio turno o è a fine giornata. Numero in grigio.')

sec('Le quattro sezioni sotto i contatori')
txt('Ogni sezione mostra le card dei dipendenti nel rispettivo stato. Ogni card riporta nome, codice badge e l\'etichetta di stato.')

box('La sezione "In pausa" è automatica: se il turno di un dipendente prevede una finestra di pausa (es. 12:00–13:00) e l\'orario attuale è in quella finestra, il dipendente appare automaticamente in pausa — senza bisogno di timbrature aggiuntive.', '#FFF7ED', AMBER)

sec('Header e menu di navigazione')
txt('In alto a destra: pulsante Luna/Sole per il tema scuro, Password per cambiarla, Logout per uscire.')
txt('Il menu orizzontale sotto l\'header contiene le voci: Dashboard · Richieste · Pausa aziendale · Dipendenti · Badge · Lettori NFC · Notifiche.')
box('La voce "Richieste" è visibile solo se il portale dipendenti è attivo. Quando ci sono richieste in attesa compare un numero rosso sul pulsante.', '#EFF6FF', BLU)

// ══════════════════════════════════════════════════════════
// 3 — DIPENDENTI
// ══════════════════════════════════════════════════════════
page('3 · Dipendenti', 'Lista, scheda individuale ed esportazione')

sec('Pagina lista dipendenti')
txt('Mostra le card di tutti i dipendenti aggiornate ogni 5 secondi. Ogni card mostra:')
kvReset()
kv('Nome e cognome',   'Con il pallino verde (presente ora) o grigio (assente/fuori turno).')
kv('Badge UID',        'Il codice del badge NFC. "Nessun badge" se non ancora assegnato.')
kv('Letture oggi',     'Quante volte ha passato il badge oggi.')
kv('Ore totali mese',  'Ore lavorate nel mese corrente — in tempo reale.')
kv('Ultima presenza',  'Data e ora dell\'ultima timbratura.')
kv('Turni attivi',     'Spunta verde se i turni sono attivi, grigio se disabilitati.')

txt('Clicca su una card per aprire la scheda del dipendente.')

sec('Assegnazione turni in blocco — selezione multipla')
txt('Nella pagina dipendenti puoi selezionare più persone e assegnare lo stesso turno a tutte contemporaneamente.')
step(1, 'Clicca "Seleziona"', 'Il bottone è in alto a destra. Le card entrano in modalità selezione.')
step(2, 'Clicca le card dei dipendenti', 'Ogni card selezionata mostra una spunta blu. Clicca di nuovo per deselezionare.')
step(3, 'Clicca "Assegna turno" nella barra in basso', 'Appare la barra con il numero di selezionati.')
step(4, 'Configura il turno', 'Scegli i giorni della settimana, gli orari di ingresso e uscita (mattina e pomeriggio se prevista pausa).')
step(5, 'Salva', 'Il turno viene assegnato a tutti i dipendenti selezionati. I turni vengono automaticamente attivati.')
box('Quando assegni un turno in blocco, la spunta "Turni attivi" si attiva in automatico per tutti i dipendenti selezionati — non occorre abilitarla manualmente.', '#F0FDF4', GREEN)

sec('Scheda dipendente — storico presenze')
txt('Usa le frecce ‹ › per navigare tra i mesi. Ogni riga della tabella è un giorno con:')
li('Orari di entrata e uscita rilevati dal lettore NFC.')
li('Ore lavorate quel giorno, calcolate automaticamente (con deduzione pausa se il turno la prevede).')
li('Stato: Presente · Assente · In ferie · Giustificata · Straordinario.')

sec('Timbratura manuale')
step(1, 'Clicca il pulsante + vicino al giorno', 'Oppure "+ Timbratura" in cima alla sezione storico.')
step(2, 'Scegli data, ora e tipo', 'ENTRATA o USCITA.')
step(3, 'Salva', 'La timbratura appare in arancione con icona matita — distinguibile da quelle del lettore.')
box('Puoi eliminare solo le timbrature aggiunte manualmente (icona X rossa). Quelle registrate dal lettore NFC non si eliminano dalla UI.', '#FFF7ED', AMBER)

sec('Esportare le presenze')
txt('Clicca "Esporta" in alto a destra. Si apre una finestra dove scegli:')
li('Periodo: tutto lo storico oppure un singolo mese.')
li('Dipendenti: tutti o solo alcuni (checkbox individuale).')
li('Formato: PDF (rosso) o Excel (verde).')
box('Le timbrature manuali nel file hanno il suffisso (M) accanto all\'orario.')

// ══════════════════════════════════════════════════════════
// 4 — TURNI
// ══════════════════════════════════════════════════════════
page('4 · Gestione turni', 'Assegnare turni · pausa automatica · deduzione ore')

txt('I turni definiscono gli orari di lavoro attesi per ogni dipendente. Permettono di calcolare straordinari, assenze e pause automaticamente.')

sec('Struttura di un turno')
txt('Ogni turno è legato a un dipendente, un giorno della settimana e può avere fino a due fasce orarie:')
kvReset()
kv('Ingresso 1 / Uscita 1',   'Prima fascia oraria (es. 08:00–12:00). Obbligatoria.')
kv('Ingresso 2 / Uscita 2',   'Seconda fascia oraria pomeridiana (es. 13:00–17:00). Opzionale.')
kv('Giorno della settimana',  'Lunedì · Martedì · … · Domenica. Un turno per ogni giorno.')

sec('Assegnare un turno a un singolo dipendente')
step(1, 'Apri la scheda del dipendente', 'Dalla lista Dipendenti, clicca sulla card.')
step(2, 'Vai alla sezione Turni', 'Dentro la scheda del dipendente.')
step(3, 'Clicca "+ Aggiungi turno"', 'Scegli il giorno e compila gli orari.')
step(4, 'Attiva i turni', 'Usa l\'interruttore "Turni attivi" nella scheda per abilitarli.')

sec('Assegnare lo stesso turno a più dipendenti (assegnazione in blocco)')
txt('Dalla pagina lista Dipendenti, seleziona più card e usa il pulsante "Assegna turno" nella barra inferiore — vedi capitolo 3 per i passaggi dettagliati.')

sec('Pausa automatica — come funziona')
txt('Se un turno ha due fasce orarie (mattina e pomeriggio), il sistema riconosce la finestra tra Uscita 1 e Ingresso 2 come pausa pranzo. Questa pausa viene gestita in due modi:')
li('Dashboard in tempo reale: se l\'orario corrente è dentro la finestra di pausa, il dipendente appare in "In pausa" automaticamente — senza nessuna timbratura aggiuntiva.', AMBER)
li('Calcolo ore mensile: il sistema deduce automaticamente la durata della pausa dalle ore lavorate, anche se il dipendente ha timbrato solo entrata e uscita totale.', BLU)

box('Esempio pratico: turno 08:00–12:00 e 13:00–17:00. Il dipendente timbra entrata alle 08:00 e uscita alle 17:00 senza timbrare la pausa. Il sistema calcola 8 ore lavorate (non 9) deducendo automaticamente l\'ora di pausa 12:00–13:00. Se invece il dipendente ha timbrato anche l\'uscita alle 12:00 e il rientro alle 13:00, la deduzione non viene applicata (è già contabilizzata nelle timbrature).', '#EFF6FF', BLU)

sec('Attivare e disattivare i turni')
txt('Dalla scheda del dipendente usa l\'interruttore "Turni attivi". Quando è disabilitato, il dipendente non viene considerato assente se non timbra e non vengono calcolati straordinari.')

// ══════════════════════════════════════════════════════════
// 5 — BADGE NFC
// ══════════════════════════════════════════════════════════
page('5 · Badge NFC', 'Registrare badge e creare account dipendente')

txt('Prima che un dipendente possa timbrare, il suo badge fisico va associato al suo profilo. L\'operazione si fa una volta sola.')

sec('Registrare un nuovo badge')
step(1, 'Clicca "Leggi Tag NFC"', 'Il sito attende che il badge venga avvicinato al lettore fisico.')
step(2, 'Avvicina il badge al lettore', 'Il lettore legge il badge e invia il codice al server. Il sito mostra automaticamente l\'UID rilevato.')
step(3, 'Compila Nome e Cognome', 'Digita i dati del dipendente nel form che appare sotto l\'UID.')
step(4, 'Inserisci l\'email (se portale attivo)', 'Campo obbligatorio quando il portale dipendenti è attivo.')
step(5, 'Clicca "Registra Badge"', 'Il badge è associato. Se il portale è attivo, il dipendente riceve le credenziali via email.')

box('Con il portale attivo il dipendente può accedere con le credenziali ricevute, vedere il proprio storico, fare richieste ferie e segnalare timbrature mancate.', '#EFF6FF', BLU)

sec('Badge già registrati')
txt('Sotto il form c\'è la griglia con tutti i badge associati. Ogni card mostra UID e nome del dipendente. Clicca Elimina per rimuovere il badge e il profilo (operazione irreversibile).')

// ══════════════════════════════════════════════════════════
// 6 — LETTORI NFC
// ══════════════════════════════════════════════════════════
page('6 · Lettori NFC', 'Monitoraggio dei dispositivi fisici')

txt('La pagina mostra tutti i lettori NFC fisici collegati all\'azienda. Si aggiorna ogni 5 secondi. Non richiede azioni — è solo un pannello di controllo.')

sec('Cosa mostra ogni lettore')
kvReset()
kv('Reader ID',   'Il nome identificativo del lettore, impostato durante la configurazione del dispositivo.')
kv('Stato',       'ONLINE (verde) se ha inviato un segnale di recente. OFFLINE (rosso) altrimenti.')
kv('Ultimo ping', 'Data e ora dell\'ultimo segnale ricevuto.')
kv('Firmware',    'Versione del software installato sul dispositivo.')
kv('Sede',        'Etichetta opzionale che indica dove si trova fisicamente il lettore.')

sec('Lettore offline — cosa fare')
li('Verifica che il dispositivo sia acceso e alimentato correttamente.')
li('Controlla che lo schermo del lettore mostri "ONLINE".')
li('Se necessario, stacca e riattacca l\'alimentazione — il lettore si riconnette da solo in pochi secondi.')

box('Se un lettore è offline puoi attivare la notifica email automatica "Lettore NFC offline" dalla sezione Notifiche — vedi capitolo 9.', '#EFF6FF', BLU)

// ══════════════════════════════════════════════════════════
// 7 — RICHIESTE
// ══════════════════════════════════════════════════════════
page('7 · Richieste', 'Ferie, giustificazioni, timbrature mancate')

txt('Visibile solo quando il portale dipendenti è attivo. I dipendenti inviano richieste dal loro portale personale e tu le gestisci qui.')

sec('Tipi di richiesta')
kvReset()
kv('Ferie',              'Il dipendente chiede un periodo di assenza con date di inizio e fine.')
kv('Giustificazione',    'Il dipendente spiega un\'assenza già avvenuta con un motivo.')
kv('Timbratura mancata', 'Il dipendente chiede di aggiungere una timbratura dimenticata (data, ora, tipo).')

sec('I contatori in cima alla pagina')
txt('Mostrano le richieste in attesa in totale e per ciascun tipo — così sai subito dove intervenire.')

sec('Come gestire una richiesta')
step(1, 'Clicca sulla richiesta', 'Si espande e mostra tutti i dettagli: dipendente, tipo, periodo, note.')
step(2, 'Approva o Rifiuta', 'Usa il pulsante verde Approva o il pulsante rosso Rifiuta.')
step(3, 'Elimina', 'Puoi eliminare qualsiasi richiesta con il pulsante del cestino.')

sec('Cosa succede dopo l\'approvazione')
li('Ferie approvate: il dipendente risulta "In ferie" nella dashboard. Riceve una email di conferma.', GREEN)
li('Timbratura mancata approvata: la timbratura viene creata nel sistema con data e ora indicate.', GREEN)
li('Rifiuto: il dipendente vede "Rifiutata" nel suo portale e riceve una email.', RED)

sec('Filtri per tab')
txt('In cima alla lista ci sono le tab: Tutte · Ferie · Giustificazioni · Timbrature. Clicca per filtrare le richieste per tipo.')

// ══════════════════════════════════════════════════════════
// 8 — PAUSA AZIENDALE
// ══════════════════════════════════════════════════════════
page('8 · Pausa aziendale', 'Chiusura collettiva per un intero periodo')

txt('Segna tutti i dipendenti come in ferie per un intervallo di date senza dover creare una richiesta per ognuno. Utile per ferie estive, chiusure natalizie e simili.')

sec('Creare una pausa aziendale')
step(1, 'Vai su Pausa aziendale', 'Dal menu principale.')
step(2, 'Clicca "Crea pausa aziendale"', 'Si apre il form: Data inizio, Data fine, Motivo.')
step(3, 'Conferma', 'La pausa viene salvata. Il sistema verifica che non si sovrapponga a pause già esistenti.')

sec('Pausa attiva')
txt('Se c\'è una pausa attiva, in cima alla pagina compare un riquadro verde con le date e il motivo. Tutti i dipendenti risultano in ferie per quel periodo nella dashboard.')

sec('Annullare una pausa')
txt('Clicca il pulsante rosso "Annulla pausa" nel riquadro verde. La pausa viene disattivata immediatamente.')

// ══════════════════════════════════════════════════════════
// 9 — NOTIFICHE EMAIL
// ══════════════════════════════════════════════════════════
page('9 · Notifiche email', 'Avvisi automatici configurabili')

txt('Dalla sezione Notifiche puoi attivare avvisi email automatici che ti tengono aggiornato senza dover guardare la dashboard. Le email vengono inviate all\'indirizzo del tuo account.')

sec('Come accedere alle impostazioni')
txt('Clicca su "Notifiche" nel menu principale. Ogni card rappresenta un tipo di notifica. Usa l\'interruttore a destra per attivarla o disattivarla. Le impostazioni vengono salvate automaticamente.')

sec('I 5 tipi di avviso per dipendenti')
kvReset()
kv('Dipendente assente',         'Email quando un dipendente non timbra entro N minuti dall\'inizio del turno. Configura i minuti di tolleranza (default 30).')
kv('Ritardo',                    'Email quando un dipendente timbra entrata dopo l\'orario del turno. Configura la tolleranza in minuti (default 5).')
kv('Timbratura uscita mancante', 'Email quando un dipendente è ancora risulta "dentro" dopo N ore. Configura il limite (default 10h).')
kv('Straordinario mensile',      'Email quando un dipendente supera N ore di straordinario nel mese. Configura la soglia (default 10h).')
kv('Riepilogo giornaliero',      'Email ogni sera con presenti e assenti del giorno. Configura l\'ora di invio (default 18:00).')

sec('I 3 tipi di avviso per lettori e riepilogo')
kvReset()
kv('Badge non riconosciuto', 'Email immediata quando viene scansionato un badge non registrato. Puoi scegliere su quali lettori monitorarlo.')
kv('Lettore NFC offline',    'Email quando un lettore non invia dati da N minuti. Configura il limite (default 60 min).')
kv('Riepilogo settimanale',  'Email ogni lunedì con le ore lavorate nella settimana precedente per ogni dipendente. Configura l\'ora di invio (default 08:00).')

sec('Selezionare dipendenti o lettori specifici (targeting)')
txt('Quando una notifica è attiva, sotto i parametri appare la sezione "Dipendenti monitorati" o "Lettori monitorati". Funziona così:')
li('"Tutti" (default): la notifica vale per tutti i dipendenti o tutti i lettori dell\'azienda.')
li('Selezione specifica: clicca uno o più chip con il nome del dipendente o del lettore. La notifica scatta solo per quelli selezionati.')
li('Per tornare a "Tutti": clicca di nuovo il chip "Tutti".')

box('Esempio: vuoi ricevere l\'avviso di assenza solo per i responsabili di reparto. Attivi "Dipendente assente" e clicchi i nomi di quelle persone nella sezione targeting — gli altri dipendenti non genereranno avvisi.', '#EFF6FF', BLU)

sec('Frequenza di controllo')
txt('Il sistema controlla automaticamente ogni 5 minuti: assenze e lettori offline. Ogni 30 minuti: timbrature mancanti, straordinari, riepiloghi. Gli avvisi per badge non riconosciuto e ritardo sono immediati (in tempo reale, ad ogni timbratura).')

box('Ogni avviso viene inviato al massimo una volta al giorno per dipendente o lettore, per evitare email ripetute. I riepiloghi vengono inviati una volta al giorno all\'ora configurata.', '#FFF7ED', AMBER)

// ══════════════════════════════════════════════════════════
// 10 — PORTALE DIPENDENTE
// ══════════════════════════════════════════════════════════
page('10 · Portale dipendente', 'Cosa vede e può fare il dipendente')

txt('Il dipendente accede con le credenziali ricevute via email. Il portale mostra solo i propri dati — non ha accesso alle informazioni degli altri.')

sec('Le statistiche in cima')
kvReset()
kv('Ore questo mese',    'Totale ore lavorate nel mese corrente.')
kv('Giorni assenti',     'Giorni con turno ma nessuna timbratura (solo se i turni sono attivi).')
kv('Ore straordinario',  'Ore oltre il turno previsto (solo se i turni sono attivi).')
kv('Giorni ferie',       'Ferie approvate nel mese corrente.')

box('Se il dipendente è attualmente nella finestra di pausa del suo turno, appare un banner arancione "Sei in pausa" in cima alla pagina — aggiornato in tempo reale.', '#FFF7ED', AMBER)

sec('Tab Storico presenze')
txt('Mesi espandibili con le timbrature giornaliere. Usa le frecce per navigare tra i mesi. Ogni riga mostra stato, orari di entrata/uscita e ore lavorate. I giorni assenti hanno il pulsante "Giustifica assenza".')
box('Il dipendente può solo leggere le proprie presenze. Per correzioni deve inviare una richiesta timbratura mancata.')

sec('Tab Ferie — richiedere ferie')
step(1, 'Clicca "Nuova richiesta"', 'Form con Data inizio, Data fine e Note facoltative.')
step(2, 'Invia', 'La richiesta arriva al titolare con stato "In attesa".')
step(3, 'Attendi risposta', 'Lo stato cambia in Approvata o Rifiutata. Le richieste in attesa possono essere cancellate.')

sec('Tab Richieste — timbratura mancata o giustificazione')
step(1, 'Clicca "Nuova richiesta"', 'Scegli il tipo: timbratura mancata o giustificazione assenza.')
step(2, 'Compila i campi', 'Per timbratura mancata: tipo (ENTRATA/USCITA), data, ora. Per giustificazione: data e motivo.')
step(3, 'Invia', 'Il titolare la vede nella sezione Richieste e può approvarla o rifiutarla.')

sec('Tab Turni')
txt('Mostra i turni di lavoro assegnati per ogni giorno della settimana con gli orari di ingresso e uscita. Il dipendente può solo visionarli — la modifica è riservata al titolare.')

sec('Cambiare la password')
txt('In alto a destra clicca l\'icona lucchetto. Inserisci la password attuale, poi la nuova password due volte e conferma.')

// ── NUMERI DI PAGINA ─────────────────────────────────────
const rng = doc.bufferedPageRange()
for (let i = 1; i < rng.count; i++) {
  doc.switchToPage(rng.start + i)
  const fy = PH - 28
  doc.save()
  doc.moveTo(L, fy - 3).lineTo(PW - 48, fy - 3)
     .lineWidth(0.4).strokeColor('#E5E7EB').stroke()
  doc.restore()
  doc.fillColor('#9CA3AF').font('Helvetica').fontSize(7.5)
     .text('Timbry · Manuale di utilizzo', L, fy, { width: TW / 2 })
  doc.fillColor(BLU).font('Helvetica-Bold').fontSize(7.5)
     .text(i + ' / ' + (rng.count - 1), L, fy, { width: TW, align: 'right' })
}

doc.end()
doc.on('end', () => console.log('OK → ' + OUT))
