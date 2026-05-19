/**
 * Production smoke test after deploy.
 * Run: npm run test:prod
 * Env: PROD_BASE_URL (default api3), ADMIN_USERNAME, ADMIN_PASSWORD
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { generateToken } from "../src/utils/jwt";

const BASE =
  process.env.PROD_BASE_URL || "https://api3-jfh4l76lzq-bq.a.run.app/api";
const ADMIN_USER =
  process.env.ADMIN_USERNAME || "kgabo.admin@leasespaces.local";
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "KgaboSuper#2026";

const prisma = new PrismaClient();

async function req(
  method: string,
  path: string,
  opts?: { token?: string; body?: unknown }
): Promise<{ status: number; data: Record<string, unknown> }> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(opts?.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { status: res.status, data };
}

function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log("Production smoke test —", BASE, "\n");

  const health = await fetch(BASE.replace(/\/api$/, "") + "/");
  ok(health.ok, `Root health failed: ${health.status}`);
  console.log("1) API root OK");

  const support = await req("GET", "/support/form");
  ok(support.status === 200 && support.data.success === true, `support/form: ${support.status}`);
  const cats = support.data.categories as unknown[];
  ok(Array.isArray(cats) && cats.length > 0, "support categories missing");
  console.log("2) GET /support/form OK —", cats.length, "categories");

  const login = await req("POST", "/admin/login", {
    body: { username: ADMIN_USER, password: ADMIN_PASS },
  });
  ok(login.status === 200, `admin login failed: ${login.status} ${JSON.stringify(login.data)}`);
  const adminToken = (login.data.token as string) || "";
  ok(!!adminToken, "no admin token");
  console.log("3) POST /admin/login OK");

  const apps = await req("GET", "/admin/applications?limit=5", { token: adminToken });
  ok(apps.status === 200 && apps.data.success === true, `admin applications: ${apps.status}`);
  const list = apps.data.applications as unknown[];
  console.log("4) GET /admin/applications OK —", Array.isArray(list) ? list.length : 0, "rows");

  const property = await prisma.property.findFirst({
    where: { moderationStatus: "approved" },
    select: { id: true, title: true },
  });
  ok(!!property, "no approved property in DB");
  console.log("5) DB property found:", property!.title);

  let tenant = await prisma.user.findUnique({
    where: { email: "prod-smoke-tenant@leasespaces.local" },
  });
  if (!tenant) {
    tenant = await prisma.user.create({
      data: {
        name: "Prod",
        surname: "Smoke",
        email: "prod-smoke-tenant@leasespaces.local",
        password: null,
        roleId: 1,
        registrationType: "EMAIL",
        socialUserId: `prod-smoke-${Date.now()}`,
        appRole: "tenant",
      },
    });
  }
  const tenantToken = generateToken(String(tenant.id));

  const applyForm = await req("GET", `/properties/${property!.id}/apply-form`, {
    token: tenantToken,
  });
  ok(applyForm.status === 200 && applyForm.data.success === true, `apply-form: ${applyForm.status}`);
  const steps = applyForm.data.steps as unknown[];
  ok(Array.isArray(steps) && steps.length >= 3, "apply-form steps missing");
  console.log("6) GET /properties/:id/apply-form OK —", steps.length, "steps");

  const draft = await req("POST", "/applications", {
    token: tenantToken,
    body: {
      propertyId: property!.id,
      moveInDate: "2026-07-01",
      annualIncome: 85000,
      currentEmployment: "Test Corp — Engineer",
      reference1: "Ref One — ref1@test.com",
      reference2: "Ref Two — 0820000000",
      message: "Production smoke test application draft.",
    },
  });
  ok(draft.status === 201, `create draft: ${draft.status} ${JSON.stringify(draft.data)}`);
  const appId = ((draft.data.application as Record<string, unknown>)?.id as string) || "";
  ok(!!appId, "no application id");
  console.log("7) POST /applications (draft) OK —", appId);

  const detail = await req("GET", `/admin/applications/${appId}`, { token: adminToken });
  ok(detail.status === 200 && detail.data.success === true, `admin get app: ${detail.status}`);
  console.log("8) GET /admin/applications/:id OK — status:", (detail.data.application as Record<string, unknown>)?.status);

  console.log("\nAll production smoke tests passed.");
  console.log("Deploy URL:", BASE);
}

main()
  .catch((e) => {
    console.error("\nFAIL:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
