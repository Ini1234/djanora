ALTER TABLE "inspiration_items" ADD COLUMN "categories" "InspirationCategory"[] DEFAULT ARRAY[]::"InspirationCategory"[];

UPDATE "inspiration_items"
SET "categories" = ARRAY["category"]::"InspirationCategory"[]
WHERE cardinality("categories") = 0;

-- Starter Inspiration looks (idempotent on title)

INSERT INTO "inspiration_items" (
  "id", "title", "description", "category", "categories", "tags",
  "location", "price_range_from", "price_range_to", "currency",
  "is_admin_curated", "visibility", "created_at", "updated_at"
)
SELECT
  'seed_abf2522579dc3491db3ef2b7',
  'Igbo Traditional Entrance Dance',
  'A vibrant, high-energy group entrance choreography rooted in Igbo cultural traditions. Features Atilogwu acrobatic dance moves, elaborate uli body art costumes, and live ogene percussion. Perfect for couple entrances or family processions at traditional weddings.',
  'PERFORMANCE'::"InspirationCategory",
  ARRAY['PERFORMANCE']::"InspirationCategory"[],
  ARRAY['igbo', 'atilogwu', 'traditional dance', 'entrance', 'cultural', 'acrobatic', 'ogene', 'nigerian', 'group dance']::TEXT[],
  'Ottawa, ON',
  500,
  1500,
  'CAD',
  true,
  'INSPIRATION'::"InspirationVisibility",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "inspiration_items" WHERE "title" = 'Igbo Traditional Entrance Dance'
);

INSERT INTO "inspiration_items" (
  "id", "title", "description", "category", "categories", "tags",
  "location", "price_range_from", "price_range_to", "currency",
  "is_admin_curated", "visibility", "created_at", "updated_at"
)
SELECT
  'seed_d1f5591805f67b29c47cbf36',
  'Yoruba Àgbò Dance Performance',
  'Elegant and rhythmic Yoruba traditional dance performance for wedding receptions. Dancers dressed in àṣọ-ọkè fabric perform to talking drum (ìyá ìlù) and sekere. Can be choreographed as surprise entrance, first dance alternative, or crowd entertainment.',
  'PERFORMANCE'::"InspirationCategory",
  ARRAY['PERFORMANCE']::"InspirationCategory"[],
  ARRAY['yoruba', 'agbo', 'talking drum', 'aso-oke', 'wedding dance', 'traditional', 'sekere', 'nigerian', 'cultural performance']::TEXT[],
  'Ottawa, ON',
  600,
  2000,
  'CAD',
  true,
  'INSPIRATION'::"InspirationVisibility",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "inspiration_items" WHERE "title" = 'Yoruba Àgbò Dance Performance'
);

INSERT INTO "inspiration_items" (
  "id", "title", "description", "category", "categories", "tags",
  "location", "price_range_from", "price_range_to", "currency",
  "is_admin_curated", "visibility", "created_at", "updated_at"
)
SELECT
  'seed_67c2dd7782348d6e364c7753',
  'Hausa Durbar-Inspired Procession',
  'Majestic ceremonial procession inspired by the Northern Nigerian Durbar festival. Includes costumed riders (or performers on foot), traditional Hausa musicians playing kakaki horns, and elaborately dressed attendants. Creates an unforgettable royal entrance.',
  'PERFORMANCE'::"InspirationCategory",
  ARRAY['PERFORMANCE']::"InspirationCategory"[],
  ARRAY['hausa', 'durbar', 'procession', 'northern nigeria', 'kakaki', 'royal', 'ceremonial', 'entrance', 'cultural']::TEXT[],
  'Ottawa, ON',
  1000,
  3000,
  'CAD',
  true,
  'INSPIRATION'::"InspirationVisibility",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "inspiration_items" WHERE "title" = 'Hausa Durbar-Inspired Procession'
);

