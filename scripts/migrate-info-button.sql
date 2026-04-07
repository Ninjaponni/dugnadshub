-- Legg til kontakttelefon for dugnadsansvarlig på events
ALTER TABLE public.events ADD COLUMN contact_phone text DEFAULT NULL;
