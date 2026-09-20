-- Legg til program JSONB for arrangement-events (eks. helgeprogram på korpsseminar)
-- Idempotent og additiv: nullable kolonne, påvirker ingen eksisterende rader.
-- Format: [{ "date": "YYYY-MM-DD", "label": "Fredag", "items": [{ "time": "18:00", "hk": "...", "jk": "...", "note": "..." }] }]
ALTER TABLE events ADD COLUMN IF NOT EXISTS program jsonb;
NOTIFY pgrst, 'reload schema';
