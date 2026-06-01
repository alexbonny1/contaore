-- TURNI
SELECT 'TURNI', column_name FROM information_schema.columns
WHERE table_name = 'turni' ORDER BY ordinal_position;

-- PRESENZA
SELECT 'PRESENZA', column_name FROM information_schema.columns
WHERE table_name = 'presenza' ORDER BY ordinal_position;

-- DIPENDENTI
SELECT 'DIPENDENTI', column_name FROM information_schema.columns
WHERE table_name = 'dipendenti' ORDER BY ordinal_position;

-- TAG
SELECT 'TAG', column_name FROM information_schema.columns
WHERE table_name = 'tag' ORDER BY ordinal_position;

-- RICHIESTE_TIMBRATURA
SELECT 'RICHIESTE_TIMBRATURA', column_name FROM information_schema.columns
WHERE table_name = 'richieste_timbratura' ORDER BY ordinal_position;

-- RICHIESTE_FERIE
SELECT 'RICHIESTE_FERIE', column_name FROM information_schema.columns
WHERE table_name = 'richieste_ferie' ORDER BY ordinal_position;
