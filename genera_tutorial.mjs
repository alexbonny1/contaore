import { createRequire } from 'module'
import { createWriteStream } from 'fs'
const require = createRequire(import.meta.url)
const PDFDocument = require('/home/user/contaore/contaore/backend/node_modules/pdfkit')

const OUT = '/home/user/contaore/Timbry_Tutorial.pdf'
const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true })
doc.pipe(createWriteStream(OUT))

const W = 595.28
const H = 841.89
const ML = 48
const MR = 48
const TW = W - ML - MR   // 499.28

const TIMBRY  = '#0099FF'
const DARK    = '#1a1a2e'
const GRAY    = '#555555'
const LGRAY   = '#f4f6f8'
const WHITE   = '#ffffff'
const GREEN   = '#16a34a'
const BLUE    = '#1d4ed8'
const AMBER   = '#b45309'

// ── utility ─────────────────────────────────────────────

function currentY() { return doc.y }

function hRule(y, color = '#dddddd') {
  doc.save()
  doc.moveTo(ML, y).lineTo(W - MR, y).lineWidth(0.5).strokeColor(color).stroke()
  doc.restore()
}

// copertina: sfondo pieno DARK
function cover() {
  doc.rect(0, 0, W, H).fillColor(DARK).fill()

  // banda colorata in cima
  doc.rect(0, 0, W, 8).fillColor(TIMBRY).fill()

  // titolo
  doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(44)
     .text('TIMBRY', 0, 200, { align: 'center', width: W })

  doc.fillColor(TIMBRY).font('Helvetica').fontSize(17)
     .text('Guida all\'utilizzo', 0, 258, { align: 'center', width: W })

  // linea decorativa
  doc.save()
  doc.moveTo(ML + 80, 292).lineTo(W - MR - 80, 292)
     .lineWidth(1).strokeColor(TIMBRY).stroke()
  doc.restore()

  doc.fillColor('#aaaaaa').font('Helvetica').fontSize(11)
     .text('Per il titolare e per il dipendente', 0, 306, { align: 'center', width: W })

  // banda in fondo
  doc.rect(0, H - 44, W, 44).fillColor('#111122').fill()
  doc.fillColor('#666688').font('Helvetica').fontSize(9)
     .text('Timbry · Sistema di Presenze NFC  —  ' +
           new Date().toLocaleDateString('it-IT', { year: 'numeric', month: 'long' }),
           0, H - 26, { align: 'center', width: W })
}

// nuova pagina con header colorato
function newSection(title, subtitle) {
  doc.addPage({ size: 'A4', margin: 0 })

  doc.rect(0, 0, W, 56).fillColor(TIMBRY).fill()
  doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(18)
     .text(title, ML, 14, { width: TW })
  if (subtitle) {
    doc.fillColor('#d0eeff').font('Helvetica').fontSize(10)
       .text(subtitle, ML, 36, { width: TW })
  }

  doc.y = 72
}

// blocco titolo di sezione
function sectionHead(text) {
  if (doc.y > 700) { doc.addPage({ size: 'A4', margin: 0 }); doc.y = 48 }
  doc.moveDown(0.6)
  const y = doc.y
  doc.rect(ML, y, TW, 24).fillColor(LGRAY).fill()
  doc.rect(ML, y, 3, 24).fillColor(TIMBRY).fill()
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(11)
     .text(text, ML + 10, y + 6, { width: TW - 14 })
  doc.y = y + 30
}

// testo paragrafo
function para(text) {
  if (doc.y > 720) { doc.addPage({ size: 'A4', margin: 0 }); doc.y = 48 }
  doc.fillColor(GRAY).font('Helvetica').fontSize(10)
     .text(text, ML, doc.y, { width: TW, align: 'justify', lineGap: 2 })
  doc.moveDown(0.35)
}

