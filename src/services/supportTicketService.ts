/* eslint-disable */
import { prisma } from "../config/prisma";
import * as ticketService from "./ticketService";
import { sendSupportTicketConfirmationEmail } from "./emailDeliveryService";
import type {
  PublicSupportTicketRequest,
  PublicSupportTicketResult,
  SupportFormFieldSchema,
  SupportFormOptions,
  SupportValidationError,
} from "../interfaces/support";

const DEFAULT_CATEGORIES = [
  { name: "Account & Login", description: "Sign-in, password, profile, or verification issues" },
  { name: "Billing & Payments", description: "Charges, refunds, invoices, or payment methods" },
  { name: "Property Listings", description: "Creating, editing, or managing property listings" },
  { name: "Applications & Rentals", description: "Applying for properties or rental applications" },
  { name: "Technical Issue", description: "App errors, bugs, or performance problems" },
  { name: "Other", description: "General questions not covered above" },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const SUPPORT_FORM_FIELDS: SupportFormFieldSchema[] = [
  { name: "categoryId", label: "Category", type: "select", required: true, optionsFrom: "categories" },
  { name: "description", label: "Description", type: "textarea", required: true, minLength: 10, maxLength: 5000 },
  { name: "customerName", label: "Your name", type: "text", required: true, minLength: 2, maxLength: 120 },
  { name: "customerEmail", label: "Email", type: "email", required: true },
  { name: "confirmEmail", label: "Confirm email", type: "email", required: true, mustMatch: "customerEmail" },
];

export class SupportTicketValidationException extends Error {
  constructor(public readonly errors: SupportValidationError[]) {
    super(errors.map((e) => e.message).join("; "));
    this.name = "SupportTicketValidationException";
  }
}

export async function ensureSupportCatalogSeeded(): Promise<void> {
  if ((await prisma.ticketCategories.count()) === 0) {
    for (const cat of DEFAULT_CATEGORIES) {
      await prisma.ticketCategories.create({
        data: { name: cat.name, description: cat.description, isActive: true },
      });
    }
  }
}

export async function getSupportFormOptions(): Promise<SupportFormOptions> {
  await ensureSupportCatalogSeeded();
  const rows = await prisma.ticketCategories.findMany({
    where: { isActive: true },
    orderBy: { createdAt: "asc" },
  });
  return {
    categories: rows.map((c) => ({ id: c.id, name: c.name, description: c.description ?? null })),
    defaultPriority: "Medium",
    form: { fields: SUPPORT_FORM_FIELDS },
  };
}

export function parsePublicSupportTicketBody(body: unknown): PublicSupportTicketRequest {
  if (body == null || typeof body !== "object") {
    throw new SupportTicketValidationException([{ field: "body", message: "Request body is required" }]);
  }
  const raw = body as Record<string, unknown>;
  const categoryId = typeof raw.categoryId === "string" ? raw.categoryId.trim() : "";
  const category = typeof raw.category === "string" ? raw.category.trim() : "";
  return {
    categoryId: categoryId || undefined,
    category: categoryId || category || undefined,
    description: typeof raw.description === "string" ? raw.description.trim() : "",
    customerEmail: typeof raw.customerEmail === "string" ? raw.customerEmail.trim().toLowerCase() : "",
    confirmEmail: typeof raw.confirmEmail === "string" ? raw.confirmEmail.trim().toLowerCase() : "",
    customerName: typeof raw.customerName === "string" ? raw.customerName.trim() : "",
  };
}

async function resolveCategoryName(categoryInput: string): Promise<string> {
  await ensureSupportCatalogSeeded();
  const byId = await prisma.ticketCategories.findFirst({ where: { id: categoryInput, isActive: true } });
  if (byId) return byId.name;
  const byName = await prisma.ticketCategories.findFirst({
    where: { name: { equals: categoryInput, mode: "insensitive" }, isActive: true },
  });
  if (byName) return byName.name;
  throw new SupportTicketValidationException([
    { field: "categoryId", message: "Invalid category. Pick a category from GET /api/support/form" },
  ]);
}

export async function createPublicSupportTicket(body: unknown): Promise<PublicSupportTicketResult> {
  const data = parsePublicSupportTicketBody(body);
  const errors: SupportValidationError[] = [];
  if (!data.categoryId && !data.category) errors.push({ field: "categoryId", message: "categoryId is required" });
  if (!data.customerName || data.customerName.length < 2) {
    errors.push({ field: "customerName", message: "customerName is required (at least 2 characters)" });
  }
  if (!data.customerEmail || !EMAIL_RE.test(data.customerEmail)) {
    errors.push({ field: "customerEmail", message: "A valid customerEmail is required" });
  }
  if (!data.confirmEmail || !EMAIL_RE.test(data.confirmEmail)) {
    errors.push({ field: "confirmEmail", message: "A valid confirmEmail is required" });
  }
  if (data.customerEmail && data.confirmEmail && data.customerEmail !== data.confirmEmail) {
    errors.push({ field: "confirmEmail", message: "confirmEmail must match customerEmail" });
  }
  if (!data.description || data.description.length < 10) {
    errors.push({ field: "description", message: "description is required (at least 10 characters)" });
  }
  if (errors.length) throw new SupportTicketValidationException(errors);

  const categoryName = await resolveCategoryName(data.categoryId || data.category || "");
  const existingUser = await prisma.user.findFirst({
    where: { email: data.customerEmail },
    select: { id: true },
  });

  const ticket = await ticketService.createTicket({
    subject: `${categoryName} support request`,
    description: data.description,
    category: categoryName,
    priority: "Medium",
    customerEmail: data.customerEmail,
    customerName: data.customerName,
    customerId: existingUser?.id != null ? String(existingUser.id) : undefined,
  });

  await ticketService.addMessage(
    ticket.id,
    { content: data.description, isInternal: false },
    existingUser?.id != null ? String(existingUser.id) : data.customerEmail,
    data.customerName,
    "customer"
  );

  let emailSent = false;
  try {
    await sendSupportTicketConfirmationEmail({
      to: data.customerEmail,
      customerName: data.customerName,
      ticketNumber: ticket.ticketNumber,
      category: categoryName,
      description: data.description,
    });
    emailSent = true;
  } catch (error) {
    console.error("Support ticket confirmation email failed:", error);
  }

  return {
    ticket: {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      category: ticket.category,
      status: ticket.status,
      createdAt: ticket.createdAt,
    },
    emailSent,
    confirmationEmailSentTo: data.customerEmail,
    message: emailSent
      ? `Your support ticket has been received. A confirmation email was sent to ${data.customerEmail}.`
      : `Your support ticket has been received. A support agent will reach out soon.`,
  };
}
