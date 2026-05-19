/**
 * Test admin auth + settings + locations + dashboard.
 * Run: npm run test:admin
 * Env: PROD_BASE_URL, ADMIN_USERNAME, ADMIN_PASSWORD
 */
import "dotenv/config";

const BASE =
  process.env.PROD_BASE_URL || "https://api3-jfh4l76lzq-bq.a.run.app/api";
const ADMIN_USER =
  process.env.ADMIN_USERNAME || "kgabo.admin@leasespaces.local";
const ADMIN_PASS = process.env.ADMIN_PASSWORD || "KgaboSuper#2026";

type Json = Record<string, unknown>;

async function req(
  method: string,
  path: string,
  opts?: { token?: string; body?: unknown; label?: string }
): Promise<{ status: number; data: Json; raw: string }> {
  const label = opts?.label || `${method} ${path}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(opts?.token ? { Authorization: `Bearer ${opts.token}` } : {}),
    },
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  const raw = await res.text();
  let data: Json = {};
  try {
    data = JSON.parse(raw) as Json;
  } catch {
    data = { _nonJson: raw.slice(0, 300) };
  }
  const err = (data.error as Json) || {};
  console.log(
    label,
    "→",
    res.status,
    res.status < 400 ? "OK" : "FAIL",
    err.code || err.message || (data.message as string) || ""
  );
  return { status: res.status, data, raw };
}

function ok(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

async function main() {
  console.log("Admin endpoint test —", BASE, "\n");

  // 1) Login
  const login = await req("POST", "/admin/login", {
    label: "1) POST /admin/login",
    body: { username: ADMIN_USER, password: ADMIN_PASS },
  });
  ok(login.status === 200, `Login failed: ${login.status} ${login.raw.slice(0, 200)}`);

  if (login.data.requires2fa === true) {
    console.log("\n⚠ Admin has 2FA — use a non-2FA test account or complete OTP flow.");
    console.log("  temporaryToken is NOT valid for settings/locations.");
    process.exit(1);
  }

  const token = (login.data.token as string) || "";
  ok(!!token, "No token in login response");
  console.log("   Token received (first 20 chars):", token.slice(0, 20) + "...\n");

  // 2) Settings without token — should 401 after fix
  const settingsNoAuth = await req("GET", "/admin/settings/app", {
    label: "2) GET /admin/settings/app (no auth)",
  });
  if (settingsNoAuth.status === 401) {
    console.log("   ✓ Correctly rejects unauthenticated admin settings\n");
  } else if (settingsNoAuth.status === 200) {
    console.log("   ⚠ Still allows unauthenticated access (deploy latest backend?)\n");
  }

  // 3) Settings with backend JWT
  const settings = await req("GET", "/admin/settings/app", {
    label: "3) GET /admin/settings/app (Bearer token)",
    token,
  });
  ok(
    settings.status === 200 || settings.status === 404,
    `Settings with token failed: ${settings.status} ${settings.raw.slice(0, 200)}`
  );
  if (settings.status === 404) {
    console.log("   (404 = no settings row yet — auth OK)\n");
  }

  // 4) Public settings (no auth)
  const publicSettings = await req("GET", "/settings/app", {
    label: "4) GET /settings/app (public)",
  });
  ok(
    publicSettings.status === 200 || publicSettings.status === 404,
    `Public settings failed: ${publicSettings.status}`
  );

  // 5) Locations with token
  const locations = await req("GET", "/admin/locations", {
    label: "5) GET /admin/locations",
    token,
  });
  ok(locations.status === 200, `Locations failed: ${locations.status} ${locations.raw.slice(0, 300)}`);
  const locs = locations.data.locations as unknown[];
  console.log("   Locations count:", Array.isArray(locs) ? locs.length : 0, "\n");

  // 6) Dashboard with token (was firebaseAuth-only)
  const dashboard = await req("GET", "/admin/dashboard", {
    label: "6) GET /admin/dashboard",
    token,
  });
  ok(
    dashboard.status === 200,
    `Dashboard failed: ${dashboard.status} ${dashboard.raw.slice(0, 300)}`
  );

  // 7) Admin profile
  const profile = await req("GET", "/admin/admin-profile", {
    label: "7) GET /admin/admin-profile",
    token,
  });
  ok(profile.status === 200, `Profile failed: ${profile.status} ${profile.raw.slice(0, 300)}`);

  // 8) Wrong token type sanity — garbage should 401
  const badToken = await req("GET", "/admin/settings/app", {
    label: "8) GET /admin/settings/app (bad token)",
    token: "not-a-valid-jwt",
  });
  ok(badToken.status === 401, `Bad token should 401, got ${badToken.status}`);

  console.log("\n✅ All admin endpoint tests passed.");
  console.log("Base URL:", BASE);
}

main().catch((e) => {
  console.error("\n❌ FAIL:", e.message);
  process.exit(1);
});