// voce puntata
function bullet(text) {
  if (doc.y > 730) { doc.addPage({ size: 'A4', margin: 0 }); doc.y = 48 }
  const y = doc.y
  doc.fillColor(TIMBRY).font('Helvetica-Bold').fontSize(11)
     .text('·', ML + 4, y, { width: 12 })
  doc.fillColor(DARK).font('Helvetica').fontSize(10)
     .text(text, ML + 18, y, { width: TW - 18, lineGap: 2 })
  doc.moveDown(0.15)
}

// voce numerata
function step(n, bold, rest) {
  if (doc.y > 720) { doc.addPage({ size: 'A4', margin: 0 }); doc.y = 48 }
  const y = doc.y
  // cerchio numero
  doc.circle(ML + 8, y + 7, 8).fillColor(TIMBRY).fill()
  doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(8)
     .text(String(n), ML + 4, y + 3, { width: 9, align: 'center' })
  // testo
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(10)
     .text(bold + '  ', ML + 22, y, { continued: true, width: TW - 22 })
  doc.fillColor(GRAY).font('Helvetica').fontSize(10)
     .text(rest, { width: TW - 22, lineGap: 2 })
  doc.moveDown(0.25)
}

// riquadro informativo
function infoBox(text, color) {
  if (doc.y > 680) { doc.addPage({ size: 'A4', margin: 0 }); doc.y = 48 }
  const boxColor = color || '#e8f4fd'
  const startY = doc.y

  // misura altezza testo
  const th = doc.heightOfString(text, { width: TW - 28, lineGap: 2 })
  const bh = th + 18

  doc.rect(ML, startY, TW, bh).fillColor(boxColor).fill()
  doc.rect(ML, startY, 3, bh).fillColor(TIMBRY).fill()
  doc.fillColor(GRAY).font('Helvetica').fontSize(9.5)
     .text(text, ML + 12, startY + 9, { width: TW - 20, lineGap: 2 })
  doc.y = startY + bh + 8
}

// coppia label / valore in riga
function kv(label, value) {
  if (doc.y > 730) { doc.addPage({ size: 'A4', margin: 0 }); doc.y = 48 }
  const y = doc.y
  doc.rect(ML, y, TW, 20).fillColor(doc.y % 40 < 20 ? LGRAY : WHITE).fill()
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(9.5)
     .text(label, ML + 8, y + 5, { width: 140 })
  doc.fillColor(GRAY).font('Helvetica').fontSize(9.5)
     .text(value, ML + 152, y + 5, { width: TW - 160 })
  doc.y = y + 22
}

// ── COPERTINA ──────────────────────────────────────────────
cover()

// ── INDICE ─────────────────────────────────────────────────
doc.addPage({ size: 'A4', margin: 0 })
doc.rect(0, 0, W, 56).fillColor(DARK).fill()
doc.fillColor(WHITE).font('Helvetica-Bold').fontSize(20).text('Indice', ML, 18)
doc.fillColor(TIMBRY).font('Helvetica').fontSize(10).text('Timbry · Guida all\'utilizzo', ML, 40)
doc.y = 72

const tocRows = [
  ['Sezione 1', 'Accesso e login',                      '— per il titolare e per il dipendente'],
  ['Sezione 2', 'Dashboard titolare',                   '— riepilogo presenze e dati aziendali'],
  ['Sezione 3', 'Gestione dipendenti',                  '— aggiungi, modifica, consulta le schede'],
  ['Sezione 4', 'Storico presenze e scheda dipendente', '— timbrature, coppie ore, export'],
  ['Sezione 5', 'Badge NFC',                            '— associa badge ai dipendenti'],
  ['Sezione 6', 'Lettori NFC',                          '— monitoraggio dispositivi'],
  ['Sezione 7', 'Fasce orarie',                         '— regole entrata e uscita'],
  ['Sezione 8', 'Richieste (ferie, permessi)',          '— gestione richieste dei dipendenti'],
  ['Sezione 9', 'Pausa aziendale',                      '— chiusura aziendale collettiva'],
  ['Sezione 10','Dashboard dipendente',                 '— cosa vede e cosa può fare il dipendente'],
]

