-- AlterTable
ALTER TABLE "vendor_profiles" ADD COLUMN     "categories" "VendorCategory"[] DEFAULT ARRAY[]::"VendorCategory"[];
