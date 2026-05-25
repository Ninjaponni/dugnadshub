ALTER TABLE events ADD COLUMN IF NOT EXISTS arranger_name text;
NOTIFY pgrst, 'reload schema';
