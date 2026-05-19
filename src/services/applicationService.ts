/* eslint-disable */
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ApplicationStatus, DocumentsVerificationStatus } from "@prisma/client";
import * as leaseService from "./leaseService";
import type {
  ApplicationDocument,
  ApplicationDocumentType,
  ApplicationFormFieldSchema,
  ApplicationPersonalInfoInput,
  ApplicationReference,
  CreateApplicationDraftInput,
  PropertyApplyFormResponse,
} from "../interfaces/application";

export interface ListApplicationsFilters {
  status?: ApplicationStatus;
  page?: number;
  limit?: number;
}

export class ApplicationValidationException extends Error {
  constructor(
    public readonly errors: { field: string; message: string }[]
  ) {
    super(errors.map((e) => e.message).join("; "));
    this.name = "ApplicationValidationException";
  }
}

const PERSONAL_INFO_FIELDS: ApplicationFormFieldSchema[] = [
  {
    name: "moveInDate",
    label: "Preferred Move-in Date",
    type: "date",
    required: false,
    placeholder: "YYYY-MM-DD",
    step: "personal_info",
  },
  {
    name: "annualIncome",
    label: "Annual Income",
    type: "number",
    required: true,
    placeholder: "e.g., 75000",
    step: "personal_info",
  },
  {
    name: "currentEmployment",
    label: "Current Employment",
    type: "text",
    required: true,
    placeholder: "Company name and position",
    minLength: 2,
    step: "personal_info",
  },
  {
    name: "reference1",
    label: "Reference 1",
    type: "text",
    required: true,
    placeholder: "Reference 1 (Name and contact)",
    minLength: 3,
    step: "personal_info",
  },
  {
    name: "reference2",
    label: "Reference 2",
    type: "text",
    required: true,
    placeholder: "Reference 2 (Name and contact)",
    minLength: 3,
    step: "personal_info",
  },
  {
    name: "message",
    label: "Message to Landlord",
    type: "textarea",
    required: false,
    placeholder: "Tell the landlord why you'd be a great tenant...",
    maxLength: 2000,
    step: "personal_info",
  },
];

const DOCUMENT_FIELDS: ApplicationFormFieldSchema[] = [
  {
    name: "governmentId",
    label: "Government ID",
    type: "file",
    required: true,
    acceptedFormats: ["application/pdf", "image/jpeg", "image/png"],
    step: "documents",
  },
  {
    name: "proofOfIncome",
    label: "Proof of Income",
    type: "file",
    required: true,
    acceptedFormats: ["application/pdf", "image/jpeg", "image/png"],
    step: "documents",
  },
  {
    name: "referenceLetters",
    label: "Reference Letters",
    type: "file",
    required: false,
    acceptedFormats: ["application/pdf", "image/jpeg", "image/png"],
    step: "documents",
  },
];

const REVIEW_FIELDS: ApplicationFormFieldSchema[] = [
  {
    name: "termsAccepted",
    label: "I agree to the terms and conditions and authorize a background check",
    type: "toggle",
    required: true,
    step: "review",
  },
];

function formatMonthlyRent(price: number, currency: string): string {
  const symbol = currency === "ZAR" ? "R" : currency === "USD" ? "$" : "";
  return `${symbol}${price.toLocaleString("en-ZA")}`;
}

export function parseReferences(input: ApplicationPersonalInfoInput): ApplicationReference[] {
  if (Array.isArray(input.references) && input.references.length > 0) {
    return input.references
      .map((r) => ({
        name: String(r?.name ?? "").trim(),
        contact: String(r?.contact ?? "").trim(),
      }))
      .filter((r) => r.name || r.contact);
  }
  const refs: ApplicationReference[] = [];
  if (input.reference1?.trim()) {
    refs.push({ name: input.reference1.trim(), contact: input.reference1.trim() });
  }
  if (input.reference2?.trim()) {
    refs.push({ name: input.reference2.trim(), contact: input.reference2.trim() });
  }
  return refs;
}

function parseDocuments(json: unknown): ApplicationDocument[] {
  if (!Array.isArray(json)) return [];
  return (json as ApplicationDocument[]).map((d) => ({
    ...d,
    verificationStatus: d.verificationStatus ?? "pending",
  }));
}

