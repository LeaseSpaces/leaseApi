/* eslint-disable */
import { prisma } from "../config/prisma";

export class FavoriteNotFoundException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FavoriteNotFoundException";
  }
}

function shapeLandlord(landlord: { id: number; name: string; surname: string; email: string } | null) {
  if (!landlord) return null;
  return {
    id: landlord.id,
    name: `${landlord.name} ${landlord.surname}`.trim(),
    avatar: null,
    verified: false,
  };
}

function shapeProperty(
  property: {
    id: string;
    title: string;
    description: string | null;
    price: number;
    currency: string;
    propertyType: string;
    rentalType: string;
    rentalPeriod: string;
    bedrooms: number;
    bathrooms: number;
    area: number | null;
    location: unknown;
    amenities: string[];
    images: string[];
    landlordId: number;
    availableDate: Date | null;
    status: string;
    availabilityStatus: string;
    moderationStatus: string;
    createdAt: Date;
    updatedAt: Date;
    landlord: { id: number; name: string; surname: string; email: string } | null;
  },
  favoritedAt?: Date
) {
  return {
    ...property,
    landlord: shapeLandlord(property.landlord),
    favoritedAt: favoritedAt?.toISOString() ?? undefined,
    isFavorited: true,
  };
}

const propertyInclude = {
  landlord: { select: { id: true, name: true, surname: true, email: true } },
} as const;

async function assertPropertyExists(propertyId: string) {
  const property = await prisma.property.findUnique({
    where: { id: propertyId },
    select: { id: true },
  });
  if (!property) throw new FavoriteNotFoundException("Property not found");
}

/** POST /api/favorites — add (idempotent) */
export async function addFavorite(userId: number, propertyId: string) {
  await assertPropertyExists(propertyId);
  const favorite = await prisma.propertyFavorite.upsert({
    where: { userId_propertyId: { userId, propertyId } },
    create: { userId, propertyId },
    update: {},
    include: { property: { include: propertyInclude } },
  });
  return {
    favorited: true,
    favorite: {
      id: favorite.id,
      propertyId: favorite.propertyId,
      createdAt: favorite.createdAt.toISOString(),
    },
    property: shapeProperty(favorite.property, favorite.createdAt),
  };
}

/** DELETE /api/favorites/:propertyId */
export async function removeFavorite(userId: number, propertyId: string) {
  const existing = await prisma.propertyFavorite.findUnique({
    where: { userId_propertyId: { userId, propertyId } },
  });
  if (!existing) {
    return { favorited: false, propertyId };
  }
  await prisma.propertyFavorite.delete({ where: { id: existing.id } });
  return { favorited: false, propertyId };
}

/** POST /api/favorites/toggle — heart icon */
export async function toggleFavorite(userId: number, propertyId: string) {
  await assertPropertyExists(propertyId);
  const existing = await prisma.propertyFavorite.findUnique({
    where: { userId_propertyId: { userId, propertyId } },
  });
  if (existing) {
    await prisma.propertyFavorite.delete({ where: { id: existing.id } });
    return { favorited: false, propertyId };
  }
  const favorite = await prisma.propertyFavorite.create({
    data: { userId, propertyId },
    include: { property: { include: propertyInclude } },
  });
  return {
    favorited: true,
    propertyId,
    favorite: {
      id: favorite.id,
      propertyId: favorite.propertyId,
      createdAt: favorite.createdAt.toISOString(),
    },
    property: shapeProperty(favorite.property, favorite.createdAt),
  };
}

/** GET /api/favorites */
export async function listFavorites(userId: number, opts: { page?: number; limit?: number } = {}) {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(50, Math.max(1, opts.limit ?? 20));
  const skip = (page - 1) * limit;

  const where = { userId };
  const [total, rows] = await Promise.all([
    prisma.propertyFavorite.count({ where }),
    prisma.propertyFavorite.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { property: { include: propertyInclude } },
    }),
  ]);

  return {
    favorites: rows.map((row) => ({
      id: row.id,
      propertyId: row.propertyId,
      createdAt: row.createdAt.toISOString(),
      property: shapeProperty(row.property, row.createdAt),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

/** GET /api/favorites/check?propertyIds=a,b,c */
export async function checkFavorites(userId: number, propertyIds: string[]) {
  const ids = [...new Set(propertyIds.filter(Boolean))];
  if (!ids.length) {
    return { propertyIds: [] as string[], favorited: {} as Record<string, boolean> };
  }
  const rows = await prisma.propertyFavorite.findMany({
    where: { userId, propertyId: { in: ids } },
    select: { propertyId: true },
  });
  const favoritedSet = new Set(rows.map((r) => r.propertyId));
  const favorited: Record<string, boolean> = {};
  for (const id of ids) {
    favorited[id] = favoritedSet.has(id);
  }
  return {
    propertyIds: [...favoritedSet],
    favorited,
  };
}

/** GET /api/favorites/:propertyId/status */
export async function getFavoriteStatus(userId: number, propertyId: string) {
  const row = await prisma.propertyFavorite.findUnique({
    where: { userId_propertyId: { userId, propertyId } },
  });
  return {
    propertyId,
    favorited: Boolean(row),
    favoriteId: row?.id ?? null,
    favoritedAt: row?.createdAt.toISOString() ?? null,
  };
}
