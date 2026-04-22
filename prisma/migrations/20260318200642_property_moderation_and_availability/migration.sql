-- CreateEnum
CREATE TYPE "PropertyModerationStatus" AS ENUM ('pending_approval', 'approved', 'declined', 'flagged_for_review');

-- CreateEnum
CREATE TYPE "PropertyAvailabilityStatus" AS ENUM ('available', 'unavailable', 'occupied');

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "availabilityStatus" "PropertyAvailabilityStatus" NOT NULL DEFAULT 'available',
ADD COLUMN     "moderationNotes" TEXT,
ADD COLUMN     "moderationStatus" "PropertyModerationStatus" NOT NULL DEFAULT 'pending_approval';

-- CreateIndex
CREATE INDEX "Property_availabilityStatus_idx" ON "Property"("availabilityStatus");

-- CreateIndex
CREATE INDEX "Property_moderationStatus_idx" ON "Property"("moderationStatus");