tocRows.forEach(([num, title, desc], i) => {
  const y = doc.y
  doc.rect(ML, y, TW, 34).fillColor(i % 2 === 0 ? LGRAY : WHITE).fill()
  doc.rect(ML, y, 3, 34).fillColor(TIMBRY).fill()
  doc.fillColor(TIMBRY).font('Helvetica-Bold').fontSize(8.5).text(num, ML + 10, y + 5, { width: 52 })
  doc.fillColor(DARK).font('Helvetica-Bold').fontSize(10.5).text(title, ML + 66, y + 4, { width: TW - 70 })
  doc.fillColor(GRAY).font('Helvetica').fontSize(9).text(desc, ML + 66, y + 19, { width: TW - 70 })
  doc.y = y + 36
})


// ═══════════════════════════════════════════════════════════
// SEZIONE 1 — LOGIN
// ═══════════════════════════════════════════════════════════
newSection('Sezione 1 · Accesso e login', 'Come accedere alla piattaforma')

sectionHead('Pagina di login')
para('Apri il browser e vai all\'indirizzo del sito Timbry. Inserisci le tue credenziali (username e password) e clicca su Accedi.')
bullet('Il titolare riceve username e password via email al momento della creazione dell\'account.')
bullet('Il dipendente riceve le credenziali dal titolare quando viene creato l\'account portale.')
bullet('In caso di problemi di accesso, contatta il tuo amministratore di sistema.')

sectionHead('Differenza tra titolare e dipendente')
para('Il sito riconosce automaticamente il tipo di account e mostra l\'interfaccia corrispondente:')
bullet('Titolare (ruolo owner): accede al pannello completo di gestione aziendale.')
bullet('Dipendente: accede al portale personale con le proprie presenze e richieste.')

infoBox('Se vedi la dashboard con i grafici e il menu completo, hai effettuato l\'accesso come titolare. Se vedi solo le tue presenze personali, hai effettuato l\'accesso come dipendente.')


// ═══════════════════════════════════════════════════════════
// SEZIONE 2 — DASHBOARD TITOLARE
// ═══════════════════════════════════════════════════════════
newSection('Sezione 2 · Dashboard titolare', 'Il riepilogo in tempo reale della tua azienda')

para('La dashboard è la prima schermata che vedi dopo il login. Mostra una fotografia aggiornata della situazione aziendale in questo momento.')

sectionHead('Riquadri di stato (in alto)')
para('Quattro riquadri mostrano immediatamente i numeri del giorno:')
kv('Presenti adesso',  'Dipendenti che hanno timbrato l\'entrata e non ancora l\'uscita — sono in azienda in questo momento.')
kv('Assenti oggi',     'Dipendenti che non hanno ancora timbrato l\'entrata oggi.')
kv('In ferie',         'Dipendenti con una richiesta di ferie approvata per oggi, o coperti da una pausa aziendale.')
kv('Richieste pending','Numero di richieste di ferie o permessi ancora in attesa di approvazione.')

sectionHead('Grafico settimanale')
para('Il grafico a barre mostra le ore lavorate da ogni dipendente negli ultimi 7 giorni. Permette di confrontare rapidamente chi ha lavorato di più e identificare eventuali anomalie.')
bullet('Passa con il mouse su una barra per vedere il dettaglio delle ore.')
bullet('I dipendenti in ferie non compaiono nel grafico del giorno di assenza.')

sectionHead('Ultima timbratura')
para('Un riquadro nella parte bassa mostra l\'ultima timbratura ricevuta dal lettore NFC: nome del dipendente, tipo (ENTRATA o USCITA) e orario esatto.')

