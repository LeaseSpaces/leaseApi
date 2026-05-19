/* eslint-disable */
import { prisma } from "../config/prisma";
import type { MaintenancePriority, MaintenanceStatus, Prisma } from "@prisma/client";
import type { MaintenanceRequestInput, MaintenanceRequestSummary } from "../interfaces/maintenance";

const includeProperty = {
  property: { select: { id: true, title: true } },
  tenant: { select: { id: true, name: true, surname: true, email: true } },
} as const;

function shapeRow(row: {
  id: string;
  propertyId: string;
  title: string;
  description: string;
  status: MaintenanceStatus;
  priority: MaintenancePriority;
  images: string[];
  createdAt: Date;
  resolvedAt: Date | null;
  property: { id: string; title: string };
  tenant: { id: number; name: string; surname: string; email: string };
}): MaintenanceRequestSummary {
  return {
    id: row.id,
    propertyId: row.propertyId,
    propertyTitle: row.property.title,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    images: row.images,
    createdAt: row.createdAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
    tenant: {
      id: row.tenant.id,
      name: `${row.tenant.name} ${row.tenant.surname}`.trim(),
      email: row.tenant.email,
    },
  };
}

export class MaintenanceValidationException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MaintenanceValidationException";
  }
}

/** Tenant must have an active lease on the property to report maintenance. */
export async function createMaintenanceRequest(tenantId: number, input: MaintenanceRequestInput) {
  const title = input.title?.trim();
  const description = input.description?.trim();
  if (!title || title.length < 3) {
    throw new MaintenanceValidationException("title is required (min 3 characters)");
  }
  if (!description || description.length < 10) {
    throw new MaintenanceValidationException("description is required (min 10 characters)");
  }

  const lease = await prisma.lease.findFirst({
    where: { propertyId: input.propertyId, tenantId, status: "active" },
    include: { property: { select: { landlordId: true, availabilityStatus: true } } },
  });

  if (!lease) {
    throw new MaintenanceValidationException(
      "You can only report maintenance for a property you are currently renting"
    );
  }

  const row = await prisma.maintenanceRequest.create({
    data: {
      propertyId: input.propertyId,
      tenantId,
      landlordId: lease.property.landlordId,
      leaseId: lease.id,
      title,
      description,
      priority: input.priority ?? "medium",
      images: input.images ?? [],
    },
    include: includeProperty,
  });

  return shapeRow(row);
}

export async function listMaintenanceForTenant(tenantId: number, filters?: { status?: MaintenanceStatus }) {
  const rows = await prisma.maintenanceRequest.findMany({
    where: { tenantId, ...(filters?.status ? { status: filters.status } : {}) },
    orderBy: { createdAt: "desc" },
    include: includeProperty,
  });
  return rows.map(shapeRow);
}

export async function listMaintenanceForLandlord(
  landlordId: number,
  filters?: { status?: MaintenanceStatus; propertyId?: string }
) {
  const rows = await prisma.maintenanceRequest.findMany({
    where: {
      landlordId,
      ...(filters?.status ? { status: filters.status } : {}),
      ...(filters?.propertyId ? { propertyId: filters.propertyId } : {}),
    },
    orderBy: { createdAt: "desc" },
    include: includeProperty,
  });
  return rows.map(shapeRow);
}

export async function getMaintenanceById(id: string) {
  const row = await prisma.maintenanceRequest.findUnique({
    where: { id },
    include: includeProperty,
  });
  if (!row) return null;
  return shapeRow(row);
}

export async function updateMaintenanceStatus(
  id: string,
  landlordId: number,
  status: MaintenanceStatus
) {
  const row = await prisma.maintenanceRequest.findFirst({
    where: { id, landlordId },
  });
  if (!row) throw new MaintenanceValidationException("Maintenance request not found");

  const updated = await prisma.maintenanceRequest.update({
    where: { id },
    data: {
      status,
      resolvedAt: status === "resolved" || status === "closed" ? new Date() : null,
    },
    include: includeProperty,
  });
  return shapeRow(updated);
}
