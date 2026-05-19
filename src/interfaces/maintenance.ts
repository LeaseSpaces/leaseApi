import type { MaintenancePriority, MaintenanceStatus } from "@prisma/client";

export interface MaintenanceRequestInput {
  propertyId: string;
  title: string;
  description: string;
  priority?: MaintenancePriority;
  images?: string[];
}

export interface MaintenanceRequestSummary {
  id: string;
  propertyId: string;
  propertyTitle: string;
  title: string;
  description: string;
  status: MaintenanceStatus;
  priority: MaintenancePriority;
  images: string[];
  createdAt: string;
  resolvedAt: string | null;
  tenant?: { id: number; name: string; email: string };
}
