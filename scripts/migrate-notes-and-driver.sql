-- Sjåfør-notater per hendelse (admin fyller inn leveringsadresse osv.)
ALTER TABLE events ADD COLUMN driver_notes TEXT DEFAULT NULL;

-- Fritekst-notater per claim (barn, kommentarer)
ALTER TABLE zone_claims ADD COLUMN notes TEXT DEFAULT NULL;
