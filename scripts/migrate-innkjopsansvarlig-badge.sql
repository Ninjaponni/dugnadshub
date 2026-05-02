-- Innkjøpsansvarlig (id 62) — styret-merke som ble glemt i forrige migrasjon
INSERT INTO badges (id, name, description, icon, category, auto_criteria) VALUES
  (62, 'Innkjøpsansvarlig', 'Sørger for at korpset har alt det trenger — kaffe, is, saft, servietter', '/badges/innkjopsansvarlig.png', 'styret', NULL)
ON CONFLICT (id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
