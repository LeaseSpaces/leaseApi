/**
 * Integration test for public support endpoints.
 * Run: npm run test:support
 * Requires: server on PORT (default 8080), DATABASE_URL.
 */
import "dotenv/config";

const BASE = process.env.SUPPORT_TEST_BASE_URL || `http://localhost:${process.env.PORT || 8080}/api`;

type Json = Record<string, unknown>;

async function request(
  method: string,
  path: string,
  body?: Json
): Promise<{ status: number; data: Json }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as Json;
  return { status: res.status, data };
}

function assert(condition: boolean, message: string) {
  if (!condition) throw new Error(message);
}

async function main() {
  console.log("Support API test — base URL:", BASE);

  const health = await fetch(`${BASE.replace(/\/api$/, "")}/`).catch(() => null);
  if (!health?.ok) {
    console.error("Server not reachable. Start with: npm run dev");
    process.exit(1);
  }

  const form = await request("GET", "/support/form");
  assert(form.status === 200, `GET /support/form expected 200, got ${form.status}`);
  const categories = form.data.categories as { name: string }[] | undefined;
  assert(Array.isArray(categories) && categories.length > 0, "Expected categories array");
  const categoryName = categories![0].name;
  console.log("Form OK — categories:", categories!.length, "using:", categoryName);

  const bad = await request("POST", "/support/tickets", {
    category: categoryName,
    description: "short",
    customerEmail: "a@b.com",
    confirmEmail: "c@d.com",
    customerName: "X",
  });
  assert(bad.status === 400, `Validation expected 400, got ${bad.status}`);
  console.log("Validation OK —", (bad.data.error as Json)?.message);

  const unique = `support-test-${Date.now()}@leasespaces.local`;
  const create = await request("POST", "/support/tickets", {
    category: categoryName,
    description: "Automated test ticket from test-support-api script.",
    customerEmail: unique,
    confirmEmail: unique,
    customerName: "Support Tester",
  });
  assert(create.status === 201, `POST /support/tickets expected 201, got ${create.status}: ${JSON.stringify(create.data)}`);
  const ticket = create.data.ticket as Json | undefined;
  assert(!!ticket?.ticketNumber, "Expected ticket.ticketNumber");
  assert(create.data.confirmationEmailSentTo === unique, "Confirmation must go to submitter email");
  console.log(
    "Ticket created:",
    ticket?.ticketNumber,
    "emailSent:",
    create.data.emailSent,
    "sentTo:",
    create.data.confirmationEmailSentTo
  );
  console.log("Support API tests passed.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