INSERT INTO "inspiration_items" (
  "id", "title", "description", "category", "categories", "tags",
  "location", "price_range_from", "price_range_to", "currency",
  "is_admin_curated", "visibility", "created_at", "updated_at"
)
SELECT
  'seed_23535f4718df0de75ab63ab6',
  'Live Afrobeats & Highlife Band',
  'A 6-piece live band specializing in Afrobeats, Highlife, Afro-fusion, and Juju music. Perfect for keeping guests on the dance floor all night. Covers classics from Fela Kuti, Sunny Ade, and contemporary artists like Burna Boy and Wizkid. Available for 4–8 hour sets.',
  'MUSIC'::"InspirationCategory",
  ARRAY['MUSIC']::"InspirationCategory"[],
  ARRAY['live band', 'afrobeats', 'highlife', 'afro-fusion', 'juju', 'fela kuti', 'entertainment', 'dancing', 'nigerian music']::TEXT[],
  'Ottawa, ON',
  2000,
  6000,
  'CAD',
  true,
  'INSPIRATION'::"InspirationVisibility",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "inspiration_items" WHERE "title" = 'Live Afrobeats & Highlife Band'
);

INSERT INTO "inspiration_items" (
  "id", "title", "description", "category", "categories", "tags",
  "location", "price_range_from", "price_range_to", "currency",
  "is_admin_curated", "visibility", "created_at", "updated_at"
)
SELECT
  'seed_7c63371108a892955dc9e9d4',
  'Praise Singer (Oriki Chanter)',
  'Traditional Yoruba oriki (praise poetry) chanter who personalizes your ceremony with family lineage praises. Creates deeply moving and culturally rich moments as the couple is celebrated by name, hometown, and ancestry. Often paired with talking drums.',
  'PERFORMANCE'::"InspirationCategory",
  ARRAY['PERFORMANCE']::"InspirationCategory"[],
  ARRAY['oriki', 'praise singer', 'yoruba', 'tradition', 'family', 'chanting', 'talking drum', 'ceremony', 'personal']::TEXT[],
  'Ottawa, ON',
  300,
  800,
  'CAD',
  true,
  'INSPIRATION'::"InspirationVisibility",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "inspiration_items" WHERE "title" = 'Praise Singer (Oriki Chanter)'
);

INSERT INTO "inspiration_items" (
  "id", "title", "description", "category", "categories", "tags",
  "location", "price_range_from", "price_range_to", "currency",
  "is_admin_curated", "visibility", "created_at", "updated_at"
)
SELECT
  'seed_6a87ceef823fb2617d1c11c1',
  'Grand Ballroom with Soaring 30ft Ceilings',
  'Stunning event space featuring 30-foot vaulted ceilings, floor-to-ceiling windows, and a full wraparound balcony. Accommodates 300–500 guests with space for a full stage, dance floor, and elaborate centerpiece installations. Ideal for reception or white wedding.',
  'VENUE'::"InspirationCategory",
  ARRAY['VENUE']::"InspirationCategory"[],
  ARRAY['high ceilings', 'ballroom', 'grand', 'large venue', 'vaulted', 'stage', 'dance floor', 'reception', 'ottawa']::TEXT[],
  'Ottawa, ON',
  5000,
  15000,
  'CAD',
  true,
  'INSPIRATION'::"InspirationVisibility",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "inspiration_items" WHERE "title" = 'Grand Ballroom with Soaring 30ft Ceilings'
);

INSERT INTO "inspiration_items" (
  "id", "title", "description", "category", "categories", "tags",
  "location", "price_range_from", "price_range_to", "currency",
  "is_admin_curated", "visibility", "created_at", "updated_at"
)
SELECT
  'seed_f8c23a7ef7355a126dcd19c8',
  'Heritage Hall — Exposed Brick & Timber Beams',
  'A beautifully restored 1890s heritage building with exposed red brick walls, original timber ceiling beams, and warm Edison bulb lighting. Seats up to 200 guests. The architectural character pairs beautifully with both traditional and modern African wedding aesthetics.',
  'VENUE'::"InspirationCategory",
  ARRAY['VENUE']::"InspirationCategory"[],
  ARRAY['heritage', 'exposed brick', 'timber beams', 'rustic', 'historic', 'intimate', 'character', 'warm lighting', 'ottawa']::TEXT[],
  'Ottawa, ON',
  3000,
  8000,
  'CAD',
  true,
  'INSPIRATION'::"InspirationVisibility",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "inspiration_items" WHERE "title" = 'Heritage Hall — Exposed Brick & Timber Beams'
);

