import nodemailer from "nodemailer";

type SendOtpEmailInput = {
  to: string;
  otp: string;
};

const parseBoolean = (value?: string): boolean | undefined => {
  if (value == null || value.trim() === "") return undefined;
  return value.trim().toLowerCase() === "true";
};

const parseNumber = (value?: string): number | undefined => {
  if (value == null || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const inferSmtpDefaultsFromEmail = (emailUser?: string): {
  host: string;
  port: number;
  useSsl: boolean;
  useStartTls: boolean;
} | null => {
  if (!emailUser) return null;
  const normalized = emailUser.toLowerCase();
  if (normalized.endsWith("@gmail.com")) {
    return { host: "smtp.gmail.com", port: 465, useSsl: true, useStartTls: false };
  }
  if (
    normalized.endsWith("@outlook.com") ||
    normalized.endsWith("@hotmail.com") ||
    normalized.endsWith("@live.com") ||
    normalized.endsWith("@office365.com")
  ) {
    return { host: "smtp.office365.com", port: 587, useSsl: false, useStartTls: true };
  }
  return null;
};

const buildOtpHtml = (otp: string): string => {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #111827;">
      <h2 style="margin-bottom: 8px;">LeaseSpaces OTP</h2>
      <p style="margin-top: 0; color: #4b5563;">Use the code below to continue signing in.</p>
      <div style="margin: 24px 0; padding: 16px; border-radius: 8px; background: #f3f4f6; text-align: center;">
        <span style="font-size: 28px; letter-spacing: 8px; font-weight: 700;">${otp}</span>
      </div>
      <p style="margin-bottom: 6px;">This code expires in <strong>5 minutes</strong>.</p>
      <p style="margin-top: 0; color: #6b7280; font-size: 13px;">If you did not request this code, you can ignore this email.</p>
    </div>
  `;
};

const sendWithEnvSmtp = async (to: string, otp: string): Promise<void> => {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  const configuredHost = process.env.SMTP_SERVER;
  const configuredPort = parseNumber(process.env.SMTP_PORT);
  const configuredUseSsl = parseBoolean(process.env.EMAIL_USE_SSL);
  const configuredUseStartTls = parseBoolean(process.env.EMAIL_USE_STARTTLS);
  const timeoutMs = (parseNumber(process.env.EMAIL_TIMEOUT) ?? 20) * 1000;

  if (!emailUser || !emailPass) {
    throw new Error("SMTP Error: EMAIL_USER / EMAIL_PASS not set in .env.");
  }

  const inferred = inferSmtpDefaultsFromEmail(emailUser);
  const host = configuredHost || inferred?.host;
  const port = configuredPort || inferred?.port;
  const useSsl = configuredUseSsl ?? inferred?.useSsl;
  const useStartTls = configuredUseStartTls ?? inferred?.useStartTls;

  if (!host || !port) {
    throw new Error("SMTP Error: SMTP_SERVER / SMTP_PORT not configured (and not auto-detected).");
  }
  if (useSsl == null && useStartTls == null) {
    throw new Error("SMTP Error: Set EMAIL_USE_SSL=true/false or EMAIL_USE_STARTTLS=true/false in .env.");
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: Boolean(useSsl),
    auth: {
      user: emailUser,
      pass: emailPass,
    },
    requireTLS: Boolean(useStartTls),
    tls: useStartTls ? { rejectUnauthorized: false } : undefined,
    connectionTimeout: timeoutMs,
    greetingTimeout: timeoutMs,
    socketTimeout: timeoutMs,
  });

  await transporter.sendMail({
    from: process.env.EMAIL_SENDER || emailUser,
    to,
    subject: "Your LeaseSpaces OTP Code",
    html: buildOtpHtml(otp),
    text: `Your LeaseSpaces OTP is ${otp}. It expires in 5 minutes.`,
  });
};

export const sendLeaseSpacesOtpEmail = async ({ to, otp }: SendOtpEmailInput): Promise<void> => {
  await sendWithEnvSmtp(to, otp);
};

