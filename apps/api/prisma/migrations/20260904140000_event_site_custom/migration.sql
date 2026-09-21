-- AlterEnum
ALTER TYPE "EventSiteSectionType" ADD VALUE 'CUSTOM';

-- DropIndex
DROP INDEX "event_site_sections_site_id_type_key";