INSERT INTO "inspiration_items" (
  "id", "title", "description", "category", "categories", "tags",
  "location", "price_range_from", "price_range_to", "currency",
  "is_admin_curated", "visibility", "created_at", "updated_at"
)
SELECT
  'seed_0c8dd11a450a1ee089c2a276',
  'Outdoor Garden Pavilion',
  'A lush outdoor garden venue with a permanent open-sided pavilion, manicured lawns, and a reflecting pond. Seats up to 250 guests. Stunning backdrop for outdoor traditional ceremonies, especially during summer months. Full catering kitchen on-site.',
  'VENUE'::"InspirationCategory",
  ARRAY['VENUE']::"InspirationCategory"[],
  ARRAY['outdoor', 'garden', 'pavilion', 'nature', 'summer', 'greenery', 'ceremony', 'traditional', 'lawn', 'pond', 'ottawa']::TEXT[],
  'Gatineau, QC',
  4000,
  12000,
  'CAD',
  true,
  'INSPIRATION'::"InspirationVisibility",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "inspiration_items" WHERE "title" = 'Outdoor Garden Pavilion'
);

INSERT INTO "inspiration_items" (
  "id", "title", "description", "category", "categories", "tags",
  "location", "price_range_from", "price_range_to", "currency",
  "is_admin_curated", "visibility", "created_at", "updated_at"
)
SELECT
  'seed_a429ed0b2c01b92ee7fa222d',
  'Gold & Emerald Luxury Tablescapes',
  'Opulent table settings featuring deep emerald satin runners, gold charger plates, towering floral centerpieces with tropical leaves and white roses, and gold candelabras. The color combination is a crowd-favorite for both traditional and white wedding receptions.',
  'DECOR'::"InspirationCategory",
  ARRAY['DECOR']::"InspirationCategory"[],
  ARRAY['gold', 'emerald', 'green', 'luxury', 'tablescapes', 'centerpieces', 'floral', 'candelabra', 'opulent', 'reception decor']::TEXT[],
  NULL,
  NULL,
  NULL,
  'CAD',
  true,
  'INSPIRATION'::"InspirationVisibility",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "inspiration_items" WHERE "title" = 'Gold & Emerald Luxury Tablescapes'
);

INSERT INTO "inspiration_items" (
  "id", "title", "description", "category", "categories", "tags",
  "location", "price_range_from", "price_range_to", "currency",
  "is_admin_curated", "visibility", "created_at", "updated_at"
)
SELECT
  'seed_ce7b08ddee739ab64851cc0a',
  'Kente Cloth Fabric Draping & Installations',
  'Striking décor installations using authentic kente cloth from Ghana as ceiling drapes, wall hangings, and table runners. Creates vibrant, culturally rich visual impact in any venue. Often paired with kola nut arrangements and traditional pottery for an immersive African aesthetic.',
  'DECOR'::"InspirationCategory",
  ARRAY['DECOR']::"InspirationCategory"[],
  ARRAY['kente', 'fabric', 'draping', 'ghanaian', 'african', 'cultural', 'colorful', 'textile', 'installation', 'ceiling']::TEXT[],
  NULL,
  NULL,
  NULL,
  'CAD',
  true,
  'INSPIRATION'::"InspirationVisibility",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "inspiration_items" WHERE "title" = 'Kente Cloth Fabric Draping & Installations'
);

INSERT INTO "inspiration_items" (
  "id", "title", "description", "category", "categories", "tags",
  "location", "price_range_from", "price_range_to", "currency",
  "is_admin_curated", "visibility", "created_at", "updated_at"
)
SELECT
  'seed_7c9292fefec5c66b29b61a5c',
  'White Wedding Floral Arch & Aisle',
  'Romantic white floral ceremony arch framed with cascading white orchids, peonies, and eucalyptus. Includes full aisle petal arrangement and matching floral pew markers. Works beautifully in church settings, ballrooms, and outdoor garden venues.',
  'DECOR'::"InspirationCategory",
  ARRAY['DECOR']::"InspirationCategory"[],
  ARRAY['white wedding', 'floral arch', 'ceremony', 'orchids', 'peonies', 'eucalyptus', 'aisle', 'church', 'romantic', 'classic']::TEXT[],
  NULL,
  NULL,
  NULL,
  'CAD',
  true,
  'INSPIRATION'::"InspirationVisibility",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "inspiration_items" WHERE "title" = 'White Wedding Floral Arch & Aisle'
);

