/* eslint-disable */
import type { User } from "@prisma/client";
import {
  generateAdminToken,
  generateTempToken,
  generateToken,
  generateTokenWithPayload,
} from "../utils/jwt";

export function shapeAuthUser(user: User) {
  return {
    id: user.id,
    uid: user.socialUserId,
    email: user.email,
    name: user.name,
    surname: user.surname,
    role: user.appRole ?? "tenant",
    twofa_enabled: user.twofa_enabled,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export type PostLoginResponse =
  | {
      success: true;
      requires2fa: true;
      temporaryToken: string;
      user: ReturnType<typeof shapeAuthUser>;
      token?: undefined;
      onboardingRequired?: boolean;
    }
  | {
      success: true;
      token: string;
      user: ReturnType<typeof shapeAuthUser>;
      requires2fa?: undefined;
      temporaryToken?: undefined;
      onboardingRequired?: boolean;
    };

/**
 * After primary auth (password, Firebase, email OTP), issue either a full JWT or a 2FA challenge.
 */
export function buildPostLoginResponse(
  user: User,
  options?: { usePayloadToken?: boolean; onboardingRequired?: boolean }
): PostLoginResponse {
  const userDto = shapeAuthUser(user);

  if (user.twofa_enabled) {
    return {
      success: true,
      requires2fa: true,
      temporaryToken: generateTempToken(String(user.id)),
      user: userDto,
      ...(options?.onboardingRequired != null
        ? { onboardingRequired: options.onboardingRequired }
        : {}),
    };
  }

  let token: string;
  if (options?.usePayloadToken) {
    token = generateTokenWithPayload({
      userId: String(user.id),
      user_id: user.id,
      role: user.appRole ?? "onboarding",
    });
  } else if (user.appRole === "admin") {
    token = generateAdminToken(String(user.id));
  } else {
    token = generateToken(String(user.id));
  }

  return {
    success: true,
    token,
    user: userDto,
    ...(options?.onboardingRequired != null
      ? { onboardingRequired: options.onboardingRequired }
      : {}),
  };
}

/** Full JWT after TOTP verification (POST /api/auth/2fa/verify-login). */
export function buildTokenAfter2fa(user: User, options?: { onboardingRequired?: boolean }) {
  let token: string;
  if (user.appRole === "admin") {
    token = generateAdminToken(String(user.id));
  } else {
    token = generateTokenWithPayload({
      userId: String(user.id),
      user_id: user.id,
      role: user.appRole ?? "tenant",
    });
  }
  return {
    success: true,
    token,
    user: shapeAuthUser(user),
    ...(options?.onboardingRequired != null
      ? { onboardingRequired: options.onboardingRequired }
      : {}),
  };
}
