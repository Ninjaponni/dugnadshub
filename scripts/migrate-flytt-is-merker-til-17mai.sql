-- Flytt Israider (63), Isflytter (64) og Lagersjef (65) til 17mai-kategorien
-- Disse merkene tilhører 17. mai-distribusjonsteamet og passer bedre der

UPDATE badges SET category = '17mai' WHERE id IN (63, 64, 65);

NOTIFY pgrst, 'reload schema';