function shapeDocumentsVerification(application: {
  documentsVerificationStatus: DocumentsVerificationStatus;
  documentsVerifiedAt: Date | null;
  documentsVerificationNotes: string | null;
  documents: unknown;
}) {
  const docs = parseDocuments(application.documents);
  const allVerified =
    docs.length > 0 && docs.every((d) => d.verificationStatus === "verified");
  return {
    status: application.documentsVerificationStatus,
    verifiedAt: application.documentsVerifiedAt?.toISOString() ?? null,
    notes: application.documentsVerificationNotes,
    allDocumentsVerified: allVerified,
    documents: docs,
  };
}

export function shapeApplicationSummary(application: {
  id: string;
  status: ApplicationStatus;
  moveInDate: Date | null;
  annualIncome: number | null;
  currentEmployment: string | null;
  references: unknown;
  message: string | null;
  documents: unknown;
  termsAcceptedAt: Date | null;
  property: { id: string; title: string; price: number; currency: string; rentalPeriod: string };
}) {
  const refs = Array.isArray(application.references)
    ? (application.references as ApplicationReference[])
    : [];
  const docs = parseDocuments(application.documents);
  return {
    id: application.id,
    status: application.status,
    property: {
      id: application.property.id,
      title: application.property.title,
      monthlyRent: application.property.price,
      monthlyRentLabel: formatMonthlyRent(application.property.price, application.property.currency),
      currency: application.property.currency,
      rentalPeriod: application.property.rentalPeriod,
    },
    moveInDate: application.moveInDate?.toISOString().slice(0, 10) ?? null,
    annualIncome: application.annualIncome ?? 0,
    currentEmployment: application.currentEmployment ?? null,
    references: refs,
    message: application.message,
    documents: docs,
    termsAccepted: Boolean(application.termsAcceptedAt),
    readyToSubmit:
      Boolean(application.annualIncome != null && application.currentEmployment) &&
      docs.some((d) => d.type === "government_id") &&
      docs.some((d) => d.type === "proof_of_income"),
  };
}

function validatePersonalInfo(input: ApplicationPersonalInfoInput, partial = false): void {
  const errors: { field: string; message: string }[] = [];

  if (input.moveInDate) {
    const d = new Date(input.moveInDate);
    if (Number.isNaN(d.getTime())) {
      errors.push({ field: "moveInDate", message: "moveInDate must be YYYY-MM-DD" });
    }
  }

  if (!partial || input.annualIncome != null) {
    const income = Number(input.annualIncome);
    if (input.annualIncome == null || !Number.isFinite(income) || income < 0) {
      errors.push({ field: "annualIncome", message: "annualIncome is required and must be a positive number" });
    }
  }

  if (!partial || input.currentEmployment != null) {
    const emp = input.currentEmployment?.trim() ?? "";
    if (!emp || emp.length < 2) {
      errors.push({
        field: "currentEmployment",
        message: "currentEmployment is required (at least 2 characters)",
      });
    }
  }

  const refs = parseReferences(input);
  if (!partial || input.reference1 != null || input.reference2 != null || input.references) {
    if (refs.length < 2) {
      errors.push({
        field: "references",
        message: "Two references are required (reference1 and reference2)",
      });
    }
  }

  if (errors.length) throw new ApplicationValidationException(errors);
}

export async function getPropertyApplyForm(
  propertyId: string,
  tenantId: number
): Promise<PropertyApplyFormResponse> {
  const property = await prisma.property.findUnique({ where: { id: propertyId } });
  if (!property) throw new Error("Property not found");
  if (property.moderationStatus !== "approved") {
    throw new Error("This property is not available for applications");
  }

  const existingDraft = await prisma.application.findFirst({
    where: {
      propertyId,
      tenantId,
      status: "draft",
    },
    include: { property: true },
  });

  return {
    property: {
      id: property.id,
      title: property.title,
      price: property.price,
      currency: property.currency,
      rentalPeriod: property.rentalPeriod,
      monthlyRentLabel: formatMonthlyRent(property.price, property.currency),
    },
    steps: [
      { id: "personal_info", title: "Personal Info", fields: PERSONAL_INFO_FIELDS },
      { id: "documents", title: "Documents", fields: DOCUMENT_FIELDS },
      { id: "review", title: "Review", fields: REVIEW_FIELDS },
    ],
    existingDraft: existingDraft
      ? {
          id: existingDraft.id,
          status: existingDraft.status,
          moveInDate: existingDraft.moveInDate?.toISOString().slice(0, 10) ?? null,
          annualIncome: existingDraft.annualIncome,
          currentEmployment: existingDraft.currentEmployment,
          references: (existingDraft.references as unknown as ApplicationReference[]) ?? [],
          message: existingDraft.message,
          documents: parseDocuments(existingDraft.documents),
          termsAccepted: Boolean(existingDraft.termsAcceptedAt),
        }
      : null,
  };
}

