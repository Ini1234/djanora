-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'VENDOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "VendorCategory" AS ENUM ('CATERER', 'DJ', 'PHOTOGRAPHER', 'VIDEOGRAPHER', 'DECORATOR', 'MAKEUP_ARTIST', 'MC', 'WEDDING_PLANNER', 'FASHION_STYLIST', 'LIVE_BAND', 'OTHER');

-- CreateEnum
CREATE TYPE "Tribe" AS ENUM ('YORUBA', 'IGBO', 'HAUSA', 'OTHER');

-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('INTRODUCTION', 'TRADITIONAL_WEDDING', 'WHITE_WEDDING', 'RECEPTION', 'ENGAGEMENT', 'NAMING_CEREMONY');

-- CreateEnum
CREATE TYPE "WeddingTheme" AS ENUM ('TRADITIONAL', 'WHITE_WEDDING', 'FUSION', 'OUTDOOR', 'INDOOR_LUXURY', 'GARDEN');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('PENDING', 'VIEWED', 'QUOTED', 'ACCEPTED', 'DECLINED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('INQUIRY_RECEIVED', 'INQUIRY_QUOTED', 'INQUIRY_ACCEPTED', 'INQUIRY_DECLINED', 'BOOKING_CONFIRMED', 'EVENT_REMINDER', 'REVIEW_REQUEST', 'SYSTEM');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "clerk_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "first_name" TEXT,
    "last_name" TEXT,
    "phone" TEXT,
    "avatar_url" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "has_vendor_profile" BOOLEAN NOT NULL DEFAULT false,
    "active_mode" TEXT NOT NULL DEFAULT 'user',
    "region" TEXT NOT NULL DEFAULT 'Ottawa, Ontario, Canada',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "business_name" TEXT NOT NULL,
    "bio" TEXT,
    "category" "VendorCategory" NOT NULL,
    "tribes_served" "Tribe"[],
    "estimated_price_from" INTEGER,
    "estimated_price_to" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "website_url" TEXT,
    "instagram_url" TEXT,
    "facebook_url" TEXT,
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "average_rating" DOUBLE PRECISION,
    "total_reviews" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_services" (
    "id" TEXT NOT NULL,
    "vendor_profile_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price_from" INTEGER,
    "price_to" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vendor_services_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portfolio_items" (
    "id" TEXT NOT NULL,
    "vendor_profile_id" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "media_url" TEXT NOT NULL,
    "media_type" TEXT NOT NULL DEFAULT 'image',
    "is_cover" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vendor_availability" (
    "id" TEXT NOT NULL,
    "vendor_profile_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT false,
    "note" TEXT,

    CONSTRAINT "vendor_availability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "events" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "event_type" "EventType" NOT NULL DEFAULT 'RECEPTION',
    "tribe" "Tribe" NOT NULL,
    "theme" "WeddingTheme" NOT NULL,
    "estimated_date" DATE,
    "location" TEXT,
    "total_budget" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "guest_count" INTEGER,
    "notes" TEXT,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_budget_items" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "category" "VendorCategory" NOT NULL,
    "allocated_amount" INTEGER NOT NULL,
    "spent_amount" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_budget_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_checklist" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "due_date" DATE,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "event_checklist_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cultures" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,

    CONSTRAINT "cultures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "culture_tribes" (
    "id" TEXT NOT NULL,
    "culture_id" TEXT NOT NULL,
    "tribe" "Tribe" NOT NULL,
    "description" TEXT,

    CONSTRAINT "culture_tribes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "traditions" (
    "id" TEXT NOT NULL,
    "culture_tribe_id" TEXT NOT NULL,
    "event_type" "EventType" NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_required" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "traditions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiries" (
    "id" TEXT NOT NULL,
    "event_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "vendor_profile_id" TEXT NOT NULL,
    "status" "InquiryStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT NOT NULL,
    "quoted_amount" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'CAD',
    "event_date" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry_messages" (
    "id" TEXT NOT NULL,
    "inquiry_id" TEXT NOT NULL,
    "sender_id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "vendor_profile_id" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_clerk_id_key" ON "users"("clerk_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_clerk_id_idx" ON "users"("clerk_id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_profiles_user_id_key" ON "vendor_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_profiles_slug_key" ON "vendor_profiles"("slug");

-- CreateIndex
CREATE INDEX "vendor_profiles_category_idx" ON "vendor_profiles"("category");

-- CreateIndex
CREATE INDEX "vendor_profiles_slug_idx" ON "vendor_profiles"("slug");

-- CreateIndex
CREATE INDEX "vendor_profiles_is_active_is_verified_idx" ON "vendor_profiles"("is_active", "is_verified");

-- CreateIndex
CREATE INDEX "vendor_services_vendor_profile_id_idx" ON "vendor_services"("vendor_profile_id");

-- CreateIndex
CREATE INDEX "portfolio_items_vendor_profile_id_idx" ON "portfolio_items"("vendor_profile_id");

-- CreateIndex
CREATE INDEX "vendor_availability_vendor_profile_id_date_idx" ON "vendor_availability"("vendor_profile_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "vendor_availability_vendor_profile_id_date_key" ON "vendor_availability"("vendor_profile_id", "date");

-- CreateIndex
CREATE INDEX "events_user_id_idx" ON "events"("user_id");

-- CreateIndex
CREATE INDEX "event_budget_items_event_id_idx" ON "event_budget_items"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_budget_items_event_id_category_key" ON "event_budget_items"("event_id", "category");

-- CreateIndex
CREATE INDEX "event_checklist_event_id_idx" ON "event_checklist"("event_id");

-- CreateIndex
CREATE UNIQUE INDEX "cultures_name_key" ON "cultures"("name");

-- CreateIndex
CREATE UNIQUE INDEX "culture_tribes_culture_id_tribe_key" ON "culture_tribes"("culture_id", "tribe");

-- CreateIndex
CREATE INDEX "traditions_culture_tribe_id_event_type_idx" ON "traditions"("culture_tribe_id", "event_type");

-- CreateIndex
CREATE INDEX "inquiries_sender_id_idx" ON "inquiries"("sender_id");

-- CreateIndex
CREATE INDEX "inquiries_vendor_profile_id_idx" ON "inquiries"("vendor_profile_id");

-- CreateIndex
CREATE INDEX "inquiries_status_idx" ON "inquiries"("status");

-- CreateIndex
CREATE INDEX "inquiry_messages_inquiry_id_idx" ON "inquiry_messages"("inquiry_id");

-- CreateIndex
CREATE INDEX "reviews_vendor_profile_id_idx" ON "reviews"("vendor_profile_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_author_id_vendor_profile_id_key" ON "reviews"("author_id", "vendor_profile_id");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_idx" ON "notifications"("user_id", "is_read");

-- CreateIndex
CREATE INDEX "notifications_user_id_created_at_idx" ON "notifications"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "vendor_profiles" ADD CONSTRAINT "vendor_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_services" ADD CONSTRAINT "vendor_services_vendor_profile_id_fkey" FOREIGN KEY ("vendor_profile_id") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portfolio_items" ADD CONSTRAINT "portfolio_items_vendor_profile_id_fkey" FOREIGN KEY ("vendor_profile_id") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vendor_availability" ADD CONSTRAINT "vendor_availability_vendor_profile_id_fkey" FOREIGN KEY ("vendor_profile_id") REFERENCES "vendor_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "events" ADD CONSTRAINT "events_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_budget_items" ADD CONSTRAINT "event_budget_items_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_checklist" ADD CONSTRAINT "event_checklist_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "culture_tribes" ADD CONSTRAINT "culture_tribes_culture_id_fkey" FOREIGN KEY ("culture_id") REFERENCES "cultures"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "traditions" ADD CONSTRAINT "traditions_culture_tribe_id_fkey" FOREIGN KEY ("culture_tribe_id") REFERENCES "culture_tribes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_vendor_profile_id_fkey" FOREIGN KEY ("vendor_profile_id") REFERENCES "vendor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_messages" ADD CONSTRAINT "inquiry_messages_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_vendor_profile_id_fkey" FOREIGN KEY ("vendor_profile_id") REFERENCES "vendor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
