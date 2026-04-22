/* eslint-disable */
import { prisma } from "../config/prisma";
import {
  ApplicationStatus,
  Prisma,
  PropertyAvailabilityStatus,
  PropertyModerationStatus,
} from "@prisma/client";

export interface PropertyFilters {
  page?: number;
  limit?: number;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  propertyType?: string;
  bedrooms?: number;
  bathrooms?: number;
  rentalType?: string;
  amenities?: string[];
  sortBy?: "price" | "date" | "location";
  sortOrder?: "asc" | "desc";
}

export interface AdminPropertyFilters {
  q?: string;
  page?: number;
  limit?: number;
  location?: string;
  minPrice?: number;
  maxPrice?: number;
  rentalType?: string;
  moderationStatus?: PropertyModerationStatus;
  availabilityStatus?: PropertyAvailabilityStatus;
  sortBy?: "price" | "createdAt" | "moderationStatus" | "title";
  sortOrder?: "asc" | "desc";
}

export async function getProperties(filters: PropertyFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(50, Math.max(1, filters.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Prisma.PropertyWhereInput = {};
  if (filters.minPrice != null) where.price = { gte: filters.minPrice };
  if (filters.maxPrice != null) where.price = { ...(where.price as object || {}), lte: filters.maxPrice };
  if (filters.propertyType) where.propertyType = filters.propertyType;
  if (filters.bedrooms != null) where.bedrooms = filters.bedrooms;
  if (filters.bathrooms != null) where.bathrooms = filters.bathrooms;
  if (filters.rentalType) where.rentalType = filters.rentalType;
  if (filters.location) {
    where.location = { path: ["city"], equals: filters.location } as Prisma.JsonFilter;
  }
  if (filters.amenities?.length) {
    where.amenities = { hasEvery: filters.amenities };
  }

  const orderBy: Prisma.PropertyOrderByWithRelationInput =
    filters.sortBy === "price"
      ? { price: filters.sortOrder ?? "desc" }
      : filters.sortBy === "location"
        ? { title: filters.sortOrder ?? "asc" }
        : { createdAt: filters.sortOrder ?? "desc" };

  const [total, properties] = await Promise.all([
    prisma.property.count({ where }),
    prisma.property.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        landlord: {
          select: { id: true, name: true, surname: true, email: true },
        },
      },
    }),
  ]);

  return {
    properties: properties.map((p) => ({
      ...p,
      landlord: p.landlord
        ? {
            id: p.landlord.id,
            name: `${p.landlord.name} ${p.landlord.surname}`.trim(),
            avatar: null,
            verified: false,
          }
        : null,
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function adminGetProperties(filters: AdminPropertyFilters = {}) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(50, Math.max(1, filters.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Prisma.PropertyWhereInput = {};
  if (filters.minPrice != null) where.price = { gte: filters.minPrice };
  if (filters.maxPrice != null) where.price = { ...(where.price as object || {}), lte: filters.maxPrice };
  if (filters.rentalType) where.rentalType = String(filters.rentalType).trim().toLowerCase();
  if (filters.location) {
    where.location = { path: ["city"], equals: filters.location } as Prisma.JsonFilter;
  }
  if (filters.moderationStatus) where.moderationStatus = filters.moderationStatus;
  if (filters.availabilityStatus) where.availabilityStatus = filters.availabilityStatus;

  const q = String(filters.q ?? "").trim();
  if (q) {
    where.OR = [
      { title: { contains: q, mode: "insensitive" } },
      { landlord: { name: { contains: q, mode: "insensitive" } } },
      { landlord: { surname: { contains: q, mode: "insensitive" } } },
      // JSON search support varies; keep city equality for safety.
      { location: { path: ["city"], equals: q } as Prisma.JsonFilter },
    ];
  }

  const sortOrder = filters.sortOrder ?? "desc";
  const orderBy: Prisma.PropertyOrderByWithRelationInput =
    filters.sortBy === "price"
      ? { price: sortOrder }
      : filters.sortBy === "title"
        ? { title: sortOrder }
        : filters.sortBy === "moderationStatus"
          ? { moderationStatus: sortOrder }
          : { createdAt: sortOrder };

  const [total, properties] = await Promise.all([
    prisma.property.count({ where }),
    prisma.property.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        landlord: {
          select: { id: true, name: true, surname: true, email: true },
        },
      },
    }),
  ]);

  return {
    properties,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function adminGetPropertyById(id: string) {
  return prisma.property.findUnique({
    where: { id },
    include: {
      landlord: {
        select: { id: true, name: true, surname: true, email: true },
      },
    },
  });
}

export async function adminUpdateModeration(
  id: string,
  data: { moderationStatus: PropertyModerationStatus; moderationNotes: string | null }
) {
  return prisma.property.update({
    where: { id },
    data: {
      moderationStatus: data.moderationStatus,
      moderationNotes: data.moderationNotes,
    },
    include: {
      landlord: { select: { id: true, name: true, surname: true, email: true } },
    },
  });
}

export async function adminUpdateAvailability(id: string, availabilityStatus: PropertyAvailabilityStatus) {
  return prisma.property.update({
    where: { id },
    data: {
      availabilityStatus,
      // Keep legacy field in sync for older clients.
      status: availabilityStatus,
    },
    include: {
      landlord: { select: { id: true, name: true, surname: true, email: true } },
    },
  });
}

export async function getPropertyById(id: string) {
  const property = await prisma.property.findUnique({
    where: { id },
    include: {
      landlord: {
        select: { id: true, name: true, surname: true, email: true },
      },
    },
  });
  if (!property) return null;
  return {
    ...property,
    landlord: property.landlord
      ? {
          id: property.landlord.id,
          name: `${property.landlord.name} ${property.landlord.surname}`.trim(),
          avatar: null,
          verified: false,
        }
      : null,
  };
}

export async function createProperty(data: {
  title: string;
  description?: string;
  price: number;
  currency?: string;
  propertyType: string;
  rentalType: string;
  rentalPeriod?: string;
  bedrooms: number;
  bathrooms: number;
  area?: number;
  location: object;
  amenities?: string[];
  images?: string[];
  landlordId: number;
  availableDate?: Date;
}) {
  return prisma.property.create({
    data: {
      title: data.title,
      description: data.description ?? null,
      price: data.price,
      currency: data.currency ?? "ZAR",
      propertyType: data.propertyType,
      rentalType: String(data.rentalType).trim().toLowerCase(),
      rentalPeriod: data.rentalPeriod ?? "monthly",
      bedrooms: data.bedrooms,
      bathrooms: data.bathrooms,
      area: data.area ?? null,
      location: data.location as Prisma.InputJsonValue,
      amenities: data.amenities ?? [],
      images: data.images ?? [],
      landlordId: data.landlordId,
      availableDate: data.availableDate ?? null,
      // Defaults: pending approval + available. Keep legacy status aligned.
      status: "available",
      availabilityStatus: "available",
      moderationStatus: "pending_approval",
    },
    include: { landlord: { select: { id: true, name: true, surname: true } } },
  });
}

export async function updateProperty(id: string, data: Prisma.PropertyUpdateInput) {
  return prisma.property.update({
    where: { id },
    data,
    include: { landlord: { select: { id: true, name: true, surname: true } } },
  });
}

export async function deleteProperty(id: string) {
  return prisma.property.delete({ where: { id } });
}

export async function searchProperties(body: {
  query?: string;
  filters?: PropertyFilters;
  location?: { city?: string; radius?: number };
  sortBy?: string;
  sortOrder?: string;
}) {
  const filters: PropertyFilters = {
    ...body.filters,
    sortBy: (body.sortBy as "price" | "date" | "location") ?? "date",
    sortOrder: (body.sortOrder as "asc" | "desc") ?? "desc",
  };
  if (body.query) {
    filters.location = body.query;
  }
  return getProperties(filters);
}