export async function getApplicationsByUser(tenantId: number, filters: ListApplicationsFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(50, Math.max(1, filters.limit ?? 20));
  const skip = (page - 1) * limit;

  const where = {
    tenantId,
    status: { not: "draft" as ApplicationStatus },
    ...(filters.status ? { status: filters.status } : {}),
  };

  const [total, applications] = await Promise.all([
    prisma.application.count({ where }),
    prisma.application.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: {
        property: true,
        tenant: { select: { id: true, name: true, surname: true, email: true } },
      },
    }),
  ]);

  return {
    applications: applications.map((a) => shapeApplicationSummary({ ...a, property: a.property })),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getApplicationById(id: string) {
  return prisma.application.findUnique({
    where: { id },
    include: {
      property: { include: { landlord: { select: { id: true, name: true, surname: true } } } },
      tenant: { select: { id: true, name: true, surname: true, email: true } },
    },
  });
}

export async function getApplicationForTenant(id: string, tenantId: number) {
  const application = await prisma.application.findFirst({
    where: { id, tenantId },
    include: { property: true },
  });
  if (!application) return null;
  return shapeApplicationSummary(application);
}

async function assertNoActiveApplication(propertyId: string, tenantId: number, excludeId?: string) {
  const existing = await prisma.application.findFirst({
    where: {
      propertyId,
      tenantId,
      status: { in: ["draft", "pending"] },
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });
  if (existing) {
    throw new ApplicationValidationException([
      {
        field: "propertyId",
        message:
          existing.status === "draft"
            ? "You already have a draft application for this property"
            : "You already have a pending application for this property",
      },
    ]);
  }
}

export async function createApplicationDraft(data: CreateApplicationDraftInput) {
  validatePersonalInfo(data);
  await assertNoActiveApplication(data.propertyId, data.tenantId);

  const property = await prisma.property.findUnique({ where: { id: data.propertyId } });
  if (!property) throw new Error("Property not found");

  const references = parseReferences(data);
  return prisma.application.create({
    data: {
      propertyId: data.propertyId,
      tenantId: data.tenantId,
      status: "draft",
      moveInDate: data.moveInDate ? new Date(data.moveInDate) : null,
      annualIncome: data.annualIncome != null ? Math.round(Number(data.annualIncome)) : null,
      currentEmployment: data.currentEmployment?.trim() ?? null,
      references: references as unknown as Prisma.InputJsonValue,
      message: data.message?.trim() ?? null,
      documents: [] as unknown as Prisma.InputJsonValue,
    },
    include: { property: true },
  });
}

export async function updateApplicationPersonalInfo(
  id: string,
  tenantId: number,
  input: ApplicationPersonalInfoInput
) {
  const application = await prisma.application.findFirst({ where: { id, tenantId } });
  if (!application) throw new Error("Application not found");
  if (application.status !== "draft") {
    throw new ApplicationValidationException([
      { field: "status", message: "Only draft applications can be updated" },
    ]);
  }

  validatePersonalInfo(input);
  const references = parseReferences(input);

  return prisma.application.update({
    where: { id },
    data: {
      moveInDate: input.moveInDate ? new Date(input.moveInDate) : application.moveInDate,
      annualIncome:
        input.annualIncome != null ? Math.round(Number(input.annualIncome)) : application.annualIncome,
      currentEmployment: input.currentEmployment?.trim() ?? application.currentEmployment,
      references: references as unknown as Prisma.InputJsonValue,
      message: input.message !== undefined ? input.message?.trim() ?? null : application.message,
    },
    include: { property: true },
  });
}

const FIELD_TO_DOC_TYPE: Record<string, ApplicationDocumentType> = {
  governmentId: "government_id",
  proofOfIncome: "proof_of_income",
  referenceLetters: "reference_letters",
};

export async function attachApplicationDocuments(
  id: string,
  tenantId: number,
  uploads: Array<{
    field: string;
    fileName: string;
    url: string;
    mimeType: string;
  }>
) {
  const application = await prisma.application.findFirst({ where: { id, tenantId } });
  if (!application) throw new Error("Application not found");
  if (application.status !== "draft") {
    throw new ApplicationValidationException([
      { field: "status", message: "Only draft applications accept document uploads" },
    ]);
  }

  const existing = parseDocuments(application.documents);
  const byType = new Map(existing.map((d) => [d.type, d]));

  for (const file of uploads) {
    const type = FIELD_TO_DOC_TYPE[file.field];
    if (!type) continue;
    byType.set(type, {
      type,
      fileName: file.fileName,
      url: file.url,
      mimeType: file.mimeType,
      uploadedAt: new Date().toISOString(),
    });
  }

  return prisma.application.update({
    where: { id },
    data: { documents: Array.from(byType.values()) as unknown as Prisma.InputJsonValue },
    include: { property: true },
  });
}

export async function submitApplication(id: string, tenantId: number, termsAccepted: boolean) {
  if (!termsAccepted) {
    throw new ApplicationValidationException([
      { field: "termsAccepted", message: "You must accept the terms and conditions to submit" },
    ]);
  }

  const application = await prisma.application.findFirst({
    where: { id, tenantId },
    include: { property: true },
  });
  if (!application) throw new Error("Application not found");
  if (application.status !== "draft") {
    throw new ApplicationValidationException([
      { field: "status", message: "Application has already been submitted" },
    ]);
  }

  validatePersonalInfo({
    moveInDate: application.moveInDate?.toISOString().slice(0, 10),
    annualIncome: application.annualIncome ?? undefined,
    currentEmployment: application.currentEmployment ?? undefined,
    references: (application.references as unknown as ApplicationReference[]) ?? [],
  });

  const docs = parseDocuments(application.documents);
  const errors: { field: string; message: string }[] = [];
  if (!docs.some((d) => d.type === "government_id")) {
    errors.push({ field: "governmentId", message: "Government ID is required" });
  }
  if (!docs.some((d) => d.type === "proof_of_income")) {
    errors.push({ field: "proofOfIncome", message: "Proof of income is required" });
  }
  if (errors.length) throw new ApplicationValidationException(errors);

  return prisma.application.update({
    where: { id },
    data: {
      status: "pending",
      termsAcceptedAt: new Date(),
    },
    include: { property: true, tenant: { select: { id: true, name: true, surname: true, email: true } } },
  });
}

/** One-shot submit (personal info + optional document URLs in body) — legacy/mobile simple flow */
export async function createApplication(data: {
  propertyId: string;
  tenantId: number;
  moveInDate?: Date;
  message?: string;
  documents?: object[];
  annualIncome?: number;
  currentEmployment?: string;
  references?: ApplicationReference[];
  termsAccepted?: boolean;
}) {
  if (data.termsAccepted) {
    const draft = await createApplicationDraft({
      propertyId: data.propertyId,
      tenantId: data.tenantId,
      moveInDate: data.moveInDate?.toISOString().slice(0, 10),
      annualIncome: data.annualIncome,
      currentEmployment: data.currentEmployment,
      references: data.references,
      message: data.message,
    });
    if (data.documents?.length) {
      await prisma.application.update({
        where: { id: draft.id },
        data: { documents: data.documents as Prisma.InputJsonValue },
      });
    }
    return submitApplication(draft.id, data.tenantId, true);
  }

  return prisma.application.create({
    data: {
      propertyId: data.propertyId,
      tenantId: data.tenantId,
      status: "pending",
      moveInDate: data.moveInDate ?? null,
      message: data.message ?? null,
      annualIncome: data.annualIncome ?? null,
      currentEmployment: data.currentEmployment ?? null,
      references: (data.references ?? []) as unknown as Prisma.InputJsonValue,
      documents: (data.documents ?? []) as Prisma.InputJsonValue,
      termsAcceptedAt: new Date(),
    },
    include: {
      property: true,
      tenant: { select: { id: true, name: true, surname: true, email: true } },
    },
  });
}

export interface AdminListApplicationsFilters {
  status?: ApplicationStatus;
  propertyId?: string;
  landlordId?: number;
  tenantId?: number;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: "createdAt" | "updatedAt" | "status";
  sortOrder?: "asc" | "desc";
  includeDrafts?: boolean;
}

const applicationIncludeAdmin = {
  property: {
    include: {
      landlord: { select: { id: true, name: true, surname: true, email: true } },
    },
  },
  tenant: { select: { id: true, name: true, surname: true, email: true, appRole: true } },
} as const;

function shapeAdminApplicationRow(application: {
  id: string;
  status: ApplicationStatus;
  documentsVerificationStatus?: DocumentsVerificationStatus;
  moveInDate: Date | null;
  annualIncome: number | null;
  currentEmployment: string | null;
  message: string | null;
  reviewNotes: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  property: { id: string; title: string; price: number; currency: string };
  tenant: { id: number; name: string; surname: string; email: string };
}) {
  return {
    id: application.id,
    status: application.status,
    documentsVerificationStatus: application.documentsVerificationStatus ?? "pending",
    submittedAt: application.createdAt.toISOString(),
    updatedAt: application.updatedAt.toISOString(),
    moveInDate: application.moveInDate?.toISOString().slice(0, 10) ?? null,
    annualIncome: application.annualIncome,
    currentEmployment: application.currentEmployment,
    tenantMessage: application.message,
    reviewNotes: application.reviewNotes,
    reviewedAt: application.reviewedAt?.toISOString() ?? null,
    property: {
      id: application.property.id,
      title: application.property.title,
      monthlyRentLabel: formatMonthlyRent(application.property.price, application.property.currency),
    },
    tenant: {
      id: application.tenant.id,
      name: `${application.tenant.name} ${application.tenant.surname}`.trim(),
      email: application.tenant.email,
    },
  };
}

export function shapeAdminApplicationDetail(application: {
  id: string;
  status: ApplicationStatus;
  moveInDate: Date | null;
  annualIncome: number | null;
  currentEmployment: string | null;
  message: string | null;
  references: unknown;
  documents: unknown;
  documentsVerificationStatus: DocumentsVerificationStatus;
  documentsVerifiedAt: Date | null;
  documentsVerificationNotes: string | null;
  termsAcceptedAt: Date | null;
  reviewNotes: string | null;
  reviewedAt: Date | null;
  reviewedById: number | null;
  createdAt: Date;
  updatedAt: Date;
  property: {
    id: string;
    title: string;
    price: number;
    currency: string;
    rentalPeriod: string;
    location: unknown;
    landlord: { id: number; name: string; surname: string; email: string };
  };
  tenant: { id: number; name: string; surname: string; email: string; appRole: string | null };
}) {
  const docs = parseDocuments(application.documents);
  const refs = Array.isArray(application.references)
    ? (application.references as ApplicationReference[])
    : [];

  return {
    ...shapeAdminApplicationRow({
      ...application,
      property: {
        id: application.property.id,
        title: application.property.title,
        price: application.property.price,
        currency: application.property.currency,
      },
      tenant: application.tenant,
    }),
    property: {
      id: application.property.id,
      title: application.property.title,
      monthlyRent: application.property.price,
      monthlyRentLabel: formatMonthlyRent(application.property.price, application.property.currency),
      currency: application.property.currency,
      rentalPeriod: application.property.rentalPeriod,
      location: application.property.location,
      landlord: {
        id: application.property.landlord.id,
        name: `${application.property.landlord.name} ${application.property.landlord.surname}`.trim(),
        email: application.property.landlord.email,
      },
    },
    tenant: {
      id: application.tenant.id,
      name: `${application.tenant.name} ${application.tenant.surname}`.trim(),
      email: application.tenant.email,
      role: application.tenant.appRole,
    },
    references: refs,
    documents: docs,
    documentsVerification: shapeDocumentsVerification(application),
    termsAccepted: Boolean(application.termsAcceptedAt),
    termsAcceptedAt: application.termsAcceptedAt?.toISOString() ?? null,
    reviewedById: application.reviewedById,
  };
}

/** Admin/vendor: update application-level document verification (external vendor workflow). */
export async function updateDocumentsVerification(
  applicationId: string,
  data: {
    status: DocumentsVerificationStatus;
    notes?: string;
    documentUpdates?: Array<{ type: ApplicationDocument["type"]; verificationStatus: string }>;
  }
) {
  const application = await prisma.application.findUnique({ where: { id: applicationId } });
  if (!application) throw new ApplicationDecisionException("Application not found");

  let documents = parseDocuments(application.documents);
  if (data.documentUpdates?.length) {
    const byType = new Map(documents.map((d) => [d.type, d]));
    for (const u of data.documentUpdates) {
      const doc = byType.get(u.type);
      if (doc) {
        byType.set(u.type, {
          ...doc,
          verificationStatus: u.verificationStatus as ApplicationDocument["verificationStatus"],
        });
      }
    }
    documents = Array.from(byType.values());
  }

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: {
      documentsVerificationStatus: data.status,
      documentsVerificationNotes: data.notes?.trim() || null,
      documentsVerifiedAt:
        data.status === "verified" || data.status === "partial" ? new Date() : application.documentsVerifiedAt,
      documents: documents as unknown as Prisma.InputJsonValue,
    },
    include: applicationIncludeAdmin,
  });

  return shapeAdminApplicationDetail(updated);
}

