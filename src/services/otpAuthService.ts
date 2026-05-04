import crypto from "crypto";

const OTP_TTL_MS = 5 * 60 * 1000;

export const generateSixDigitOtp = (): string => {
  // randomInt upper bound is exclusive, so this creates values from 100000 to 999999.
  return String(crypto.randomInt(100000, 1000000));
};

export const getOtpExpiryDate = (): Date => new Date(Date.now() + OTP_TTL_MS);

export const hashOtpCode = (email: string, code: string): string => {
  const normalizedEmail = email.trim().toLowerCase();
  return crypto
    .createHash("sha256")
    .update(`${normalizedEmail}:${code}`)
    .digest("hex");
};

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const isOnboardingRequired = (user: {
  name: string;
  surname: string;
  appRole: string | null;
}): boolean => {
  const missingName = !user.name || user.name.trim().length === 0;
  const missingSurname = !user.surname || user.surname.trim().length === 0;
  const missingRole = !user.appRole;
  return missingName || missingSurname || missingRole;
};

