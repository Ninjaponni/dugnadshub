-- Opprydding etter migrate-is-merker.sql + migrate-distribusjon-2026.sql
-- 1) Fjerner duplikate tildelinger (kun behold eldste per (user_id, badge_id))
-- 2) Legger til de tre tildelingene som manglet pga avvikende fulle navn

-- ============================================================
-- 1. Fjern duplikate tildelinger for Aina (id 63) og Irun (id 62)
-- ============================================================

WITH duplikater AS (
  SELECT id,
         ROW_NUMBER() OVER (PARTITION BY user_id, badge_id ORDER BY awarded_at) AS rn
  FROM user_badges
  WHERE badge_id IN (62, 63)
)
DELETE FROM user_badges
WHERE id IN (SELECT id FROM duplikater WHERE rn > 1);

-- ============================================================
-- 2. Manglende tildelinger (riktige fulle navn fra databasen)
-- NOT EXISTS sikrer at re-kjøring ikke gir duplikater
-- ============================================================

-- Daniel Carocca Montero → Isflytter (id 64)
INSERT INTO user_badges (user_id, badge_id)
SELECT p.id, 64
FROM profiles p
WHERE p.full_name = 'Daniel Carocca Montero'
  AND NOT EXISTS (
    SELECT 1 FROM user_badges ub
    WHERE ub.user_id = p.id AND ub.badge_id = 64
  );

-- Esten Kotsbakk Bollingmo → Tilhengerhelten (id 38)
INSERT INTO user_badges (user_id, badge_id)
SELECT p.id, 38
FROM profiles p
WHERE p.full_name = 'Esten Kotsbakk Bollingmo'
  AND NOT EXISTS (
    SELECT 1 FROM user_badges ub
    WHERE ub.user_id = p.id AND ub.badge_id = 38
  );

-- Egil Sverre Eide → Lagersjef (id 65)
INSERT INTO user_badges (user_id, badge_id)
SELECT p.id, 65
FROM profiles p
WHERE p.full_name = 'Egil Sverre Eide'
  AND NOT EXISTS (
    SELECT 1 FROM user_badges ub
    WHERE ub.user_id = p.id AND ub.badge_id = 65
  );

NOTIFY pgrst, 'reload schema';