INSERT INTO "inspiration_items" (
  "id", "title", "description", "category", "categories", "tags",
  "location", "price_range_from", "price_range_to", "currency",
  "is_admin_curated", "visibility", "created_at", "updated_at"
)
SELECT
  'seed_81c0d3dddf72280ee9ce87d0',
  'Aso-Oke Canopy & Traditional Altar Setup',
  'Traditional altar setup featuring a hand-woven aso-oke fabric canopy in custom bride and groom colors, flanked by wooden carved columns, brass urns, and fresh palm fronds. Sets the scene for Yoruba, Igbo, or Edo traditional marriage ceremonies.',
  'DECOR'::"InspirationCategory",
  ARRAY['DECOR']::"InspirationCategory"[],
  ARRAY['aso-oke', 'canopy', 'traditional altar', 'yoruba', 'igbo', 'edo', 'carved wood', 'palm fronds', 'brass', 'ceremony setup']::TEXT[],
  NULL,
  NULL,
  NULL,
  'CAD',
  true,
  'INSPIRATION'::"InspirationVisibility",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "inspiration_items" WHERE "title" = 'Aso-Oke Canopy & Traditional Altar Setup'
);

INSERT INTO "inspiration_items" (
  "id", "title", "description", "category", "categories", "tags",
  "location", "price_range_from", "price_range_to", "currency",
  "is_admin_curated", "visibility", "created_at", "updated_at"
)
SELECT
  'seed_aac1a48b2545601bd6a5a42e',
  'Custom Bridal Iro & Buba with George Wrapper',
  'Custom-made traditional bridal ensemble featuring premium george wrapper skirt, hand-embroidered buba top, and matching gele headtie. Available in any color combination. The designer incorporates modern tailoring for the perfect silhouette while honoring the traditional aesthetic.',
  'FASHION'::"InspirationCategory",
  ARRAY['FASHION']::"InspirationCategory"[],
  ARRAY['iro', 'buba', 'george wrapper', 'gele', 'bridal', 'traditional', 'nigerian', 'custom', 'embroidered', 'wedding outfit']::TEXT[],
  'Ottawa, ON',
  800,
  3000,
  'CAD',
  true,
  'INSPIRATION'::"InspirationVisibility",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "inspiration_items" WHERE "title" = 'Custom Bridal Iro & Buba with George Wrapper'
);

INSERT INTO "inspiration_items" (
  "id", "title", "description", "category", "categories", "tags",
  "location", "price_range_from", "price_range_to", "currency",
  "is_admin_curated", "visibility", "created_at", "updated_at"
)
SELECT
  'seed_cd29b6f3fc313351f896d16f',
  'Men''s Agbada with Hand-Embroidered Aso-Oke',
  'Regal groom''s agbada set handcrafted from premium aso-oke fabric with intricate hand embroidery. Includes the full three-piece: sokoto (trousers), buba (shirt), and flowing outer agbada. Takes 4–6 weeks to produce. Available in any custom color to coordinate with bridal outfit.',
  'FASHION'::"InspirationCategory",
  ARRAY['FASHION']::"InspirationCategory"[],
  ARRAY['agbada', 'aso-oke', 'groom', 'embroidery', 'traditional', 'yoruba', 'sokoto', 'buba', 'regal', 'wedding', 'mens fashion']::TEXT[],
  'Ottawa, ON',
  600,
  2500,
  'CAD',
  true,
  'INSPIRATION'::"InspirationVisibility",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "inspiration_items" WHERE "title" = 'Men''s Agbada with Hand-Embroidered Aso-Oke'
);

INSERT INTO "inspiration_items" (
  "id", "title", "description", "category", "categories", "tags",
  "location", "price_range_from", "price_range_to", "currency",
  "is_admin_curated", "visibility", "created_at", "updated_at"
)
SELECT
  'seed_7bc7fcc62babe5a4dd1c4c9b',
  'Nigerian Wedding Feast — Buffet Station',
  'Full Nigerian buffet featuring jollof rice (both Nigerian and party-style), egusi soup, pounded yam live station, fried plantain, pepper soup bar, small chops, and grilled suya skewers. Catered for 100–500 guests. Includes service staff, chafing dishes, and custom menus.',
  'FOOD'::"InspirationCategory",
  ARRAY['FOOD']::"InspirationCategory"[],
  ARRAY['nigerian food', 'jollof rice', 'egusi', 'pounded yam', 'suya', 'small chops', 'buffet', 'catering', 'pepper soup', 'plantain', 'wedding feast']::TEXT[],
  'Ottawa, ON',
  50,
  120,
  'CAD',
  true,
  'INSPIRATION'::"InspirationVisibility",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "inspiration_items" WHERE "title" = 'Nigerian Wedding Feast — Buffet Station'
);

