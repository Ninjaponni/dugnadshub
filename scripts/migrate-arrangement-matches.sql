-- Legg til matches JSONB for arrangement-events (eks. VM-kamper)
ALTER TABLE events ADD COLUMN IF NOT EXISTS matches jsonb;
NOTIFY pgrst, 'reload schema';
