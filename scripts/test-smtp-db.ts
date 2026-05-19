/**
 * Verify SMTP loaded from Neon (Settings table) — same path as OTP / support emails.
 * Run: npm run test:smtp
 * Optional: npm run test:smtp -- you@example.com
 */
import "dotenv/config";
import nodemailer from "nodemailer";
import { getSmtp } from "../src/services/settingsService";

const testTo = process.argv[2] || process.env.SMTP_TEST_TO || "tsirikgabo793@gmail.com";

async function main() {
  console.log("SMTP DB test — reading Settings from Neon via DATABASE_URL\n");

  const db = await getSmtp();
  if (!db) {
    console.error("FAIL: No Settings row in database. Save SMTP via POST /api/admin/settings/smtp");
    process.exit(1);
  }

  console.log("DB SMTP record:");
  console.log("  host:", db.host);
  console.log("  port:", db.port);
  console.log("  username:", db.username);
  console.log("  fromEmail:", db.fromEmail);
  console.log("  isActive:", db.isActive);
  console.log("  password: [decrypted OK — length", db.password?.length ?? 0, "chars]");

  if (!db.isActive) {
    console.error("\nFAIL: smtpIsActive is false — emails would fall back to .env EMAIL_* instead.");
    process.exit(1);
  }

  if (!db.host || !db.username || !db.password) {
    console.error("\nFAIL: SMTP host, username, or password missing in DB.");
    process.exit(1);
  }

  const transporter = nodemailer.createTransport({
    host: db.host,
    port: db.port,
    secure: db.useSsl,
    auth: { user: db.username, pass: db.password },
    requireTLS: db.useStartTls,
    tls: db.useStartTls ? { rejectUnauthorized: false } : undefined,
    connectionTimeout: db.timeout,
    greetingTimeout: db.timeout,
    socketTimeout: db.timeout,
  });

  console.log("\n1) Verifying SMTP connection (database config)...");
  await transporter.verify();
  console.log("   OK — connection verified");

  console.log(`\n2) Sending test email to ${testTo}...`);
  const from = db.fromEmail || db.username;
  await transporter.sendMail({
    from: db.fromName ? `"${db.fromName}" <${from}>` : from,
    to: testTo,
    subject: "LeaseSpaces SMTP test (from Neon DB)",
    text: "This message was sent using SMTP settings stored in your Neon database (not .env fallback).",
    html: "<p>This message was sent using <strong>SMTP settings stored in your Neon database</strong> (not .env fallback).</p>",
  });
  console.log("   OK — test email sent");

  console.log("\nPASS: Production email path (Neon DB, isActive=true) works.");
}

main().catch((e) => {
  console.error("\nFAIL:", e instanceof Error ? e.message : e);
  process.exit(1);
});
