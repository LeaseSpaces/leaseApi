-- Rental application fields (Apply for Rental UI)
ALTER TYPE "ApplicationStatus" ADD VALUE IF NOT EXISTS 'draft';

ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "annualIncome" INTEGER;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "currentEmployment" TEXT;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "references" JSONB;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "termsAcceptedAt" TIMESTAMP(3);
