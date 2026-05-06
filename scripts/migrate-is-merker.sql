-- Israider (63) og Isflytter (64) — to nye aktivitetsmerker
-- Kan tildeles flere ganger (vises som ×N)

INSERT INTO badges (id, name, description, icon, category, auto_criteria) VALUES
  (63, 'Israider',  'Tømme butikkene for is',  '/badges/israider.png',  'aktivitet', NULL),
  (64, 'Isflytter', 'Flytte is fra A til B',   '/badges/isflytter.png', 'aktivitet', NULL)
ON CONFLICT (id) DO NOTHING;

-- Tildel Israider til Aina Nesmoen og Isflytter til Daniel Montera
INSERT INTO user_badges (user_id, badge_id)
SELECT id, 63 FROM profiles WHERE full_name ILIKE 'Aina Nesmoen';

INSERT INTO user_badges (user_id, badge_id)
SELECT id, 64 FROM profiles WHERE full_name ILIKE 'Daniel Montera';

NOTIFY pgrst, 'reload schema';