sectionHead('Navigazione principale')
para('Il menu orizzontale in alto consente di spostarsi tra le sezioni:')
bullet('Dashboard — la pagina attuale.')
bullet('Richieste — gestione richieste ferie e permessi (con badge rosso se ci sono richieste in attesa).')
bullet('Pausa aziendale — chiudi l\'intera azienda per un periodo.')
bullet('Dipendenti — anagrafica e presenze.')
bullet('Badge — associa i badge NFC ai dipendenti.')
bullet('Lettori NFC — monitora i dispositivi fisici.')


// ═══════════════════════════════════════════════════════════
// SEZIONE 3 — GESTIONE DIPENDENTI
// ═══════════════════════════════════════════════════════════
newSection('Sezione 3 · Gestione dipendenti', 'Aggiungi, modifica e consulta i dipendenti')

sectionHead('Lista dipendenti')
para('La pagina Dipendenti mostra la lista di tutti i dipendenti dell\'azienda con nome, cognome e stato odierno. Da qui puoi:')
bullet('Aggiungere un nuovo dipendente con il pulsante + Aggiungi dipendente.')
bullet('Cliccare sul nome di un dipendente per aprire la sua scheda dettaglio.')
bullet('Eliminare un dipendente (le sue presenze storiche vengono mantenute).')

sectionHead('Aggiungere un dipendente')
step(1, 'Clicca "+ Aggiungi dipendente"', 'si apre il form di creazione.')
step(2, 'Inserisci i dati', 'nome, cognome, e opzionalmente email e telefono.')
step(3, 'Salva', 'il dipendente appare subito nella lista.')

infoBox('Dopo aver aggiunto il dipendente, devi associargli un badge NFC dalla sezione Badge per permettergli di timbrare. Vedi Sezione 5.')


// ═══════════════════════════════════════════════════════════
// SEZIONE 4 — STORICO PRESENZE
// ═══════════════════════════════════════════════════════════
newSection('Sezione 4 · Storico presenze e scheda dipendente', 'Tutti i dettagli delle timbrature')

sectionHead('Aprire la scheda di un dipendente')
para('Clicca sul nome di un dipendente nella lista. Si apre la scheda con il riepilogo mensile delle presenze.')

sectionHead('Navigazione tra i mesi')
bullet('Usa le frecce ‹ e › in alto per spostarti tra i mesi precedenti e successivi.')
bullet('Il mese corrente è selezionato di default all\'apertura della scheda.')

sectionHead('Tabella giornaliera')
para('Ogni giorno del mese occupa una riga nella tabella. Per ogni giorno vedi:')
kv('Data',             'Giorno della settimana e data in formato GG/MM.')
kv('Coppie entrata/uscita', 'Gli orari di entrata e uscita registrati. Se il dipendente è entrato e uscito più volte, vengono mostrate più coppie.')
kv('Ore lavorate',     'Il totale delle ore lavorate quel giorno, calcolato in automatico.')
kv('Ferie / Permesso', 'Se il giorno è coperto da una richiesta approvata, appare l\'etichetta corrispondente.')

sectionHead('Timbrature manuali')
para('Le timbrature aggiunte manualmente dal titolare (senza passare dal lettore) sono evidenziate in colore ambra con l\'icona della matita, e mostrano il suffisso (M) nei report di export.')

sectionHead('Export mensile')
bullet('Clicca PDF per scaricare il report del mese come file PDF stampabile.')
bullet('Clicca Excel per scaricare il foglio di calcolo con tutti i dati del mese.')
bullet('I file vengono scaricati automaticamente sul tuo dispositivo.')

infoBox('I report di export riportano: data, orari di entrata e uscita per ogni coppia, ore giornaliere e il totale mensile. Le timbrature manuali sono indicate con (M).')

