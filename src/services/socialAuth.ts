import { AccountType, UserRole } from "@prisma/client";
import { firebaseAdmin } from "../config/firebase-admin";
import { prisma } from "../config/prisma";
import { generateToken } from "../utils/jwt";

function mapFirebaseProvider(provider?: string): AccountType {
  if (provider === "google.com") return "GOOGLE";
  if (provider === "facebook.com") return "FACEBOOK";
  if (provider === "apple.com") return "APPLE";
  if (provider === "password") return "EMAIL";
  return "GOOGLE";
}

function validAppRole(v: unknown): UserRole | null {
  if (v === "tenant" || v === "landlord") return v as UserRole;
  return null;
}

function normalizeRegistrationType(v: unknown): AccountType | null {
  if (typeof v !== "string") return null;
  const raw = v.trim().toUpperCase();
  if (raw === "GOOGLE") return "GOOGLE";
  if (raw === "FACEBOOK") return "FACEBOOK";
  if (raw === "APPLE") return "APPLE";
  if (raw === "EMAIL") return "EMAIL";
  return null;
}

export const authService = {
  handleFirebaseAuth: async (
    idToken: string,
    registrationType?: AccountType,
    appRole?: "tenant" | "landlord"
  ) => {
    // 1. Verify ID token with Firebase Admin
    const decoded = await firebaseAdmin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email ?? "";
    const name = decoded.name ?? "";
    const provider = (decoded as any).firebase?.sign_in_provider;
    const regType = normalizeRegistrationType(registrationType) ?? mapFirebaseProvider(provider);
    const role = validAppRole(appRole) ?? UserRole.tenant;

    // Ensure default role exists for seedless environments.
    const defaultRole = await prisma.role.upsert({
      where: { id: 1 },
      create: { id: 1, description: "Default" },
      update: {},
    });

    // 2. Find or create user in Neon (Prisma).
    // First try Firebase UID; fallback to email to handle account linking/reinstalls.
    let user = await prisma.user.findUnique({
      where: { socialUserId: uid },
    });

    if (!user) {
      if (email) {
        const byEmail = await prisma.user.findUnique({ where: { email } });
        if (byEmail) {
          user = await prisma.user.update({
            where: { id: byEmail.id },
            data: {
              socialUserId: uid,
              name: byEmail.name || name || "",
              registrationType: byEmail.registrationType ?? regType,
              appRole: byEmail.appRole ?? role,
            },
          });
        }
      }
    }

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: name || "",
          surname: "",
          email: email || "unknown@leasespaces.local",
          password: null,
          roleId: defaultRole.id,
          registrationType: regType,
          socialUserId: uid,
          appRole: role,
        },
      });
    }

    // 3. Backend JWT (userId) for auth middleware
    const token = generateToken(String(user.id));
    return { user, token };
  },
};
