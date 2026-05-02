-- 17. mai-merker (id 29-42)
-- Foreign key fra user_badges.badge_id krever at radene finnes i badges-tabellen
-- Idempotent: ON CONFLICT DO NOTHING

-- Utvid category-CHECK med ny verdi '17mai'
ALTER TABLE badges DROP CONSTRAINT IF EXISTS badges_category_check;
ALTER TABLE badges ADD CONSTRAINT badges_category_check
  CHECK (category IN ('starter', 'vanlig', 'veteran', 'elite', 'aktivitet', '17mai'));

INSERT INTO badges (id, name, description, icon, category, auto_criteria) VALUES
  (29, 'Hurra-helten',     'Bidro på korpsets 17. mai-dugnad',                        '/badges/hurra-helten.png',    '17mai', NULL),
  (30, 'Festkakebaker',    'Bakte og leverte kake til 17. mai',                       '/badges/festkakebaker.png',   '17mai', NULL),
  (31, 'Kioskløve',        'Bemannet kiosk på 17. mai',                               '/badges/kiosklove.png',       '17mai', NULL),
  (32, 'Kjøkkengeneral',   'Sto i kjøkkenet og holdt hjulene i gang',                 '/badges/kjokkengeneral.png',  '17mai', NULL),
  (33, 'Riggemester',      'Rigget skolen kvelden før 17. mai',                       '/badges/riggemester.png',     '17mai', NULL),
  (34, 'Ryddesjef',        'Ryddet og vasket etter endt dugnad',                      '/badges/ryddesjef.png',       '17mai', NULL),
  (35, 'Springer',         'Sprang mellom kiosk og kjøkken med påfyll',               '/badges/springer.png',        '17mai', NULL),
  (36, 'Skolesjefen',      'Var skoleansvarlig på sin skole',                         '/badges/skolesjefen.png',     '17mai', NULL),
  (37, 'Vareherre',        'Sørget for innkjøp og distribusjon',                      '/badges/vareherre.png',       '17mai', NULL),
  (38, 'Tilhengerhelten',  'Kjørte henger fullastet med varer',                       '/badges/tilhengerhelten.png', '17mai', NULL),
  (39, 'Togsjef',          'Ledet barnetoget på 17. mai',                             '/badges/togsjef.png',         '17mai', NULL),
  (40, 'Fanebærer',        'Bar fanen i 17. mai-toget',                               '/badges/fanebaerer.png',      '17mai', NULL),
  (41, 'Pakkemester',      'Pakket varer på pakkedugnaden',                           '/badges/pakkemester.png',     '17mai', NULL),
  (42, 'Portøren',         'Sørget for trygg frakt av brus uten å bryte plasten',     '/badges/portor.png',          '17mai',     NULL),
  -- Konfirmasjonsspilling og innhopp (aktivitet, kan stables)
  (43, 'Konfirmasjonsfaneren', 'Bar fanen på konfirmasjonsspilling',                   '/badges/konfirmasjonsfaneren.png', 'aktivitet', NULL),
  (44, 'Stortrommeren',    'Steppet inn og spilte stortromma',                        '/badges/stortrommeren.png',   'aktivitet', NULL)
ON CONFLICT (id) DO NOTHING;

-- Reload schema cache så PostgREST oppdager evt. nye kategori-verdier
NOTIFY pgrst, 'reload schema';
