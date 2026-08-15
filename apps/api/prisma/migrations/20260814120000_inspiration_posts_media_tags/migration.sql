-- CreateEnum
CREATE TYPE "InspirationVisibility" AS ENUM ('DRAFT', 'PROFILE', 'INSPIRATION');

-- CreateEnum
CREATE TYPE "InspirationMediaType" AS ENUM ('IMAGE', 'VIDEO', 'EXTERNAL');

-- AlterEnum
ALTER TYPE "InquiryMessageKind" ADD VALUE 'INSPIRATION';

-- AlterTable vendor_profiles
ALTER TABLE "vendor_profiles"
  ADD COLUMN "external_portfolio_url" TEXT,
  ADD COLUMN "external_portfolio_label" TEXT;

-- AlterTable inspiration_items
ALTER TABLE "inspiration_items"
  ADD COLUMN "cost_note" TEXT,
  ADD COLUMN "visibility" "InspirationVisibility" NOT NULL DEFAULT 'PROFILE';

-- Existing feed items stay in Inspiration
UPDATE "inspiration_items" SET "visibility" = 'INSPIRATION';

-- AlterTable inquiries
ALTER TABLE "inquiries"
  ADD COLUMN "origin_inspiration_item_id" TEXT;

-- CreateTable tags
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "is_curated" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tags_slug_key" ON "tags"("slug");

-- CreateTable inspiration_tags
CREATE TABLE "inspiration_tags" (
    "inspiration_item_id" TEXT NOT NULL,
    "tag_id" TEXT NOT NULL,

    CONSTRAINT "inspiration_tags_pkey" PRIMARY KEY ("inspiration_item_id","tag_id")
);

CREATE INDEX "inspiration_tags_tag_id_idx" ON "inspiration_tags"("tag_id");

ALTER TABLE "inspiration_tags"
  ADD CONSTRAINT "inspiration_tags_inspiration_item_id_fkey"
  FOREIGN KEY ("inspiration_item_id") REFERENCES "inspiration_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inspiration_tags"
  ADD CONSTRAINT "inspiration_tags_tag_id_fkey"
  FOREIGN KEY ("tag_id") REFERENCES "tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable inspiration_media