UPDATE "inspiration_items"
SET
  "visibility" = 'INSPIRATION'::"InspirationVisibility",
  "is_admin_curated" = true,
  "categories" = CASE
    WHEN cardinality("categories") = 0 THEN ARRAY["category"]::"InspirationCategory"[]
    ELSE "categories"
  END
WHERE "title" IN (
  'Igbo Traditional Entrance Dance',
  'Yoruba Àgbò Dance Performance',
  'Hausa Durbar-Inspired Procession',
  'Live Afrobeats & Highlife Band',
  'Praise Singer (Oriki Chanter)',
  'Grand Ballroom with Soaring 30ft Ceilings',
  'Heritage Hall — Exposed Brick & Timber Beams',
  'Outdoor Garden Pavilion',
  'Gold & Emerald Luxury Tablescapes',
  'Kente Cloth Fabric Draping & Installations',
  'White Wedding Floral Arch & Aisle',
  'Aso-Oke Canopy & Traditional Altar Setup',
  'Custom Bridal Iro & Buba with George Wrapper',
  'Men''s Agbada with Hand-Embroidered Aso-Oke',
  'Nigerian Wedding Feast — Buffet Station'
);

INSERT INTO "tags" ("id", "slug", "label", "is_curated")
SELECT
  'tag_' || md5(s.slug),
  s.slug,
  s.label,
  false
FROM (
  SELECT DISTINCT
    trim(both '-' from regexp_replace(lower(trim(t.tag)), '[^a-z0-9]+', '-', 'g')) AS slug,
    trim(t.tag) AS label
  FROM "inspiration_items" i,
  LATERAL unnest(i.tags) AS t(tag)
  WHERE i.title IN (
  'Igbo Traditional Entrance Dance',
  'Yoruba Àgbò Dance Performance',
  'Hausa Durbar-Inspired Procession',
  'Live Afrobeats & Highlife Band',
  'Praise Singer (Oriki Chanter)',
  'Grand Ballroom with Soaring 30ft Ceilings',
  'Heritage Hall — Exposed Brick & Timber Beams',
  'Outdoor Garden Pavilion',
  'Gold & Emerald Luxury Tablescapes',
  'Kente Cloth Fabric Draping & Installations',
  'White Wedding Floral Arch & Aisle',
  'Aso-Oke Canopy & Traditional Altar Setup',
  'Custom Bridal Iro & Buba with George Wrapper',
  'Men''s Agbada with Hand-Embroidered Aso-Oke',
  'Nigerian Wedding Feast — Buffet Station'
  )
  AND trim(t.tag) <> ''
) s
WHERE s.slug <> ''
  AND s.slug NOT IN (SELECT slug FROM "tags");

INSERT INTO "inspiration_tags" ("inspiration_item_id", "tag_id")
SELECT DISTINCT i.id, tg.id
FROM "inspiration_items" i,
LATERAL unnest(i.tags) AS t(tag)
JOIN "tags" tg
  ON tg.slug = trim(both '-' from regexp_replace(lower(trim(t.tag)), '[^a-z0-9]+', '-', 'g'))
WHERE i.title IN (
  'Igbo Traditional Entrance Dance',
  'Yoruba Àgbò Dance Performance',
  'Hausa Durbar-Inspired Procession',
  'Live Afrobeats & Highlife Band',
  'Praise Singer (Oriki Chanter)',
  'Grand Ballroom with Soaring 30ft Ceilings',
  'Heritage Hall — Exposed Brick & Timber Beams',
  'Outdoor Garden Pavilion',
  'Gold & Emerald Luxury Tablescapes',
  'Kente Cloth Fabric Draping & Installations',
  'White Wedding Floral Arch & Aisle',
  'Aso-Oke Canopy & Traditional Altar Setup',
  'Custom Bridal Iro & Buba with George Wrapper',
  'Men''s Agbada with Hand-Embroidered Aso-Oke',
  'Nigerian Wedding Feast — Buffet Station'
)
ON CONFLICT DO NOTHING;
