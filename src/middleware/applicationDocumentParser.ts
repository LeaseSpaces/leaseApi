/* eslint-disable */
/**
 * Parses application document uploads. Works on Firebase/Cloud Run (req.rawBody)
 * and local Express (req.pipe). Multer alone fails on Cloud Functions with
 * "Unexpected end of form".
 */
import Busboy from "busboy";
import fs from "fs";
import os from "os";
import path from "path";
import type { NextFunction, Request, Response } from "express";

export const APPLICATIONS_UPLOAD_DIR = path.join(
  process.env.UPLOAD_DIR || path.join(os.tmpdir(), "leasespaces-uploads"),
  "applications"
);

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXT = /\.(pdf|jpe?g|png)$/i;
const ALLOWED_MIME = /^(application\/pdf|image\/jpeg|image\/jpg|image\/png)$/i;
const DOCUMENT_FIELDS = ["governmentId", "proofOfIncome", "referenceLetters"] as const;

export interface ApplicationDocumentUpload {
  field: string;
  fileName: string;
  storedFilename: string;
  mimeType: string;
  size: number;
}

declare global {
  namespace Express {
    interface Request {
      applicationDocumentUploads?: ApplicationDocumentUpload[];
      rawBody?: Buffer;
    }
  }
}

function ensureUploadDir(): void {
  if (!fs.existsSync(APPLICATIONS_UPLOAD_DIR)) {
    fs.mkdirSync(APPLICATIONS_UPLOAD_DIR, { recursive: true });
  }
}

function validateFile(originalname: string, mimeType: string): void {
  const extOk = ALLOWED_EXT.test(path.extname(originalname));
  const mime = (mimeType || "").toLowerCase();
  const mimeOk =
    ALLOWED_MIME.test(mime) || (mime === "application/octet-stream" && extOk);
  if (!extOk || !mimeOk) {
    throw new Error("Only PDF, JPG, and PNG files are allowed");
  }
}

function persistBuffer(
  field: string,
  originalname: string,
  mimeType: string,
  buffer: Buffer
): ApplicationDocumentUpload {
  if (buffer.length > MAX_BYTES) {
    throw new Error(`${field} exceeds 10MB limit`);
  }
  validateFile(originalname, mimeType);
  ensureUploadDir();
  const ext = path.extname(originalname).toLowerCase() || ".bin";
  const storedFilename = `${field}-${Date.now()}-${Math.round(Math.random() * 1e9)}${ext}`;
  fs.writeFileSync(path.join(APPLICATIONS_UPLOAD_DIR, storedFilename), buffer);
  return {
    field,
    fileName: originalname,
    storedFilename,
    mimeType: mimeType || "application/octet-stream",
    size: buffer.length,
  };
}

function parseJsonDocuments(req: Request, res: Response, next: NextFunction): void {
  try {
    const body = req.body as Record<string, unknown>;
    const uploads: ApplicationDocumentUpload[] = [];

    for (const field of DOCUMENT_FIELDS) {
      const part = body[field] as
        | { fileName?: string; mimeType?: string; data?: string }
        | undefined;
      if (!part?.data) continue;
      const buffer = Buffer.from(part.data, "base64");
      uploads.push(
        persistBuffer(
          field,
          part.fileName || `${field}.jpg`,
          part.mimeType || "image/jpeg",
          buffer
        )
      );
    }

    if (!uploads.length) {
      res.status(400).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message:
            "At least one document is required (governmentId and/or proofOfIncome as base64)",
        },
      });
      return;
    }

    req.applicationDocumentUploads = uploads;
    next();
  } catch (e) {
    res.status(400).json({
      success: false,
      error: {
        code: "UPLOAD_ERROR",
        message: e instanceof Error ? e.message : "Invalid document payload",
      },
    });
  }
}

function parseMultipartDocuments(req: Request, res: Response, next: NextFunction): void {
  ensureUploadDir();
  const uploads: ApplicationDocumentUpload[] = [];
  const pending: Promise<void>[] = [];
  let responded = false;

  const fail = (status: number, code: string, message: string) => {
    if (responded) return;
    responded = true;
    res.status(status).json({ success: false, error: { code, message } });
  };

  try {
    const bb = Busboy({
      headers: req.headers,
      limits: { fileSize: MAX_BYTES, files: 3 },
    });

    bb.on("file", (fieldname, file, info) => {
      const chunks: Buffer[] = [];
      let limitHit = false;

      const p = new Promise<void>((resolve, reject) => {
        file.on("data", (chunk: Buffer) => {
          if (!limitHit) chunks.push(chunk);
        });
        file.on("limit", () => {
          limitHit = true;
          reject(new Error(`${fieldname} exceeds 10MB limit`));
        });
        file.on("end", () => {
          if (limitHit) return;
          try {
            const buffer = Buffer.concat(chunks);
            const name = info.filename || `${fieldname}.jpg`;
            const mime = info.mimeType || "application/octet-stream";
            uploads.push(persistBuffer(fieldname, name, mime, buffer));
            resolve();
          } catch (err) {
            reject(err);
          }
        });
        file.on("error", reject);
      });
      pending.push(p);
    });

    bb.on("error", (err: Error) => fail(400, "UPLOAD_ERROR", err.message));

    bb.on("finish", () => {
      void Promise.all(pending)
        .then(() => {
          if (responded) return;
          if (!uploads.length) {
            fail(400, "VALIDATION_ERROR", "At least one document file is required");
            return;
          }
          req.applicationDocumentUploads = uploads;
          next();
        })
        .catch((err: Error) => fail(400, "UPLOAD_ERROR", err.message));
    });

    const rawBody = req.rawBody;
    if (rawBody && rawBody.length > 0) {
      bb.end(rawBody);
    } else {
      req.pipe(bb);
    }
  } catch (e) {
    fail(500, "UPLOAD_ERROR", e instanceof Error ? e.message : "Upload failed");
  }
}

/** Parse multipart (Firebase-safe) or JSON base64 document uploads. */
export function parseApplicationDocuments(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const contentType = (req.headers["content-type"] || "").toLowerCase();

  if (contentType.includes("application/json")) {
    parseJsonDocuments(req, res, next);
    return;
  }

  if (!contentType.includes("multipart/form-data")) {
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message:
          "Use multipart/form-data (field names: governmentId, proofOfIncome, referenceLetters) or application/json with base64 file objects",
      },
    });
    return;
  }

  parseMultipartDocuments(req, res, next);
}

export function buildApplicationDocumentUrl(
  req: { protocol: string; get: (h: string) => string | undefined },
  storedFilename: string
): string {
  return `${req.protocol}://${req.get("host")}/uploads/applications/${storedFilename}`;
}
