/* eslint-disable */
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { ApplicationStatus } from "@prisma/client";

export interface ListApplicationsFilters {
  status?: ApplicationStatus;
  page?: number;
  limit?: number;
}

export async function getApplicationsByUser(tenantId: number, filters: ListApplicationsFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(50, Math.max(1, filters.limit ?? 20));
  const skip = (page - 1) * limit;

  const where = { tenantId, ...(filters.status ? { status: filters.status } : {}) };

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
    applications,
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

export async function createApplication(data: {
  propertyId: string;
  tenantId: number;
  moveInDate?: Date;
  message?: string;
  documents?: object[];
}) {
  return prisma.application.create({
    data: {
      propertyId: data.propertyId,
      tenantId: data.tenantId,
      status: "pending",
      moveInDate: data.moveInDate ?? null,
      message: data.message ?? null,
      documents: (data.documents ?? []) as Prisma.InputJsonValue,
    },
    include: {
      property: true,
      tenant: { select: { id: true, name: true, surname: true, email: true } },
    },
  });
}

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
