ALTER TABLE "events" ADD COLUMN "themes" "WeddingTheme"[];

UPDATE "events" SET "themes" = ARRAY["theme"]::"WeddingTheme"[] WHERE "theme" IS NOT NULL;

ALTER TABLE "events" ALTER COLUMN "themes" SET NOT NULL;
ALTER TABLE "events" DROP COLUMN "theme";