sectionHead('Timbrature manuali — aggiungere ed eliminare')
para('Quando il portale dipendenti è disattivato, il titolare può correggere le presenze manualmente.')
step(1, 'Aggiungi timbratura', 'Clicca il pulsante + in fondo alla riga del giorno desiderato, oppure usa il pulsante + Timbratura nell\'header della sezione storico.')
step(2, 'Compila il form', 'Seleziona data, ora e tipo (ENTRATA o USCITA), poi clicca Salva.')
step(3, 'Elimina timbratura', 'Accanto a ogni timbratura manuale appare una X rossa. Clicca per eliminarla. Le timbrature del lettore NFC non possono essere eliminate.')


// ═══════════════════════════════════════════════════════════
// SEZIONE 5 — BADGE NFC
// ═══════════════════════════════════════════════════════════
newSection('Sezione 5 · Badge NFC', 'Associa i badge fisici ai dipendenti')

sectionHead('Come funziona l\'associazione')
para('Prima che un dipendente possa timbrare, il suo badge fisico deve essere collegato al suo profilo nel sistema. Questa operazione si fa una sola volta per ogni badge.')

step(1, 'Avvicina il badge al lettore', 'Il lettore NFC legge il badge e invia l\'UID al server. Sul sito, nella sezione Badge, appare in tempo reale il messaggio "Badge rilevato: XXXXXXXX".')
step(2, 'Seleziona il dipendente', 'Dall\'elenco a tendina scegli a quale dipendente vuoi associare il badge appena letto.')
step(3, 'Clicca Associa', 'Il badge è ora collegato. Il dipendente può subito cominciare a timbrare.')

sectionHead('Badge già associati')
para('La sezione mostra la lista di tutti i badge già associati con: dipendente, UID del badge e data di associazione. Puoi de-associare un badge in qualsiasi momento cliccando sull\'icona del cestino.')

sectionHead('Account portale dipendente')
para('Se il portale dipendenti è attivo, da questa stessa sezione puoi creare le credenziali di accesso al portale per ogni dipendente:')
bullet('Clicca su Crea account accanto al dipendente.')
bullet('Inserisci username e password. Le credenziali vengono inviate via email al dipendente.')
bullet('Il dipendente potrà accedere al portale personale con quelle credenziali.')


// ═══════════════════════════════════════════════════════════
// SEZIONE 6 — LETTORI NFC
// ═══════════════════════════════════════════════════════════
newSection('Sezione 6 · Lettori NFC', 'Monitoraggio dei dispositivi fisici')

sectionHead('Lista lettori')
para('La sezione Lettori NFC mostra tutti i dispositivi fisici collegati all\'azienda. Per ogni lettore vengono mostrati:')
kv('Reader ID',       'Il nome identificativo del lettore, configurato durante il setup del dispositivo.')
kv('Stato',           'ONLINE (verde) se il lettore ha fatto il ping negli ultimi 5 minuti, OFFLINE (rosso) altrimenti.')
kv('Ultimo ping',     'Data e ora dell\'ultimo segnale ricevuto dal lettore.')
kv('Versione firmware', 'La versione del software installata sul dispositivo.')

sectionHead('Cosa fare se un lettore è offline')
bullet('Verifica che il lettore sia acceso e connesso alla rete WiFi aziendale.')
bullet('Controlla che il cavo di alimentazione sia inserito correttamente.')
bullet('Se il lettore mostra "OFFLINE" sullo schermo, attendi il ricollegamento automatico (il dispositivo riprova ogni 10 secondi).')
bullet('Se il problema persiste, riavvia il lettore staccando e riattaccando l\'alimentazione.')


// ═══════════════════════════════════════════════════════════
// SEZIONE 7 — FASCE ORARIE
// ═══════════════════════════════════════════════════════════
newSection('Sezione 7 · Fasce orarie', 'Definisci quando una timbratura è ENTRATA o USCITA')

sectionHead('Cosa sono le fasce orarie')
para('Le fasce orarie indicano al sistema in quali orari del giorno una timbratura deve essere contata come ENTRATA o come USCITA. Senza fasce, il sistema alterna automaticamente entrata e uscita per ogni dipendente.')

