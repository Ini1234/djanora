-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Tribe" ADD VALUE 'IBIBIO';
ALTER TYPE "Tribe" ADD VALUE 'EFIK';
ALTER TYPE "Tribe" ADD VALUE 'IJAW';
ALTER TYPE "Tribe" ADD VALUE 'URHOBO';
ALTER TYPE "Tribe" ADD VALUE 'BINI';
ALTER TYPE "Tribe" ADD VALUE 'FULANI';
ALTER TYPE "Tribe" ADD VALUE 'TIVI';