CREATE TABLE "inspiration_media" (
    "id" TEXT NOT NULL,
    "inspiration_item_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "media_type" "InspirationMediaType" NOT NULL DEFAULT 'IMAGE',
    "caption" TEXT,
    "is_cover" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inspiration_media_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inspiration_media_inspiration_item_id_sort_order_idx" ON "inspiration_media"("inspiration_item_id", "sort_order");

ALTER TABLE "inspiration_media"
  ADD CONSTRAINT "inspiration_media_inspiration_item_id_fkey"
  FOREIGN KEY ("inspiration_item_id") REFERENCES "inspiration_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Cover image for existing inspiration rows
INSERT INTO "inspiration_media" ("id", "inspiration_item_id", "url", "media_type", "is_cover", "sort_order")
SELECT
  md5(i.id || ':cover') ,
  i.id,
  i.image_url,
  'IMAGE',
  true,
  0
FROM "inspiration_items" i
WHERE i.image_url IS NOT NULL AND i.image_url <> '';

-- Indexes
CREATE INDEX "inspiration_items_visibility_category_idx" ON "inspiration_items"("visibility", "category");
CREATE INDEX "inspiration_items_vendor_profile_id_visibility_idx" ON "inspiration_items"("vendor_profile_id", "visibility");
CREATE INDEX "inquiries_origin_inspiration_item_id_idx" ON "inquiries"("origin_inspiration_item_id");

ALTER TABLE "inquiries"
  ADD CONSTRAINT "inquiries_origin_inspiration_item_id_fkey"
  FOREIGN KEY ("origin_inspiration_item_id") REFERENCES "inspiration_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed curated tags
INSERT INTO "tags" ("id", "slug", "label", "is_curated") VALUES
  ('tag_gele', 'gele', 'Gele', true),
  ('tag_aso-oke', 'aso-oke', 'Aso-oke', true),
  ('tag_iro-buba', 'iro-buba', 'Iro & buba', true),
  ('tag_agbada', 'agbada', 'Agbada', true),
  ('tag_isi-agu', 'isi-agu', 'Isi-agu', true),
  ('tag_george', 'george', 'George wrapper', true),
  ('tag_kente', 'kente', 'Kente', true),
  ('tag_igba-nkwu', 'igba-nkwu', 'Igba nkwu', true),
  ('tag_introduction', 'introduction', 'Introduction', true),
  ('tag_white-wedding', 'white-wedding', 'White wedding', true),
  ('tag_traditional', 'traditional', 'Traditional', true),
  ('tag_jollof', 'jollof', 'Jollof', true),
  ('tag_small-chops', 'small-chops', 'Small chops', true),
  ('tag_live-band', 'live-band', 'Live band', true),
  ('tag_afrobeats', 'afrobeats', 'Afrobeats', true),
  ('tag_talking-drum', 'talking-drum', 'Talking drum', true),
  ('tag_ottawa', 'ottawa', 'Ottawa', true),
  ('tag_yoruba', 'yoruba', 'Yoruba', true),
  ('tag_igbo', 'igbo', 'Igbo', true),
  ('tag_hausa', 'hausa', 'Hausa', true);

-- Backfill tags from existing string arrays (uncurated unless slug already exists)
INSERT INTO "tags" ("id", "slug", "label", "is_curated")
SELECT
  'tag_' || md5(slug),
  slug,
  initcap(replace(slug, '-', ' ')),
  false
FROM (
  SELECT DISTINCT trim(both '-' from regexp_replace(lower(trim(t.tag)), '[^a-z0-9]+', '-', 'g')) AS slug
  FROM "inspiration_items" i,
  LATERAL unnest(i.tags) AS t(tag)
  WHERE trim(t.tag) <> ''
) s
WHERE slug <> '' AND slug NOT IN (SELECT slug FROM "tags");

INSERT INTO "inspiration_tags" ("inspiration_item_id", "tag_id")
SELECT DISTINCT i.id, tg.id
FROM "inspiration_items" i,
LATERAL unnest(i.tags) AS t(tag)
JOIN "tags" tg
  ON tg.slug = trim(both '-' from regexp_replace(lower(trim(t.tag)), '[^a-z0-9]+', '-', 'g'));

-- Migrate portfolio_items into inspiration posts (PROFILE)
INSERT INTO "inspiration_items" (
  "id", "title", "description", "category", "tags", "image_url",
  "visibility", "vendor_profile_id", "created_by_id", "is_admin_curated",
  "currency", "created_at", "updated_at"
)
SELECT
  'port_' || p.id,
  COALESCE(NULLIF(p.title, ''), 'Portfolio photo'),
  COALESCE(p.description, ''),
  CASE vp.category
    WHEN 'DJ' THEN 'MUSIC'::"InspirationCategory"
    WHEN 'LIVE_BAND' THEN 'MUSIC'::"InspirationCategory"
    WHEN 'MC' THEN 'PERFORMANCE'::"InspirationCategory"
    WHEN 'CATERER' THEN 'FOOD'::"InspirationCategory"
    WHEN 'DECORATOR' THEN 'DECOR'::"InspirationCategory"
    WHEN 'FASHION_STYLIST' THEN 'FASHION'::"InspirationCategory"
    WHEN 'MAKEUP_ARTIST' THEN 'FASHION'::"InspirationCategory"
    ELSE 'OTHER'::"InspirationCategory"
  END,
  ARRAY[]::TEXT[],
  p.media_url,
  'PROFILE'::"InspirationVisibility",
  p.vendor_profile_id,
  vp.user_id,
  false,
  'CAD',
  p.created_at,
  p.created_at
FROM "portfolio_items" p
JOIN "vendor_profiles" vp ON vp.id = p.vendor_profile_id;

INSERT INTO "inspiration_media" ("id", "inspiration_item_id", "url", "media_type", "is_cover", "sort_order", "created_at")
SELECT
  p.id,
  'port_' || p.id,
  p.media_url,
  CASE WHEN p.media_type ILIKE 'video%' THEN 'VIDEO'::"InspirationMediaType" ELSE 'IMAGE'::"InspirationMediaType" END,
  p.is_cover,
  p.sort_order,
  p.created_at
FROM "portfolio_items" p;

DROP TABLE "portfolio_items";
