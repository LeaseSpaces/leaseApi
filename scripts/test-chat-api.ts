/**
 * Integration test for chat endpoints.
 * Run: npx ts-node scripts/test-chat-api.ts
 * Requires: server on PORT (default 8080), DATABASE_URL, JWT_SECRET, Firestore credentials.
 */
import "dotenv/config";

/** Emulator only when explicitly enabled (local). Production tests: USE_FIRESTORE_EMULATOR=false */
if (process.env.USE_FIRESTORE_EMULATOR === "true") {
  process.env.FIRESTORE_EMULATOR_HOST =
    process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8085";
}
import { PrismaClient } from "@prisma/client";
import { generateToken } from "../src/utils/jwt";

const BASE = process.env.CHAT_TEST_BASE_URL || `http://localhost:${process.env.PORT || 8080}/api`;
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
        surname: "Tester",
        email,
        password: null,
        roleId: 1,
        registrationType: "EMAIL",
        socialUserId: `tenant-chat-test-${Date.now()}`,
        appRole: "tenant",
      },
    });
    console.log("Created test tenant:", email, "id:", tenant.id);
  }
  return tenant;
}

async function main() {
  console.log("Chat API test — base URL:", BASE);

  const health = await fetch(`${BASE.replace(/\/api$/, "")}/`).catch(() => null);
  if (!health?.ok) {
    console.error("Server not reachable. Start with: npm run dev");
    process.exit(1);
  }

  let property = await prisma.property.findFirst({
    where: { moderationStatus: "approved" },
    include: { landlord: true },
  });
  if (!property) {
    property = await prisma.property.findFirst({ include: { landlord: true } });
  }
  assert(!!property, "No property in DB. Run: npx prisma db seed");

  const tenant = await ensureTenant();
  const landlord = property!.landlord;

  const tenantToken = generateToken(String(tenant.id));
  const landlordToken = generateToken(String(landlord.id));

  console.log("\n1) POST /properties/:propertyId/chats (tenant)");
  const start = await request("POST", `/properties/${property!.id}/chats`, tenantToken);
  console.log("   Status:", start.status);
  if (start.status !== 201) {
    console.error("   Body:", JSON.stringify(start.data, null, 2));
    throw new Error("Failed to start property chat");
  }
  const conversation = start.data.conversation as Json;
  const conversationId = String(conversation.id);
  console.log("   Conversation id:", conversationId);

  console.log("\n2) GET /properties/:propertyId/chats (tenant)");
  const getPropChat = await request("GET", `/properties/${property!.id}/chats`, tenantToken);
  console.log("   Status:", getPropChat.status);
  assert(getPropChat.status === 200, "Expected 200 for existing property chat");

  console.log("\n3) POST /chats/:id/messages (tenant)");
  const send1 = await request("POST", `/chats/${conversationId}/messages`, tenantToken, {
    body: `Test message from tenant at ${new Date().toISOString()}`,
  });
  console.log("   Status:", send1.status);
  if (send1.status !== 201) {
    console.error("   Body:", JSON.stringify(send1.data, null, 2));
    throw new Error("Failed to send tenant message");
  }
  const msg1 = send1.data.message as Json;
  console.log("   sentAt:", msg1.sentAt ?? msg1.createdAt);

  console.log("\n4) GET /chats/:id/history (landlord)");
  const history = await request("GET", `/chats/${conversationId}/history?limit=50&order=asc`, landlordToken);
  console.log("   Status:", history.status);
  if (history.status !== 200) {
    console.error("   Body:", JSON.stringify(history.data, null, 2));
    throw new Error("Failed to load history");
  }
  const meta = history.data.meta as Json;
  const historyList = (history.data.history ?? history.data.messages) as Json[];
  console.log("   Messages:", historyList?.length, "| total:", meta?.total, "| newestAt:", meta?.newestAt);

  console.log("\n5) POST /chats/:id/messages (landlord reply)");
  const send2 = await request("POST", `/chats/${conversationId}/messages`, landlordToken, {
    body: `Landlord reply at ${new Date().toISOString()}`,
  });
  console.log("   Status:", send2.status);
  assert(send2.status === 201, "Landlord send failed");

  console.log("\n6) GET /chats (inbox — both sides)");
  const tenantInbox = await request("GET", "/chats?limit=10", tenantToken);
  const landlordInbox = await request("GET", "/chats?limit=10", landlordToken);
  console.log("   Tenant inbox status:", tenantInbox.status, "| count:", (tenantInbox.data.conversations as Json[])?.length);
  console.log("   Landlord inbox status:", landlordInbox.status, "| count:", (landlordInbox.data.conversations as Json[])?.length);

  console.log("\n7) POST /chats/:id/read (landlord)");
  const read = await request("POST", `/chats/${conversationId}/read`, landlordToken);
  console.log("   Status:", read.status, "| updated:", read.data.updated);

  console.log("\n8) GET /chats/:id/history?before=... (pagination)");
  const newestAt = meta?.newestAt as string;
  if (newestAt) {
    const older = await request(
      "GET",
      `/chats/${conversationId}/history?before=${encodeURIComponent(newestAt)}&limit=10`,
      tenantToken
    );
    console.log("   Status:", older.status, "| count:", ((older.data.history ?? older.data.messages) as Json[])?.length);
  }

  console.log("\n✅ All chat endpoint checks passed.");
}

main()
  .catch((err) => {
    console.error("\n❌ Chat test failed:", err.message);
    if (String(err.message).includes("credentials") || String(err).includes("Firestore")) {
      console.error("Tip: set GOOGLE_APPLICATION_CREDENTIALS to your Firebase service account JSON.");
    }
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
