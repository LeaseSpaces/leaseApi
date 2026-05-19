/**
 * Test chat messages against deployed production API (real Firestore).
 *
 * Run: npm run test:chat:prod
 *
 * Requires:
 * - JWT_SECRET in .env must match Firebase Functions env (or tokens are rejected)
 * - DATABASE_URL reachable (to find/create test users + property)
 *
 * Optional env:
 *   CHAT_TEST_BASE_URL — default v3 URL after deploy, or legacy v2 api URL
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { generateToken } from "../src/utils/jwt";

const BASE =
  process.env.CHAT_TEST_BASE_URL ||
  process.env.API_V3_BASE_URL ||
  "https://api-jfh4l76lzq-bq.a.run.app/api";
const prisma = new PrismaClient();

type Json = Record<string, unknown>;

async function request(
  method: string,
  path: string,
  token: string,
  body?: Json
): Promise<{ status: number; data: Json }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as Json;
  return { status: res.status, data };
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function ensureTenant() {
  const email = "chat-test-tenant@leasespaces.local";
  let tenant = await prisma.user.findUnique({ where: { email } });
  if (!tenant) {
    tenant = await prisma.user.create({
      data: {
        name: "Chat",
        surname: "ProdTester",
        email,
        password: null,
        roleId: 1,
        registrationType: "EMAIL",
        socialUserId: `tenant-chat-prod-${Date.now()}`,
        appRole: "tenant",
      },
    });
    console.log("Created test tenant:", email, "id:", tenant.id);
  }
  return tenant;
}

async function main() {
  console.log("Chat PRODUCTION test");
  console.log("Base URL:", BASE);
  console.log("(Messages stored in production Firestore)\n");

  const health = await fetch(BASE.replace(/\/api$/, "") + "/");
  assert(health.ok, `Production API not reachable (${health.status})`);
  console.log("API health: OK\n");

  let property = await prisma.property.findFirst({
    where: { moderationStatus: "approved" },
    include: { landlord: true },
  });
  if (!property) {
    property = await prisma.property.findFirst({ include: { landlord: true } });
  }
  assert(!!property, "No property in Neon DB");

  const tenant = await ensureTenant();
  const landlord = property!.landlord;
  const tenantToken = generateToken(String(tenant.id));
  const landlordToken = generateToken(String(landlord.id));

  const stamp = new Date().toISOString();
  console.log("Property:", property!.id);
  console.log("Tenant id:", tenant.id, "| Landlord id:", landlord.id);

  console.log("\n1) Start conversation (tenant → landlord)");
  const start = await request("POST", `/properties/${property!.id}/chats`, tenantToken);
  if (start.status === 401 || start.status === 403) {
    throw new Error(
      `Auth failed (${start.status}). Ensure JWT_SECRET in .env matches production Firebase Functions.`
    );
  }
  if (start.status === 404) {
    throw new Error(
      "Route not found on production — deploy latest code: firebase deploy --only functions,firestore:rules"
    );
  }
  assert(start.status === 201, `Start chat failed (${start.status}): ${JSON.stringify(start.data)}`);
  const conversationId = String((start.data.conversation as Json).id);
  console.log("   Conversation:", conversationId);

  console.log("\n2) Send tenant message");
  const send1 = await request("POST", `/chats/${conversationId}/messages`, tenantToken, {
    body: `[PROD TEST] Tenant message at ${stamp}`,
  });
  assert(send1.status === 201, `Send failed: ${JSON.stringify(send1.data)}`);
  const m1 = send1.data.message as Json;
  console.log("   sentAt:", m1.sentAt ?? m1.createdAt);

  console.log("\n3) Landlord reads history");
  const history = await request(
    "GET",
    `/chats/${conversationId}/history?limit=50&order=asc`,
    landlordToken
  );
  assert(history.status === 200, `History failed: ${JSON.stringify(history.data)}`);
  const list = (history.data.history ?? history.data.messages) as Json[];
  console.log("   Messages in thread:", list?.length);
  const last = list?.[list.length - 1];
  console.log("   Latest:", (last?.body as string)?.slice(0, 80));

  console.log("\n4) Landlord reply");
  const send2 = await request("POST", `/chats/${conversationId}/messages`, landlordToken, {
    body: `[PROD TEST] Landlord reply at ${stamp}`,
  });
  assert(send2.status === 201, `Landlord send failed: ${JSON.stringify(send2.data)}`);

  console.log("\n5) Mark read (landlord)");
  const read = await request("POST", `/chats/${conversationId}/read`, landlordToken);
  console.log("   Status:", read.status, "| updated:", read.data.updated);

  console.log("\nPASS: Chat messages work in production.");
  console.log("View in Firebase Console → Firestore → conversations / messages");
}

main()
  .catch((err) => {
    console.error("\nFAIL:", err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
