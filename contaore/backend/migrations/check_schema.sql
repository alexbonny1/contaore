-- Script diagnostico (da eseguire manualmente in Supabase Studio -> SQL Editor)
-- Non fa parte delle migration automatiche: mostra solo lo stato attuale del DB,
-- confrontandolo con tutto ciò che runMigrations.js prova a creare/aggiungere.
-- Non modifica nulla: sola lettura.

WITH checks(categoria, oggetto, tipo) AS (
  VALUES
    -- Funzione usata da tutte le migration automatiche: se manca, TUTTE falliscono in silenzio
    ('0. Funzione', 'exec()', 'function'),

    -- Tabelle create dallo schema iniziale
    ('1. Tabelle base', 'company', 'table'),
    ('1. Tabelle base', 'dipendenti', 'table'),
    ('1. Tabelle base', 'user_account', 'table'),
    ('1. Tabelle base', 'dispositivo', 'table'),
    ('1. Tabelle base', 'tag', 'table'),
    ('1. Tabelle base', 'turni', 'table'),
    ('1. Tabelle base', 'fasce_orarie', 'table'),
    ('1. Tabelle base', 'presenza', 'table'),
    ('1. Tabelle base', 'richieste_ferie', 'table'),
    ('1. Tabelle base', 'richieste_timbratura', 'table'),
    ('1. Tabelle base', 'giustificazioni', 'table'),
    ('1. Tabelle base', 'pausa_aziendale', 'table'),
    ('1. Tabelle base', 'notifiche_settings', 'table'),
    ('1. Tabelle base', 'ota_release', 'table'),
    ('1. Tabelle base', 'device_claim', 'table'),
    ('1. Tabelle base', 'admin_settings', 'table'),

    -- Tabelle aggiunte da migration successive
    ('2. Tabelle migration', 'two_factor_attempts', 'table'),
    ('2. Tabelle migration', 'two_factor_audit', 'table'),
    ('2. Tabelle migration', 'richieste_permessi', 'table'),
    ('2. Tabelle migration', 'richieste_turni', 'table'),
    ('2. Tabelle migration', 'audit_log', 'table'),
    ('2. Tabelle migration', 'user_sessions', 'table'),
    ('2. Tabelle migration', 'riepilogo_ore_invii', 'table'),

    -- Colonne aggiunte su user_account
    ('3. Colonne user_account', 'user_account.phone_number', 'column'),
    ('3. Colonne user_account', 'user_account.two_factor_enabled', 'column'),
    ('3. Colonne user_account', 'user_account.two_factor_method', 'column'),
    ('3. Colonne user_account', 'user_account.reset_token', 'column'),
    ('3. Colonne user_account', 'user_account.reset_token_expires_at', 'column'),
    ('3. Colonne user_account', 'user_account.is_temporary_credentials', 'column'),
    ('3. Colonne user_account', 'user_account.temporary_credentials_used_at', 'column'),
    ('3. Colonne user_account', 'user_account.nome', 'column'),
    ('3. Colonne user_account', 'user_account.cognome', 'column'),
    ('3. Colonne user_account', 'user_account.password_changed_at', 'column'),
    ('3. Colonne user_account', 'user_account.permissions', 'column'),
    ('3. Colonne user_account', 'user_account.assigned_dipendente_ids', 'column'),

    -- Colonne aggiunte su company
    ('4. Colonne company', 'company.auto_cleanup_enabled', 'column'),
    ('4. Colonne company', 'company.auto_cleanup_retention_months', 'column'),
    ('4. Colonne company', 'company.tolleranza_difetto_minuti', 'column'),
    ('4. Colonne company', 'company.auto_cleanup_giorno', 'column'),
    ('4. Colonne company', 'company.auto_cleanup_last_run', 'column'),

    -- Colonne aggiunte su dispositivo
    ('5. Colonne dispositivo', 'dispositivo.nome', 'column'),
    ('5. Colonne dispositivo', 'dispositivo.firmware_version', 'column'),
    ('5. Colonne dispositivo', 'dispositivo.sede', 'column'),
    ('5. Colonne dispositivo', 'dispositivo.nfc_ok', 'column'),
    ('5. Colonne dispositivo', 'dispositivo.display_ok', 'column'),
    ('5. Colonne dispositivo', 'dispositivo.ota_pending', 'column'),

    -- Colonne aggiunte su dipendenti
    ('6. Colonne dipendenti', 'dipendenti.promemoria_entrata_minuti', 'column'),
    ('6. Colonne dipendenti', 'dipendenti.promemoria_uscita_minuti', 'column'),
    ('6. Colonne dipendenti', 'dipendenti.importo_orario', 'column'),

    -- Notifiche push (web-push / VAPID)
    ('7. Notifiche push', 'push_subscriptions', 'table'),
    ('7. Notifiche push', 'company.notifiche_anche_email', 'column')
)
SELECT
  categoria,
  oggetto,
  CASE
    WHEN tipo = 'function' THEN
      CASE WHEN EXISTS (SELECT 1 FROM pg_proc WHERE proname = replace(oggetto, '()', ''))
        THEN '✅ presente' ELSE '❌ MANCANTE' END
    WHEN tipo = 'table' THEN
      CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = oggetto
      ) THEN '✅ presente' ELSE '❌ MANCANTE' END
    ELSE
      CASE WHEN EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name  = split_part(oggetto, '.', 1)
          AND column_name = split_part(oggetto, '.', 2)
      ) THEN '✅ presente' ELSE '❌ MANCANTE' END
  END AS stato
FROM checks
ORDER BY categoria, oggetto;
