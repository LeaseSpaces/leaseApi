-- CreateEnum
CREATE TYPE "DocumentsVerificationStatus" AS ENUM ('pending', 'in_review', 'verified', 'partial', 'rejected');
CREATE TYPE "LeaseStatus" AS ENUM ('active', 'ended', 'cancelled');
CREATE TYPE "MaintenanceStatus" AS ENUM ('open', 'in_progress', 'resolved', 'closed');
CREATE TYPE "MaintenancePriority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- AlterTable Application
ALTER TABLE "Application" ADD COLUMN "documentsVerificationStatus" "DocumentsVerificationStatus" NOT NULL DEFAULT 'pending';
ALTER TABLE "Application" ADD COLUMN "documentsVerifiedAt" TIMESTAMP(3);
ALTER TABLE "Application" ADD COLUMN "documentsVerificationNotes" TEXT;

-- CreateTable Lease
CREATE TABLE "Lease" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "landlordId" INTEGER NOT NULL,
    "applicationId" TEXT,
    "status" "LeaseStatus" NOT NULL DEFAULT 'active',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "monthlyRent" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'ZAR',
    "agreementUrl" TEXT,
    "agreementNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lease_pkey" PRIMARY KEY ("id")
);

-- CreateTable MaintenanceRequest
CREATE TABLE "MaintenanceRequest" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "tenantId" INTEGER NOT NULL,
    "landlordId" INTEGER NOT NULL,
    "leaseId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'open',
    "priority" "MaintenancePriority" NOT NULL DEFAULT 'medium',
    "images" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaintenanceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lease_applicationId_key" ON "Lease"("applicationId");
CREATE INDEX "Lease_propertyId_idx" ON "Lease"("propertyId");
CREATE INDEX "Lease_tenantId_idx" ON "Lease"("tenantId");
CREATE INDEX "Lease_landlordId_idx" ON "Lease"("landlordId");
CREATE INDEX "Lease_status_idx" ON "Lease"("status");

CREATE INDEX "MaintenanceRequest_propertyId_idx" ON "MaintenanceRequest"("propertyId");
CREATE INDEX "MaintenanceRequest_tenantId_idx" ON "MaintenanceRequest"("tenantId");
CREATE INDEX "MaintenanceRequest_landlordId_idx" ON "MaintenanceRequest"("landlordId");
CREATE INDEX "MaintenanceRequest_status_idx" ON "MaintenanceRequest"("status");

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_landlordId_fkey" FOREIGN KEY ("landlordId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_landlordId_fkey" FOREIGN KEY ("landlordId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE SET NULL ON UPDATE CASCADE;
