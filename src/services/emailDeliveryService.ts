import nodemailer from "nodemailer";
import { getSmtp } from "./settingsService";

type SendOtpEmailInput = {
  to: string;
  otp: string;
};

type SmtpTransportConfig = {
  host: string;
  port: number;
  username: string;
  password: string;
  useSsl: boolean;
  useStartTls: boolean;
  timeout: number;
  fromEmail: string;
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

const getDbSmtpConfig = async (): Promise<SmtpTransportConfig | null> => {
  const smtpConfig = await getSmtp();
  if (!smtpConfig?.isActive) return null;
  return {
    host: smtpConfig.host,
    port: smtpConfig.port,
    username: smtpConfig.username,
    password: smtpConfig.password,
    useSsl: smtpConfig.useSsl,
    useStartTls: smtpConfig.useStartTls,
    timeout: smtpConfig.timeout,
    fromEmail: smtpConfig.fromEmail || smtpConfig.username,
  };
};

const getEnvSmtpConfig = (): SmtpTransportConfig | null => {
  const emailUser = process.env.EMAIL_USER;
  const emailPass = process.env.EMAIL_PASS;
  const configuredHost = process.env.SMTP_SERVER;
  const configuredPort = parseNumber(process.env.SMTP_PORT);
  const configuredUseSsl = parseBoolean(process.env.EMAIL_USE_SSL);
  const configuredUseStartTls = parseBoolean(process.env.EMAIL_USE_STARTTLS);
  const timeoutMs = (parseNumber(process.env.EMAIL_TIMEOUT) ?? 20) * 1000;

  if (!emailUser || !emailPass) return null;

  const inferred = inferSmtpDefaultsFromEmail(emailUser);
  const host = configuredHost || inferred?.host;
  const port = configuredPort || inferred?.port;
  const useSsl = configuredUseSsl ?? inferred?.useSsl;
  const useStartTls = configuredUseStartTls ?? inferred?.useStartTls;

  if (!host || !port || (useSsl == null && useStartTls == null)) return null;

  return {
    host,
    port,
    username: emailUser,
    password: emailPass,
    useSsl: Boolean(useSsl),
    useStartTls: Boolean(useStartTls),
    timeout: timeoutMs,
    fromEmail: process.env.EMAIL_SENDER || emailUser,
  };
};

const createTransporter = (config: SmtpTransportConfig) =>
  nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.useSsl,
    auth: {
      user: config.username,
      pass: config.password,
    },
    requireTLS: config.useStartTls,
    tls: config.useStartTls ? { rejectUnauthorized: false } : undefined,
    connectionTimeout: config.timeout,
    greetingTimeout: config.timeout,
    socketTimeout: config.timeout,
  });

const resolveSmtpConfig = async (): Promise<SmtpTransportConfig> => {
  const dbConfig = await getDbSmtpConfig();
  if (dbConfig) return dbConfig;
  const envConfig = getEnvSmtpConfig();
  if (envConfig) return envConfig;
  throw new Error(
    "SMTP not configured: activate SMTP in admin settings or set EMAIL_USER / EMAIL_PASS in .env"
  );
};

export const sendTransactionalEmail = async (input: {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromName?: string;
}): Promise<void> => {
  const config = await resolveSmtpConfig();
  const transporter = createTransporter(config);
  const from = input.fromName
    ? `"${input.fromName}" <${config.fromEmail || config.username}>`
    : config.fromEmail || config.username;

  await transporter.sendMail({
    from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  });
};

export type SupportTicketConfirmationEmailInput = {
  to: string;
  customerName: string;
  ticketNumber: string;
  category: string;
  description: string;
};

const buildTicketConfirmationHtml = (input: SupportTicketConfirmationEmailInput): string => {
  const escapedDescription = input.description
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br/>");

  return `
    <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; color: #111827;">
      <h2 style="margin-bottom: 8px;">We received your support request</h2>
      <p style="color: #4b5563;">Hi ${input.customerName},</p>
      <p style="color: #4b5563;">
        Thank you for contacting LeaseSpaces Support. Your ticket has been logged and a support agent will reach out to you soon.
      </p>
      <div style="margin: 20px 0; padding: 16px; border-radius: 8px; background: #f3f4f6;">
        <p style="margin: 0 0 8px;"><strong>Ticket number:</strong> ${input.ticketNumber}</p>
        <p style="margin: 0 0 8px;"><strong>Category:</strong> ${input.category}</p>
        <p style="margin: 0;"><strong>Details:</strong></p>
        <p style="margin: 8px 0 0; color: #374151;">${escapedDescription}</p>
      </div>
      <p style="color: #6b7280; font-size: 13px;">
        This confirmation was sent to ${input.to}. Please keep your ticket number for reference when following up.
      </p>
    </div>
  `;
};

export const sendSupportTicketConfirmationEmail = async (
  input: SupportTicketConfirmationEmailInput
): Promise<void> => {
  const subject = `Support ticket received — ${input.ticketNumber}`;
  const text = [
    `Hi ${input.customerName},`,
    "",
    "Thank you for contacting LeaseSpaces Support.",
    `Ticket number: ${input.ticketNumber}`,
    `Category: ${input.category}`,
    "",
    "Details:",
    input.description,
    "",
    "A support agent will reach out to you soon.",
    "",
    `This confirmation was sent to ${input.to}.`,
  ].join("\n");

  await sendTransactionalEmail({
    to: input.to,
    subject,
    html: buildTicketConfirmationHtml(input),
    text,
    fromName: "LeaseSpaces Support",
  });
};

export const sendLeaseSpacesOtpEmail = async ({ to, otp }: SendOtpEmailInput): Promise<void> => {
  const html = `
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

  await sendTransactionalEmail({
    to,
    subject: "Your LeaseSpaces OTP Code",
    html,
    text: `Your LeaseSpaces OTP is ${otp}. It expires in 5 minutes.`,
    fromName: "LeaseSpaces",
  });
};
