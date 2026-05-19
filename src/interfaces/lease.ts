import type { LeaseStatus } from "@prisma/client";

export interface LeaseSummary {
  id: string;
  status: LeaseStatus;
  propertyId: string;
  propertyTitle: string;
  startDate: string;
  endDate: string | null;
  monthlyRent: number;
  monthlyRentLabel: string;
  currency: string;
  agreementUrl: string | null;
  agreementNotes: string | null;
  tenant?: { id: number; name: string; email: string };
  landlord?: { id: number; name: string; email: string };
}
