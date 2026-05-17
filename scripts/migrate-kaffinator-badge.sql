-- Kaffinator (id 66) — 17.mai-merke for de som tok med kaffe
INSERT INTO badges (id, name, description, icon, category, auto_criteria) VALUES
  (66, 'Kaffinator', 'Tok med kaffekanner og termoser til 17. mai-dugnaden', '/badges/kaffinator.png', '17mai', NULL)
ON CONFLICT (id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
