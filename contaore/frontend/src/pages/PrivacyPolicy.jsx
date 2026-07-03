import { Link } from "react-router-dom";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-zinc-100 dark:bg-[#0f0f10] py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6">
          <Link to="/" className="text-sm text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition">
            ← Torna al login
          </Link>
        </div>
        <div className="bg-white dark:bg-[#161618] rounded-3xl border border-zinc-200 dark:border-zinc-800 p-6 sm:p-10">
          <h1 className="text-2xl sm:text-3xl font-semibold text-zinc-900 dark:text-zinc-100 mb-1">
            Informativa Privacy
          </h1>
          <p className="text-xs sm:text-sm text-zinc-400 mb-8">
            Ai sensi dell’art. 13 Reg. UE 2016/679 (GDPR) — Aggiornamento: giugno 2025
          </p>

          <Sec title="1. Titolare e Responsabile del trattamento">
            <P>
              Il servizio Timbry è fornito da <strong>[RAGIONE SOCIALE TIMBRY]</strong>, sede legale in
              [INDIRIZZO], P.IVA [PARTITA IVA], e-mail:{" "}
              <a href="mailto:privacy@timbry.site" className="underline text-zinc-700 dark:text-zinc-300">
                privacy@timbry.site
              </a>.
            </P>
            <P>Ai sensi del GDPR, i ruoli sono così distribuiti:</P>
            <ul className="list-disc pl-5 space-y-1 mb-3 text-sm text-zinc-600 dark:text-zinc-400">
              <li>
                <strong>Azienda cliente</strong> = <strong>Titolare del trattamento</strong> dei dati dei
                propri dipendenti (art. 4 n. 7 GDPR)
              </li>
              <li>
                <strong>Timbry</strong> = <strong>Responsabile del trattamento</strong> (art. 28 GDPR),
                che tratta i dati per conto e su istruzione del Titolare
              </li>
              <li>
                Per i dati dell’account utente (owner/manager), Timbry agisce come Titolare autonomo
              </li>
            </ul>
          </Sec>

          <Sec title="2. Dati trattati e finalità">
            <P>
              <strong>Account utente (owner/manager):</strong> username, indirizzo e-mail, password in
              forma cifrata (bcrypt). Base giuridica: esecuzione del contratto di servizio (art. 6(1)(b)
              GDPR).
            </P>
            <P>
              <strong>Dati dipendenti (trattati per conto del Titolare):</strong> nome, cognome, e-mail
              (facoltativa), UID badge NFC, timestamp di entrata/uscita, stato presenze, giorni di ferie
              e permessi. Base giuridica del Titolare: adempimento del contratto di lavoro e obblighi di
              legge in materia di rilevazione presenze (artt. 6(1)(b)(c) GDPR; art. 4 L. 300/1970 come
              modificato dal D.Lgs. 151/2015).
            </P>
            <P>
              <strong>Dati di utilizzo/analitici (solo con consenso):</strong> pagine visitate, azioni
              compiute nell'app (es. accesso, creazione di un dipendente, approvazione o rifiuto di una
              richiesta) e registrazione della sessione (con i campi di testo oscurati), raccolti tramite
              PostHog esclusivamente se l'utente presta consenso dal banner mostrato al primo accesso.
              Base giuridica: consenso (art. 6(1)(a) GDPR).
            </P>
          </Sec>

          <Sec title="3. Cookie e archiviazione locale">
            <P>
              La piattaforma Timbry <strong>non utilizza cookie HTTP</strong> di profilazione o di terze
              parti. Utilizza il <strong>localStorage</strong> del browser per conservare il token JWT di
              autenticazione e le preferenze di tema (archiviazione tecnica, non accessibile a server o
              terze parti), e — solo se l'utente acconsente dal banner dei cookie — <strong>PostHog</strong>,
              uno strumento di analisi dell'utilizzo dell'app con server in UE. Per dettagli:{" "}
              <Link to="/cookie-policy" className="underline text-zinc-700 dark:text-zinc-300">
                Cookie Policy
              </Link>.
            </P>
          </Sec>

          <Sec title="4. Sub-responsabili del trattamento">
            <ul className="list-disc pl-5 space-y-1 mb-3 text-sm text-zinc-600 dark:text-zinc-400">
              <li>
                <strong>Supabase Inc.</strong> — database PostgreSQL e storage; infrastruttura in data
                center UE (Francoforte, Germania)
              </li>
              <li>
                <strong>Resend</strong> — invio credenziali di accesso e notifiche via e-mail ai
                dipendenti
              </li>
              <li>
                <strong>Twilio Inc.</strong> — invio del codice di verifica via SMS/WhatsApp per
                l'autenticazione a due fattori (2FA)
              </li>
              <li>
                <strong>PostHog</strong> — analisi dell'utilizzo della piattaforma (pagine visitate,
                eventi, registrazione sessione); infrastruttura in UE; attivo solo con consenso
                dell'utente
              </li>
              <li>
                <strong>Sentry</strong> — monitoraggio tecnico degli errori dell'applicazione (frontend e
                backend), per individuare e correggere malfunzionamenti
              </li>
            </ul>
            <P>Ogni sub-responsabile è vincolato da apposito DPA conforme all’art. 28 GDPR.</P>
          </Sec>

          <Sec title="5. Trasferimenti extra-UE">
            <P>
              Eventuali trasferimenti verso Paesi extra-SEE avvengono sulla base di garanzie adeguate:
              Clausole Contrattuali Standard (art. 46 GDPR) o decisioni di adeguatezza della Commissione
              Europea (es. EU-U.S. Data Privacy Framework per gli USA).
            </P>
          </Sec>

          <Sec title="6. Conservazione dei dati">
            <P>
              <strong>Dati account:</strong> per la durata del contratto di servizio + 12 mesi dalla
              cessazione.
            </P>
            <P>
              <strong>Dati presenze dipendenti:</strong> secondo le istruzioni del Titolare e comunque
              non oltre i termini previsti dalla normativa lavoristica italiana (max 5 anni dalla
              registrazione, salvo obblighi specifici di legge).
            </P>
          </Sec>

          <Sec title="7. Diritti dell’interessato">
            <P>
              In qualità di interessato (dipendente o utente), puoi esercitare i diritti di cui agli
              artt. 15–22 GDPR (accesso, rettifica, cancellazione, limitazione, portabilità, opposizione)
              inviando richiesta:
            </P>
            <ul className="list-disc pl-5 space-y-1 mb-3 text-sm text-zinc-600 dark:text-zinc-400">
              <li>
                Al proprio <strong>datore di lavoro (Titolare)</strong> per i dati di presenze e badge
              </li>
              <li>
                A <strong>Timbry</strong> (
                <a
                  href="mailto:privacy@timbry.site"
                  className="underline text-zinc-700 dark:text-zinc-300"
                >
                  privacy@timbry.site
                </a>
                ) per i dati dell’account di accesso
              </li>
            </ul>
            <P>
              Puoi proporre reclamo al{" "}
              <strong>Garante per la protezione dei dati personali</strong> (
              <a
                href="https://www.garanteprivacy.it"
                target="_blank"
                rel="noopener noreferrer"
                className="underline text-zinc-700 dark:text-zinc-300"
              >
                www.garanteprivacy.it
              </a>
              ), Piazza Venezia 11, 00187 Roma.
            </P>
          </Sec>

          <div className="mt-8 pt-6 border-t border-zinc-100 dark:border-zinc-800 flex flex-wrap gap-4 text-xs sm:text-sm text-zinc-400">
            <Link to="/cookie-policy" className="hover:text-zinc-600 dark:hover:text-zinc-200 transition">
              Cookie Policy
            </Link>
            <span>·</span>
            <span>© 2025 Timbry</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function Sec({ title, children }) {
  return (
    <div className="mb-6">
      <h2 className="text-sm sm:text-base font-semibold text-zinc-800 dark:text-zinc-200 mb-2 pb-2 border-b border-zinc-100 dark:border-zinc-800">
        {title}
      </h2>
      {children}
    </div>
  );
}

function P({ children }) {
  return (
    <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed mb-2">{children}</p>
  );
}
