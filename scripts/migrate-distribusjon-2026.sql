-- Distribusjon og innsamling 2026 — nytt Lagersjef-merke + tildelinger
-- Kjøres etter migrate-is-merker.sql (som registrerer Israider/Isflytter)

-- Nytt merke: Lagersjef (id 65) — styret-merke for lageransvar
INSERT INTO badges (id, name, description, icon, category, auto_criteria) VALUES
  (65, 'Lagersjef',
       'Holder orden på Rosten-lageret — kasser, isoporbokser og at alt kommer på plass igjen',
       '/badges/lagersjef.png', 'styret', NULL)
ON CONFLICT (id) DO NOTHING;

-- Tildelinger basert på distribusjonslogistikk-listen for 2026
-- Bruker ILIKE for å være tolerant for små stavevarianter

-- Egil Eide → Lagersjef (id 65)
INSERT INTO user_badges (user_id, badge_id)
SELECT id, 65 FROM profiles WHERE full_name ILIKE 'Egil Eide';

-- Esten Bollingmo → Tilhengerhelten (id 38)
INSERT INTO user_badges (user_id, badge_id)
SELECT id, 38 FROM profiles WHERE full_name ILIKE 'Esten Bollingmo';

-- Irun Walberg → Innkjøpsansvarlig (id 62)
INSERT INTO user_badges (user_id, badge_id)
SELECT id, 62 FROM profiles WHERE full_name ILIKE 'Irun Walberg';

-- Kjøkkenansvarlige → Kjøkkengeneral (id 32)
INSERT INTO user_badges (user_id, badge_id)
SELECT id, 32 FROM profiles WHERE full_name ILIKE 'Karna Løberg';

INSERT INTO user_badges (user_id, badge_id)
SELECT id, 32 FROM profiles WHERE full_name ILIKE 'Kine Halgunset';

INSERT INTO user_badges (user_id, badge_id)
SELECT id, 32 FROM profiles WHERE full_name ILIKE 'Øystein Andres Krogsæter';

NOTIFY pgrst, 'reload schema';