export async function listApplicationsForAdmin(filters: AdminListApplicationsFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 20));
  const skip = (page - 1) * limit;
  const sortBy = filters.sortBy ?? "createdAt";
  const sortOrder = filters.sortOrder ?? "desc";

  const statusFilter = filters.status
    ? { status: filters.status }
    : filters.includeDrafts
      ? {}
      : { status: { not: "draft" as ApplicationStatus } };

  const where: Prisma.ApplicationWhereInput = {
    ...statusFilter,
    ...(filters.propertyId ? { propertyId: filters.propertyId } : {}),
    ...(filters.tenantId ? { tenantId: filters.tenantId } : {}),
    ...(filters.landlordId ? { property: { landlordId: filters.landlordId } } : {}),
    ...(filters.search
      ? {
          OR: [
            { tenant: { email: { contains: filters.search, mode: "insensitive" } } },
            { tenant: { name: { contains: filters.search, mode: "insensitive" } } },
            { tenant: { surname: { contains: filters.search, mode: "insensitive" } } },
            { property: { title: { contains: filters.search, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [total, rows] = await Promise.all([
    prisma.application.count({ where }),
    prisma.application.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortBy]: sortOrder },
      include: applicationIncludeAdmin,
    }),
  ]);

  return {
    applications: rows.map(shapeAdminApplicationRow),
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

export async function getApplicationForAdmin(id: string) {
  const application = await prisma.application.findUnique({
    where: { id },
    include: applicationIncludeAdmin,
  });
  if (!application) return null;
  return shapeAdminApplicationDetail(application);
}

export async function listApplicationsForLandlord(landlordId: number, filters: AdminListApplicationsFilters = {}) {
  return listApplicationsForAdmin({ ...filters, landlordId, includeDrafts: false });
}

export class ApplicationDecisionException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApplicationDecisionException";
  }
}

/** Admin or property landlord may approve/reject a pending application */
export async function reviewApplicationDecision(
  applicationId: string,
  actor: { id: number; appRole: string | null },
  decision: "approved" | "rejected",
  reviewNotes?: string
) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: { property: { select: { landlordId: true } } },
  });

  if (!application) throw new ApplicationDecisionException("Application not found");

  const isAdmin = actor.appRole === "admin";
  const isLandlord = actor.appRole === "landlord" && application.property.landlordId === actor.id;

  if (!isAdmin && !isLandlord) {
    throw new ApplicationDecisionException(
      "Only an admin or the property landlord can approve or reject this application"
    );
  }

  if (application.status !== "pending") {
    throw new ApplicationDecisionException(
      `Only pending applications can be reviewed (current status: ${application.status})`
    );
  }

  const updated = await prisma.application.update({
    where: { id: applicationId },
    data: {
      status: decision,
      reviewNotes: reviewNotes?.trim() || null,
      reviewedAt: new Date(),
      reviewedById: actor.id,
    },
    include: applicationIncludeAdmin,
  });

  if (decision === "approved") {
    await leaseService.createLeaseFromApprovedApplication(applicationId);
  }

  return shapeAdminApplicationDetail(updated);
}

/** @deprecated Use reviewApplicationDecision */
export async function updateApplicationStatus(
  id: string,
  status: ApplicationStatus,
  message?: string
) {
  return prisma.application.update({
    where: { id },
    data: { status, ...(message ? { message } : {}) },
    include: {
      property: true,
      tenant: { select: { id: true, name: true, surname: true, email: true } },
    },
  });
}
