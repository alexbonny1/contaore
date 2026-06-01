SELECT table_name, column_name
FROM information_schema.columns
WHERE table_name IN ('turni', 'presenza', 'dipendenti', 'tag', 'richieste_timbratura')
ORDER BY table_name, ordinal_position;
