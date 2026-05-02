-- 17 nye merker: 9 styret + 5 komite + 3 vakt (id 45-61)
-- Foreign key fra user_badges.badge_id krever at radene finnes i badges-tabellen

-- Utvid category-CHECK med tre nye verdier
ALTER TABLE badges DROP CONSTRAINT IF EXISTS badges_category_check;
ALTER TABLE badges ADD CONSTRAINT badges_category_check
  CHECK (category IN ('starter', 'vanlig', 'veteran', 'elite', 'aktivitet', '17mai', 'styret', 'komite', 'vakt'));

INSERT INTO badges (id, name, description, icon, category, auto_criteria) VALUES
  (45, 'Leder',                  'Korpsleder',                                              '/badges/leder.png',                       'styret', NULL),
  (46, 'Nestleder',               'Nestleder i styret',                                     '/badges/nestleder.png',                   'styret', NULL),
  (47, 'Sekretær',                'Skriver møtereferater og holder orden',                  '/badges/sekretaer.png',                   'styret', NULL),
  (48, 'Kasserer',                'Holder orden på korpsets økonomi',                       '/badges/kasserer.png',                    'styret', NULL),
  (49, 'Styremedlem',             'Sitter i korpsstyret',                                   '/badges/styremedlem.png',                 'styret', NULL),
  (50, 'Varamedlem',              'Vara i korpsstyret',                                     '/badges/varamedlem.png',                  'styret', NULL),
  (51, 'Materialforvalter',       'Tar vare på uniformer, noter og annet utstyr',           '/badges/materialforvalter.png',           'styret', NULL),
  (52, 'Instrumentansvarlig',     'Holder orden på instrumentparken',                       '/badges/instrumentansvarlig.png',         'styret', NULL),
  (53, 'Dugnadsansvarlig',        'Koordinerer korpsets dugnader',                          '/badges/dugnadsansvarlig.png',            'styret', NULL),
  (54, 'Uniformskomiteen',        'Sittet i uniformskomiteen',                              '/badges/uniformskomiteen.png',            'komite', NULL),
  (55, 'Valgkomiteen',            'Sittet i valgkomiteen',                                  '/badges/valgkomiteen.png',                'komite', NULL),
  (56, 'Turkomiteen',             'Sittet i turkomiteen',                                   '/badges/turkomiteen.png',                 'komite', NULL),
  (57, 'Steinkjerspællkomiteen',  'Sittet i steinkjerspællkomiteen',                        '/badges/steinkjerspaellkomiteen.png',     'komite', NULL),
  (58, '17. mai-komiteen',        'Sittet i 17. mai-komiteen',                              '/badges/17mai-komiteen.png',              'komite', NULL),
  (59, 'Styrevakta',              'Hadde styrevakt på øvelseskvelder',                      '/badges/styrevakta.png',                  'vakt',   NULL),
  (60, 'Korpsvakten',             'Hadde foreldrevakt under øvelse (AK/JK/HK)',             '/badges/korpsvakten.png',                 'vakt',   NULL),
  (61, 'Vaffelvakta',             'Stekte vafler på vaffeltorsdag',                         '/badges/vaffelvakta.png',                 'vakt',   NULL)
ON CONFLICT (id) DO NOTHING;

NOTIFY pgrst, 'reload schema';
