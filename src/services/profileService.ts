/* eslint-disable */
import fs from "fs";
import path from "path";
import { prisma } from "../config/prisma";
import { firebaseAdmin } from "../config/firebase-admin";
import { TwoFAService } from "../services/twofa";
import { normalizeEmail } from "../services/otpAuthService";
import { verifyPassword } from "../utils/password";
import { PROFILE_AVATAR_UPLOAD_DIR } from "../middleware/profileAvatarUpload";
import type { DeleteAccountInput, ProfileUpdateInput, PublicProfile } from "../interfaces/profile";

export class ProfileValidationException extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProfileValidationException";
  }
}

export class ProfileDeleteBlockedException extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ProfileDeleteBlockedException";
    this.code = code;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function shapeProfile(user: {
  id: number;
  email: string;
  name: string;
  surname: string;
  phone: string | null;
  avatarUrl: string | null;
  appRole: string | null;
  registrationType: string;
  twofa_enabled: boolean;
  createdAt: Date | null;
  updatedAt: Date | null;
}): PublicProfile {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    surname: user.surname,
    phone: user.phone,
    avatarUrl: user.avatarUrl,
    appRole: user.appRole,
    registrationType: user.registrationType,
    twofa_enabled: user.twofa_enabled,
    createdAt: user.createdAt?.toISOString() ?? null,
    updatedAt: user.updatedAt?.toISOString() ?? null,
  };
}

export async function getProfile(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  return shapeProfile(user);
}

export async function getProfileWithSettings(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  return {
    profile: shapeProfile(user),
    settings: {
      canEnable2fa: !user.twofa_enabled,
      canDisable2fa: user.twofa_enabled,
      hasPassword: Boolean(user.password),
      requiresOtpToDelete: user.twofa_enabled,
      requiresPasswordToDelete: Boolean(user.password) && !user.twofa_enabled,
    },
  };
}

function normalizePhone(phone: unknown): string | null {
  if (phone === null || phone === "") return null;
  if (typeof phone !== "string") throw new ProfileValidationException("phone must be a string");
  const trimmed = phone.trim();
  if (trimmed.length > 32) throw new ProfileValidationException("phone is too long");
  return trimmed;
}

export async function updateProfile(userId: number, input: ProfileUpdateInput) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ProfileValidationException("User not found");

  const data: {
    name?: string;
    surname?: string;
    email?: string;
    phone?: string | null;
  } = {};

  if (input.name !== undefined) {
    const name = String(input.name).trim();
    if (!name) throw new ProfileValidationException("name cannot be empty");
    data.name = name;
  }
  if (input.surname !== undefined) {
    const surname = String(input.surname).trim();
    if (!surname) throw new ProfileValidationException("surname cannot be empty");
    data.surname = surname;
  }
  if (input.phone !== undefined) {
    data.phone = normalizePhone(input.phone);
  }
  if (input.email !== undefined) {
    const email = normalizeEmail(String(input.email));
    if (!EMAIL_RE.test(email)) throw new ProfileValidationException("Invalid email address");
    if (email !== normalizeEmail(user.email)) {
      const taken = await prisma.user.findUnique({ where: { email } });
      if (taken && taken.id !== userId) {
        throw new ProfileValidationException("Email is already in use");
      }
      data.email = email;
    }
  }

  if (!Object.keys(data).length) {
    throw new ProfileValidationException("No valid fields to update");
  }

  if (data.email && user.socialUserId) {
    try {
      await firebaseAdmin.auth().updateUser(user.socialUserId, { email: data.email });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update auth provider email";
      throw new ProfileValidationException(msg);
    }
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { ...data, updatedAt: new Date() },
  });
  return shapeProfile(updated);
}

function localPathFromAvatarUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;
  const marker = "/uploads/profiles/";
  const idx = avatarUrl.indexOf(marker);
  if (idx === -1) return null;
  const filename = avatarUrl.slice(idx + marker.length).split("?")[0];
  if (!filename || filename.includes("..")) return null;
  return path.join(PROFILE_AVATAR_UPLOAD_DIR, filename);
}

function removeLocalAvatarFile(avatarUrl: string | null | undefined) {
  const filePath = localPathFromAvatarUrl(avatarUrl);
  if (!filePath || !fs.existsSync(filePath)) return;
  try {
    fs.unlinkSync(filePath);
  } catch {
    /* ignore cleanup errors */
  }
}

/** POST /api/profile/avatar — save profile image URL (max 2MB enforced in middleware) */
export async function updateAvatar(userId: number, avatarUrl: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ProfileValidationException("User not found");

  if (user.avatarUrl && user.avatarUrl !== avatarUrl) {
    removeLocalAvatarFile(user.avatarUrl);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { avatarUrl, updatedAt: new Date() },
  });
  return shapeProfile(updated);
}

