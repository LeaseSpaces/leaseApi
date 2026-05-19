/*
  Warnings:

  - You are about to drop the column `smtpEncryption` on the `Settings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Settings" DROP COLUMN "smtpEncryption",
ADD COLUMN     "smtpTimeout" INTEGER NOT NULL DEFAULT 20000,
ADD COLUMN     "smtpUseSsl" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "smtpUseStartTls" BOOLEAN NOT NULL DEFAULT false;
