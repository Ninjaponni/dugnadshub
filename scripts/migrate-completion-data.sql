-- Legg til sekker og notater ved fullføring av hendelse
ALTER TABLE public.events ADD COLUMN bags_collected integer DEFAULT NULL;
ALTER TABLE public.events ADD COLUMN completion_notes text DEFAULT NULL;
