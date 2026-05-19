import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { generateToken } from "../src/utils/jwt";

const BASE = "https://api-jfh4l76lzq-bq.a.run.app/api";

async function main() {
  const prisma = new PrismaClient();
  const property = await prisma.property.findFirst({ include: { landlord: true } });
  const tenant = await prisma.user.findUnique({
    where: { email: "chat-test-tenant@leasespaces.local" },
  });
  if (!property || !tenant) throw new Error("missing data");
  const token = generateToken(String(tenant.id));
  const url = `${BASE}/properties/${property.id}/chats`;
  console.log("POST", url);
  const res = await fetch(url, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  console.log("status:", res.status, res.statusText);
  console.log("body:", await res.text());
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