sectionHead('Esempio pratico')
para('Un\'azienda con turno unico può usare due fasce:')
bullet('Mattina  07:30 – 09:30  tipo ENTRATA  →  chi timbra in questa finestra entra.')
bullet('Pomeriggio  17:00 – 19:00  tipo USCITA  →  chi timbra in questa finestra esce.')
para('Un\'azienda con doppio turno può aggiungere fasce aggiuntive per coprire tutti gli orari.')

sectionHead('Aggiungere una fascia oraria')
step(1, 'Vai su Fasce orarie', '(o dalla scheda azienda nel pannello superadmin).')
step(2, 'Clicca + Nuova fascia', 'si apre il form.')
step(3, 'Compila i campi', 'Nome opzionale, ora inizio, ora fine, tipo ENTRATA o USCITA.')
step(4, 'Salva', 'la fascia è attiva immediatamente per tutte le timbrature successive.')

infoBox('Se un dipendente timbra due volte nella stessa fascia (es. passa il badge per errore due volte di mattina), il sistema inverte automaticamente il tipo per la seconda lettura.')


// ═══════════════════════════════════════════════════════════
// SEZIONE 8 — RICHIESTE
// ═══════════════════════════════════════════════════════════
newSection('Sezione 8 · Richieste (ferie e permessi)', 'Gestione delle richieste dei dipendenti')

sectionHead('Come arriva una richiesta')
para('Quando il portale dipendenti è attivo, i dipendenti possono inviare richieste di ferie, permessi, malattia o straordinario direttamente dal loro portale personale. Il titolare riceve la notifica tramite il badge rosso sul menu Richieste.')

sectionHead('Gestire le richieste')
para('Nella sezione Richieste vedi l\'elenco di tutte le richieste con: nome del dipendente, tipo di richiesta, periodo, eventuali note del dipendente e stato attuale.')

step(1, 'Leggi la richiesta', 'Clicca sulla richiesta per vedere tutti i dettagli.')
step(2, 'Approva o rifiuta', 'Usa i pulsanti Approva (verde) o Rifiuta (rosso).')
step(3, 'Aggiungi una nota', 'In caso di rifiuto puoi inserire una motivazione che il dipendente riceverà.')

sectionHead('Effetti dell\'approvazione')
bullet('Ferie approvate: il dipendente appare come "in ferie" nella dashboard per il periodo indicato.')
bullet('Permesso approvato: il giorno appare come permesso nelle presenze e nei report.')
bullet('Il dipendente vede lo stato aggiornato nel suo portale.')

infoBox('Le richieste non scadono automaticamente. Se non vengono gestite, rimangono in attesa finché il titolare non prende una decisione.')


// ═══════════════════════════════════════════════════════════
// SEZIONE 9 — PAUSA AZIENDALE
// ═══════════════════════════════════════════════════════════
newSection('Sezione 9 · Pausa aziendale', 'Chiudi l\'azienda per un periodo senza gestire ogni dipendente')

sectionHead('A cosa serve')
para('La pausa aziendale consente di segnare tutti i dipendenti come in ferie per un intervallo di date (es. ferie di agosto, chiusura natalizia), senza dover inserire una richiesta separata per ognuno.')

sectionHead('Creare una pausa aziendale')
step(1, 'Vai su "Pausa aziendale"', 'dal menu di navigazione.')
step(2, 'Clicca "Crea pausa aziendale"', 'si apre il form.')
step(3, 'Inserisci le date e il motivo', 'Data inizio, data fine (es. 01/08 – 25/08) e una descrizione (es. "Ferie estive").')
step(4, 'Conferma', 'La pausa è attiva. Il sistema controlla che non si sovrapponga a pause già esistenti.')

sectionHead('Cosa succede durante la pausa')
bullet('Nella dashboard tutti i dipendenti compaiono nella colonna "In ferie" per i giorni della pausa.')
bullet('I report mensili riportano i giorni come ferie aziendali.')
bullet('Il portale dipendenti mostra la notifica della pausa nella loro dashboard.')

