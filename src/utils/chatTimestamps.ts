import { Timestamp } from "firebase-admin/firestore";

/** Normalize Firestore Timestamp / Date / ISO string to Date. */
export function toDate(value: unknown): Date | null {
  if (value == null) return null;
  if (value instanceof Date) return value;
  if (typeof value === "string") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (value instanceof Timestamp) return value.toDate();
  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as Timestamp).toDate === "function") {
    return (value as Timestamp).toDate();
  }
  if (typeof value === "object" && value !== null && "_seconds" in value) {
    const seconds = Number((value as { _seconds: number })._seconds);
    const nanos = Number((value as { _nanoseconds?: number })._nanoseconds ?? 0);
    return new Date(seconds * 1000 + nanos / 1_000_000);
  }
  return null;
}

export function toIso(value: unknown): string | null {
  const date = toDate(value);
  return date ? date.toISOString() : null;
}

export function nowTimestamp(): Timestamp {
  return Timestamp.now();
}
