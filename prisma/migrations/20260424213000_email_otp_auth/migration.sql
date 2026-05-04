-- CreateTable
CREATE TABLE "EmailOtp" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,

    CONSTRAINT "EmailOtp_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "EmailOtp" ADD CONSTRAINT "EmailOtp_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "EmailOtp_email_expiresAt_idx" ON "EmailOtp"("email", "expiresAt");

-- CreateIndex
CREATE INDEX "EmailOtp_userId_idx" ON "EmailOtp"("userId");