sectionHead('Annullare una pausa')
para('Se hai creato una pausa per errore o la situazione è cambiata, puoi annullarla in qualsiasi momento:')
bullet('Nella pagina Pausa aziendale, se c\'è una pausa attiva, compare il riquadro verde con i dettagli.')
bullet('Clicca il pulsante rosso Annulla pausa.')
bullet('La pausa viene disattivata immediatamente.')


// ═══════════════════════════════════════════════════════════
// SEZIONE 10 — PORTALE DIPENDENTE
// ═══════════════════════════════════════════════════════════
newSection('Sezione 10 · Portale dipendente', 'Cosa vede e cosa può fare il dipendente')

sectionHead('Accesso al portale')
para('Il dipendente riceve dal titolare uno username e una password con cui accede allo stesso sito del titolare. Il sistema riconosce il ruolo e mostra l\'interfaccia ridotta del portale dipendente.')

sectionHead('Dashboard personale')
para('La prima schermata mostra il riepilogo del mese in corso:')
bullet('Ore lavorate questo mese: il totale aggiornato ad oggi.')
bullet('Giorni presenti: quante volte ha timbrato.')
bullet('Giorni di ferie utilizzati: richieste ferie approvate nel mese.')
bullet('Ultima timbratura: data e tipo dell\'ultima rilevazione del suo badge.')

sectionHead('Storico presenze')
para('Il dipendente può consultare il proprio storico delle presenze mese per mese:')
bullet('Usa le frecce ‹ › per navigare tra i mesi.')
bullet('Ogni riga mostra: data, orario di entrata, orario di uscita, ore lavorate.')
bullet('I giorni festivi o di ferie sono evidenziati in modo diverso.')

infoBox('Il dipendente può solo consultare le sue presenze, non modificarle. Qualsiasi correzione deve essere richiesta al titolare.')

sectionHead('Inviare una richiesta')
para('Il dipendente può inviare richieste di assenza direttamente dal portale senza dover contattare il titolare:')
step(1, 'Vai su "Richieste"', 'dal menu del portale.')
step(2, 'Clicca "Nuova richiesta"', 'si apre il form di richiesta.')
step(3, 'Scegli il tipo', 'Ferie, Permesso, Malattia o Straordinario.')
step(4, 'Inserisci le date', 'Data di inizio e data di fine del periodo richiesto.')
step(5, 'Aggiungi note (opzionale)', 'Puoi inserire una motivazione o una nota per il titolare.')
step(6, 'Invia', 'La richiesta viene inviata al titolare. Riceverai una notifica quando verrà gestita.')

sectionHead('Stato delle richieste')
para('Nella sezione Richieste il dipendente vede tutte le sue richieste con il relativo stato:')
kv('In attesa',   'Il titolare non ha ancora risposto.')
kv('Approvata',   'Il titolare ha approvato la richiesta. Il periodo apparirà come ferie/permesso nelle presenze.')
kv('Rifiutata',   'Il titolare ha rifiutato la richiesta, eventualmente con una motivazione.')


// ── FOOTER SU TUTTE LE PAGINE (esclusa copertina) ─────────
const range = doc.bufferedPageRange()
for (let i = 1; i < range.count; i++) {
  doc.switchToPage(range.start + i)
  const fy = H - 28
  hRule(fy - 4, '#cccccc')
  doc.fillColor('#aaaaaa').font('Helvetica').fontSize(8)
     .text('Timbry · Guida all\'utilizzo', ML, fy, { width: TW / 2 })
  doc.fillColor(TIMBRY).font('Helvetica-Bold').fontSize(8)
     .text('Pagina ' + i + ' di ' + (range.count - 1), ML, fy, { width: TW, align: 'right' })
}

doc.end()
doc.on('end', () => console.log('PDF generato: ' + OUT))
