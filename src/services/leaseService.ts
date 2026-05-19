/* eslint-disable */
import { prisma } from "../config/prisma";
import type { LeaseStatus, Prisma } from "@prisma/client";
import type { LeaseSummary } from "../interfaces/lease";

function formatMonthlyRent(price: number, currency: string): string {
  const symbol = currency === "ZAR" ? "R" : currency;
  return `${symbol}${price.toLocaleString("en-ZA")}`;
}

const leaseInclude = {
  property: { select: { id: true, title: true, price: true, currency: true, landlordId: true } },
  tenant: { select: { id: true, name: true, surname: true, email: true } },
  landlord: { select: { id: true, name: true, surname: true, email: true } },
} as const;

export function shapeLease(
  lease: {
    id: string;
    status: LeaseStatus;
    propertyId: string;
    startDate: Date;
    endDate: Date | null;
    monthlyRent: number;
    currency: string;
    agreementUrl: string | null;
    agreementNotes: string | null;
    property: { id: string; title: string };
    tenant?: { id: number; name: string; surname: string; email: string };
    landlord?: { id: number; name: string; surname: string; email: string };
  }
): LeaseSummary {
  return {
    id: lease.id,
    status: lease.status,
    propertyId: lease.propertyId,
    propertyTitle: lease.property.title,
    startDate: lease.startDate.toISOString().slice(0, 10),
    endDate: lease.endDate?.toISOString().slice(0, 10) ?? null,
    monthlyRent: lease.monthlyRent,
    monthlyRentLabel: formatMonthlyRent(lease.monthlyRent, lease.currency),
    currency: lease.currency,
    agreementUrl: lease.agreementUrl,
    agreementNotes: lease.agreementNotes,
    tenant: lease.tenant
      ? {
          id: lease.tenant.id,
          name: `${lease.tenant.name} ${lease.tenant.surname}`.trim(),
          email: lease.tenant.email,
        }
      : undefined,
    landlord: lease.landlord
      ? {
          id: lease.landlord.id,
          name: `${lease.landlord.name} ${lease.landlord.surname}`.trim(),
          email: lease.landlord.email,
        }
      : undefined,
  };
}

/** Create active lease when application is approved; mark property occupied. */
export async function createLeaseFromApprovedApplication(applicationId: string) {
  const application = await prisma.application.findUnique({
    where: { id: applicationId },
    include: {
      property: { select: { id: true, landlordId: true, price: true, currency: true, title: true } },
    },
  });
  if (!application || application.status !== "approved") {
    throw new Error("Application must be approved to create a lease");
  }

  const existing = await prisma.lease.findUnique({ where: { applicationId } });
  if (existing) return existing;

  const startDate = application.moveInDate ?? new Date();
  const defaultAgreementUrl =
    process.env.DEFAULT_LEASE_AGREEMENT_URL ||
    "https://leasespaces.local/documents/sample-lease-agreement.pdf";

  const [lease] = await prisma.$transaction([
    prisma.lease.create({
      data: {
        propertyId: application.propertyId,
        tenantId: application.tenantId,
        landlordId: application.property.landlordId,
        applicationId: application.id,
        status: "active",
        startDate,
        monthlyRent: application.property.price,
        currency: application.property.currency,
        agreementUrl: defaultAgreementUrl,
        agreementNotes: "Standard LeaseSpaces rental agreement. Contact support for signed copies.",
      },
      include: leaseInclude,
    }),
    prisma.property.update({
      where: { id: application.propertyId },
      data: { availabilityStatus: "occupied", status: "occupied" },
    }),
  ]);

  return lease;
}

export async function listLeasesForTenant(tenantId: number, status?: LeaseStatus) {
  const where: Prisma.LeaseWhereInput = {
    tenantId,
    ...(status ? { status } : {}),
  };
  const leases = await prisma.lease.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: leaseInclude,
  });
  return leases.map(shapeLease);
}

export async function listLeasesForLandlord(landlordId: number, status?: LeaseStatus) {
  const where: Prisma.LeaseWhereInput = {
    landlordId,
    ...(status ? { status } : {}),
  };
  const leases = await prisma.lease.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: leaseInclude,
  });
  return leases.map(shapeLease);
}

export async function getLeaseById(leaseId: string) {
  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    include: leaseInclude,
  });
  if (!lease) return null;
  return shapeLease(lease);
}

export async function getActiveLeaseForProperty(propertyId: string, userId: number, role: string) {
  const where: Prisma.LeaseWhereInput = { propertyId, status: "active" };
  if (role === "tenant") where.tenantId = userId;
  else if (role === "landlord") where.landlordId = userId;

  const lease = await prisma.lease.findFirst({
    where,
    include: leaseInclude,
  });
  if (!lease) return null;
  return shapeLease(lease);
}

export async function getLeaseForUser(leaseId: string, userId: number, role: string) {
  const lease = await prisma.lease.findUnique({
    where: { id: leaseId },
    include: leaseInclude,
  });
  if (!lease) return null;
  if (role === "admin") return shapeLease(lease);
  if (lease.tenantId !== userId && lease.landlordId !== userId) return null;
  return shapeLease(lease);
}
