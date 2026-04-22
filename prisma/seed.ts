/* eslint-disable */
/**
 * Seed script to create an initial admin user (username + password).
 * Run: npx prisma db seed (or: npx ts-node prisma/seed.ts)
 *
 * Admin is created only via this seed or similar backend process — no Google signup.
 */
import {
  PrismaClient,
  PropertyAvailabilityStatus,
  PropertyModerationStatus,
} from "@prisma/client";
import { hashPassword } from "../src/utils/password";

const prisma = new PrismaClient();

const ADMIN_EMAIL = process.env.ADMIN_SEED_EMAIL || "admin@leasespaces.local";
const ADMIN_PASSWORD = process.env.ADMIN_SEED_PASSWORD || "ChangeMeInProduction!";

async function main() {
  const role = await prisma.role.upsert({
    where: { id: 1 },
    create: { id: 1, description: "Default" },
    update: {},
  });

  // 1) Seed super admin (idempotent)
  const existingAdmin = await prisma.user.findUnique({
    where: { email: ADMIN_EMAIL },
  });

  if (!existingAdmin) {
    const hashed = hashPassword(ADMIN_PASSWORD);
    await prisma.user.create({
      data: {
        name: "Admin",
        surname: "User",
        email: ADMIN_EMAIL,
        password: hashed,
        roleId: role.id,
        registrationType: "EMAIL",
        socialUserId: `admin-${ADMIN_EMAIL}-${Date.now()}`,
        appRole: "admin",
        isSuperAdmin: true,
        admin: { create: {} },
      } as any,
    });

    console.log("Super admin user created. Email (username):", ADMIN_EMAIL);
    console.log("Password:", ADMIN_PASSWORD);
    console.log("Change password after first login or set ADMIN_SEED_PASSWORD env.");
  } else {
    console.log("Super admin user already exists:", ADMIN_EMAIL);
  }

  // 1b) Seed requested super admins (idempotent)
  const superAdmins = [
    { name: "Gugu", surname: "Admin", email: "gugu.admin@leasespaces.local", password: "GuguSuper#2026" },
    { name: "Kgabo", surname: "Admin", email: "kgabo.admin@leasespaces.local", password: "KgaboSuper#2026" },
    { name: "Maele", surname: "Admin", email: "maele.admin@leasespaces.local", password: "MaeleSuper#2026" },
  ];
  for (const s of superAdmins) {
    const existing = await prisma.user.findUnique({ where: { email: s.email } });
    if (existing) {
      await prisma.user.update({
        where: { email: s.email },
        data: {
          name: s.name,
          surname: s.surname,
          password: hashPassword(s.password),
          appRole: "admin",
          isSuperAdmin: true,
          roleId: role.id,
          registrationType: "EMAIL",
        } as any,
      });
      await prisma.admin.upsert({ where: { userId: existing.id }, update: {}, create: { userId: existing.id } });
      continue;
    }
    const created = await prisma.user.create({
      data: {
        name: s.name,
        surname: s.surname,
        email: s.email,
        password: hashPassword(s.password),
        roleId: role.id,
        registrationType: "EMAIL",
        socialUserId: `admin-${s.email}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        appRole: "admin",
        isSuperAdmin: true,
      } as any,
    });
    await prisma.admin.create({ data: { userId: created.id } });
  }

  // 2) Seed landlords (idempotent)
  const landlordsSeed = [
    { name: "John", surname: "Doe", email: "john.landlord@leasespaces.local" },
    { name: "Jane", surname: "Smith", email: "jane.landlord@leasespaces.local" },
    { name: "Mike", surname: "Johnson", email: "mike.landlord@leasespaces.local" },
  ];

  const landlords: Array<{ id: number; email: string; name: string; surname: string }> = [];
  for (const l of landlordsSeed) {
    const existing = await prisma.user.findUnique({ where: { email: l.email } });
    if (existing) {
      landlords.push(existing);
      continue;
    }
    const created = await prisma.user.create({
      data: {
        name: l.name,
        surname: l.surname,
        email: l.email,
        password: null,
        roleId: role.id,
        registrationType: "EMAIL",
        socialUserId: `landlord-${l.email}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        appRole: "landlord",
      } as any,
    });
    landlords.push(created);
  }

  // 3) Seed properties (only if fewer than 5 exist)
  const existingCount = await prisma.property.count();
  if (existingCount >= 5) {
    console.log("Properties already seeded (count >= 5). Skipping property seed.");
    return;
  }

  const byEmail = (email: string) => landlords.find((u) => u.email === email)!;

  const propertiesSeed: Array<{
    title: string;
    description: string;
    price: number;
    rentalType: string;
    propertyType: string;
    bedrooms: number;
    bathrooms: number;
    city: string;
    province: string;
    amenities: string[];
    images: string[];
    moderationStatus: PropertyModerationStatus;
    moderationNotes?: string | null;
    availabilityStatus: PropertyAvailabilityStatus;
    landlordEmail: string;
    createdAt: Date;
  }> = [
    {
      title: "Luxury Apartment in Sandton",
      description: "Fully furnished luxury apartment with modern amenities and a skyline view.",
      price: 2500,
      rentalType: "short-term",
      propertyType: "apartment",
      bedrooms: 2,
      bathrooms: 2,
      city: "Sandton",
      province: "Gauteng",
      amenities: ["WiFi", "Parking", "Pool", "Gym", "Air conditioning"],
      images: [
        "https://images.unsplash.com/photo-1502672023488-70e25813eb80?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1505691723518-36a5ac3b2a99?auto=format&fit=crop&w=1600&q=80",
      ],
      moderationStatus: "approved",
      moderationNotes: null,
      availabilityStatus: "available",
      landlordEmail: "john.landlord@leasespaces.local",
      createdAt: new Date("2024-01-15"),
    },
    {
      title: "Modern Townhouse Rosebank",
      description: "A modern townhouse close to cafes and galleries, perfect for professionals.",
      price: 8500,
      rentalType: "long-term",
      propertyType: "townhouse",
      bedrooms: 3,
      bathrooms: 2,
      city: "Rosebank",
      province: "Gauteng",
      amenities: ["Security", "Parking", "Garden", "Pet-friendly"],
      images: [
        "https://images.unsplash.com/photo-1568605114967-8130f3a36994?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1580587771525-78b9dba3b914?auto=format&fit=crop&w=1600&q=80",
      ],
      moderationStatus: "pending_approval",
      moderationNotes: null,
      availabilityStatus: "available",
      landlordEmail: "jane.landlord@leasespaces.local",
      createdAt: new Date("2024-01-12"),
    },
    {
      title: "Studio in Bryanston",
      description: "Cozy studio apartment, perfect for single travelers and business stays.",
      price: 1200,
      rentalType: "short-term",
      propertyType: "studio",
      bedrooms: 1,
      bathrooms: 1,
      city: "Bryanston",
      province: "Gauteng",
      amenities: ["WiFi", "Workspace", "Kitchenette"],
      images: [
        "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1600&q=80",
      ],
      moderationStatus: "approved",
      moderationNotes: null,
      availabilityStatus: "occupied",
      landlordEmail: "mike.landlord@leasespaces.local",
      createdAt: new Date("2024-01-10"),
    },
    {
      title: "Family Home in Dainfern",
      description: "Spacious family home in a secure estate with outdoor entertainment area.",
      price: 12000,
      rentalType: "long-term",
      propertyType: "house",
      bedrooms: 4,
      bathrooms: 3,
      city: "Dainfern",
      province: "Gauteng",
      amenities: ["Security", "Garden", "Pool", "Garage", "Fireplace"],
      images: [
        "https://images.unsplash.com/photo-1576941089067-2de3c901e126?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1449844908441-8829872d2607?auto=format&fit=crop&w=1600&q=80",
      ],
      moderationStatus: "declined",
      moderationNotes: "Missing proof of ownership documentation.",
      availabilityStatus: "unavailable",
      landlordEmail: "john.landlord@leasespaces.local",
      createdAt: new Date("2024-01-08"),
    },
    {
      title: "Penthouse in Menlyn",
      description: "High-rise penthouse with panoramic views and premium finishes.",
      price: 3500,
      rentalType: "short-term",
      propertyType: "penthouse",
      bedrooms: 2,
      bathrooms: 2,
      city: "Menlyn",
      province: "Gauteng",
      amenities: ["WiFi", "Concierge", "Parking", "Gym", "Pool"],
      images: [
        "https://images.unsplash.com/photo-1493809842364-78817add7ffb?auto=format&fit=crop&w=1600&q=80",
        "https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&w=1600&q=80",
      ],
      moderationStatus: "flagged_for_review",
      moderationNotes: "Listing details need verification (inconsistent address).",
      availabilityStatus: "available",
      landlordEmail: "jane.landlord@leasespaces.local",
      createdAt: new Date("2024-01-06"),
    },
  ];

  for (const p of propertiesSeed) {
    const existing = await prisma.property.findFirst({
      where: { title: p.title, landlordId: byEmail(p.landlordEmail).id },
      select: { id: true },
    });
    if (existing) continue;

    await prisma.property.create({
      data: {
        title: p.title,
        description: p.description,
        price: p.price,
        currency: "ZAR",
        propertyType: p.propertyType,
        rentalType: p.rentalType,
        rentalPeriod: p.rentalType === "long-term" ? "monthly" : "nightly",
        bedrooms: p.bedrooms,
        bathrooms: p.bathrooms,
        area: null,
        location: {
          city: p.city,
          province: p.province,
          country: "South Africa",
        },
        amenities: p.amenities,
        images: p.images,
        landlordId: byEmail(p.landlordEmail).id,
        availableDate: null,
        // Keep legacy field aligned with availability for older clients
        status: p.availabilityStatus,
        availabilityStatus: p.availabilityStatus,
        moderationStatus: p.moderationStatus,
        moderationNotes: p.moderationNotes ?? null,
        createdAt: p.createdAt,
      } as any,
    });
  }

  console.log("Seeded landlords and properties (>= 5).");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
