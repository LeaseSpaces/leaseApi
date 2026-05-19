/**
 * Reset 2FA for an admin user by email.
 * Run: npx ts-node scripts/reset-admin-2fa.ts
 * Or:   npx ts-node scripts/reset-admin-2fa.ts other@email.com
 */
import "dotenv/config";
import { prisma } from "../src/config/prisma";

const email = (process.argv[2] || "admin@leasespaces.local").trim().toLowerCase();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, email: true, appRole: true, twofa_enabled: true, twofa_secret: true },
  });

  if (!user) {
    console.error("User not found:", email);
    process.exit(1);
  }

  if (user.appRole !== "admin") {
    console.warn("Warning: user appRole is", user.appRole, "(expected admin)");
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { twofa_enabled: false, twofa_secret: null },
    select: { id: true, email: true, twofa_enabled: true, twofa_secret: true },
  });

  console.log("2FA reset OK for:", updated.email);
  console.log("  id:", updated.id);
  console.log("  twofa_enabled:", updated.twofa_enabled);
  console.log("  twofa_secret:", updated.twofa_secret ?? "(cleared)");
  console.log("\nThey can log in with POST /api/admin/login using password only.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
