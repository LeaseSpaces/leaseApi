/**
 * Test POST /applications/:id/documents (multipart) against prod or local.
 * Run: npx ts-node scripts/test-application-documents.ts
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { generateToken } from "../src/utils/jwt";

const BASE =
  process.env.PROD_BASE_URL || "https://api3-jfh4l76lzq-bq.a.run.app/api";

const prisma = new PrismaClient();

/** Minimal valid JPEG (1x1) */
const TINY_JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAb/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCdABmX/9k=",
  "base64"
);

async function main() {
  const property = await prisma.property.findFirst({
    where: { moderationStatus: "approved" },
    select: { id: true, title: true },
  });
  if (!property) throw new Error("No approved property");

  let tenant = await prisma.user.findUnique({
    where: { email: "prod-smoke-tenant@leasespaces.local" },
  });
  if (!tenant) throw new Error("Run test:prod first to create prod-smoke-tenant");

  const token = generateToken(String(tenant.id));

  let appId = "";
  const existing = await prisma.application.findFirst({
    where: { tenantId: tenant.id, propertyId: property.id, status: "draft" },
    select: { id: true },
  });
  if (existing) {
    appId = existing.id;
    console.log("Using existing draft:", appId);
  } else {
    const draftRes = await fetch(`${BASE}/applications`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        propertyId: property.id,
        moveInDate: "2026-08-01",
        annualIncome: 90000,
        currentEmployment: "Doc upload test",
        reference1: "Ref One — ref1@test.com",
        reference2: "Ref Two — 0820000000",
      }),
    });
    const draftText = await draftRes.text();
    let draftJson: Record<string, unknown> = {};
    try {
      draftJson = JSON.parse(draftText);
    } catch {
      console.error("Draft response not JSON:", draftRes.status, draftText.slice(0, 500));
      process.exit(1);
    }
    if (draftRes.status !== 201) {
      throw new Error(`Draft failed ${draftRes.status}: ${draftText}`);
    }
    appId = ((draftJson.application as Record<string, unknown>)?.id as string) || "";
    console.log("Created draft:", appId);
  }

  const paths = [
    `/applications/${appId}/documents`,
    `/mobile/applications/${appId}/documents`,
  ];

  for (const p of paths) {
    const form2 = new FormData();
    const govBlob = new Blob([TINY_JPEG], { type: "image/jpeg" });
    const incomeBlob = new Blob([TINY_JPEG], { type: "image/jpeg" });
    form2.append("governmentId", govBlob, "Screenshot_20260516_123907_Expo Go.jpg");
    form2.append("proofOfIncome", incomeBlob, "Screenshot_20260515_203123_Expo Go.jpg");

    const res = await fetch(`${BASE}${p}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: form2,
    });
    const text = await res.text();
    console.log(`\nPOST ${p}`);
    console.log("  status:", res.status);
    console.log("  content-type:", res.headers.get("content-type"));
    console.log("  body:", text.slice(0, 800));
    try {
      JSON.parse(text);
      console.log("  (valid JSON)");
    } catch {
      console.log("  *** NOT JSON — mobile would show 'Unexpected server response' ***");
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
