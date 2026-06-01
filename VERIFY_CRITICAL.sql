-- TURNI structure
SELECT 'TURNI' as table_name, column_name FROM information_schema.columns
WHERE table_name = 'turni' ORDER BY ordinal_position;

-- PRESENZA structure
SELECT 'PRESENZA' as table_name, column_name FROM information_schema.columns
WHERE table_name = 'presenza' ORDER BY ordinal_position;

-- DIPENDENTI structure
SELECT 'DIPENDENTI' as table_name, column_name FROM information_schema.columns
WHERE table_name = 'dipendenti' ORDER BY ordinal_position;

-- TAG structure
SELECT 'TAG' as table_name, column_name FROM information_schema.columns
WHERE table_name = 'tag' ORDER BY ordinal_position;

-- Verifica constraints su PRESENZA
SELECT constraint_name, constraint_type FROM information_schema.table_constraints
WHERE table_name = 'presenza';

-- Verifica constraints su TURNI
SELECT constraint_name, constraint_type FROM information_schema.table_constraints
WHERE table_name = 'turni';

-- Verifica constraints su RICHIESTE_TIMBRATURA
SELECT constraint_name, constraint_type FROM information_schema.table_constraints
WHERE table_name = 'richieste_timbratura';