export async function initTwoFactor(userId: number) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ProfileValidationException("User not found");
  if (user.twofa_enabled) {
    throw new ProfileValidationException("2FA is already enabled");
  }
  return TwoFAService.generateKeyAndQrCode(user.email);
}

export async function enableTwoFactor(userId: number, secret: string, otp: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ProfileValidationException("User not found");
  if (!secret?.trim() || !otp?.trim()) {
    throw new ProfileValidationException("secret and otp are required");
  }
  if (!TwoFAService.verifyOtp(otp.trim(), secret.trim())) {
    throw new ProfileValidationException("Invalid or expired OTP");
  }
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { twofa_secret: secret.trim(), twofa_enabled: true, updatedAt: new Date() },
  });
  return { twofa_enabled: updated.twofa_enabled };
}

export async function disableTwoFactor(userId: number, otp: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new ProfileValidationException("User not found");
  if (!user.twofa_enabled || !user.twofa_secret) {
    throw new ProfileValidationException("2FA is not enabled");
  }
  if (!otp?.trim() || !TwoFAService.verifyOtp(otp.trim(), user.twofa_secret)) {
    throw new ProfileValidationException("Invalid or expired OTP");
  }
  const updated = await prisma.user.update({
    where: { id: userId },
    data: { twofa_secret: null, twofa_enabled: false, updatedAt: new Date() },
  });
  return { twofa_enabled: updated.twofa_enabled };
}

export async function deleteAccount(userId: number, input: DeleteAccountInput) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { admin: true },
  });
  if (!user) throw new ProfileValidationException("User not found");

  if (user.appRole === "admin" || user.admin) {
    throw new ProfileDeleteBlockedException(
      "ADMIN_ACCOUNT",
      "Admin accounts must be deleted from the admin dashboard"
    );
  }

  const emailConfirm = input.confirmEmail ? normalizeEmail(input.confirmEmail) : "";
  if (!emailConfirm || emailConfirm !== normalizeEmail(user.email)) {
    throw new ProfileValidationException("confirmEmail must match your account email");
  }

  if (user.twofa_enabled && user.twofa_secret) {
    if (!input.otp?.trim() || !TwoFAService.verifyOtp(input.otp.trim(), user.twofa_secret)) {
      throw new ProfileValidationException("Valid OTP is required to delete your account");
    }
  } else if (user.password) {
    if (!input.password || !verifyPassword(input.password, user.password)) {
      throw new ProfileValidationException("Password is required to delete your account");
    }
  }

  const [activeLeases, propertyCount, pendingApps] = await Promise.all([
    prisma.lease.count({
      where: {
        status: "active",
        OR: [{ tenantId: userId }, { landlordId: userId }],
      },
    }),
    prisma.property.count({ where: { landlordId: userId } }),
    prisma.application.count({
      where: {
        tenantId: userId,
        status: { in: ["pending", "draft"] },
      },
    }),
  ]);

  if (activeLeases > 0) {
    throw new ProfileDeleteBlockedException(
      "ACTIVE_LEASE",
      "You have an active lease. End or complete it before deleting your account."
    );
  }
  if (propertyCount > 0) {
    throw new ProfileDeleteBlockedException(
      "HAS_PROPERTIES",
      "Remove all your property listings before deleting your account."
    );
  }
  if (pendingApps > 0) {
    throw new ProfileDeleteBlockedException(
      "PENDING_APPLICATIONS",
      "Withdraw or complete pending rental applications before deleting your account."
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.propertyFavorite.deleteMany({ where: { userId } });
    await tx.chatMessage.deleteMany({ where: { senderId: userId } });
    await tx.conversation.deleteMany({
      where: { OR: [{ tenantId: userId }, { landlordId: userId }] },
    });
    await tx.maintenanceRequest.deleteMany({
      where: { OR: [{ tenantId: userId }, { landlordId: userId }] },
    });
    await tx.application.deleteMany({ where: { tenantId: userId } });
    await tx.lease.deleteMany({
      where: { OR: [{ tenantId: userId }, { landlordId: userId }] },
    });
    await tx.emailOtp.deleteMany({ where: { userId } });
    await tx.notification.deleteMany({ where: { userId } });
    await tx.pointTransaction.deleteMany({ where: { userId } });
    await tx.userPoints.deleteMany({ where: { userId } });
    await tx.client.deleteMany({ where: { userId } });

    const sp = await tx.serviceProvider.findUnique({ where: { userId } });
    if (sp) {
      await tx.location.deleteMany({ where: { serviceProviderId: sp.id } });
      await tx.service.deleteMany({ where: { userId } });
      await tx.serviceProvider.delete({ where: { userId } });
    }

    removeLocalAvatarFile(user.avatarUrl);

    if (user.socialUserId) {
      try {
        await firebaseAdmin.auth().deleteUser(user.socialUserId);
      } catch {
        /* user may already be removed from Firebase */
      }
    }

    await tx.user.delete({ where: { id: userId } });
  });

  return { deleted: true, userId };
}
