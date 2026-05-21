/* eslint-disable */
import multer from "multer";
import fs from "fs";
import path from "path";
import { Request, Response, NextFunction } from "express";
import { AuthRequest } from "./auth.middleware";

export const PROFILE_AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2MB
export const PROFILE_AVATAR_UPLOAD_DIR = path.join(process.cwd(), "uploads", "profiles");

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    if (!fs.existsSync(PROFILE_AVATAR_UPLOAD_DIR)) {
      fs.mkdirSync(PROFILE_AVATAR_UPLOAD_DIR, { recursive: true });
    }
    cb(null, PROFILE_AVATAR_UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const authUserId = (req as AuthRequest).user?.id ?? "user";
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `avatar-${authUserId}-${Date.now()}${ext}`);
  },
});

const allowedExt = /\.(jpe?g|png|webp)$/i;
const allowedMime = /^image\/(jpeg|png|webp)$/i;

const upload = multer({
  storage,
  limits: { fileSize: PROFILE_AVATAR_MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    const ok =
      allowedExt.test(path.extname(file.originalname)) && allowedMime.test(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error("Only JPEG, PNG, or WebP images are allowed"));
  },
}).fields([
  { name: "avatar", maxCount: 1 },
  { name: "image", maxCount: 1 },
]);

export function buildProfileAvatarUrl(req: Request, filename: string): string {
  return `${req.protocol}://${req.get("host")}/uploads/profiles/${filename}`;
}

export function profileAvatarUploadMiddleware(req: Request, res: Response, next: NextFunction): void {
  upload(req, res, (err: unknown) => {
    if (!err) {
      next();
      return;
    }
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        res.status(400).json({
          success: false,
          error: {
            code: "FILE_TOO_LARGE",
            message: "Profile image must be 2MB or smaller",
            maxSizeBytes: PROFILE_AVATAR_MAX_BYTES,
          },
        });
        return;
      }
      res.status(400).json({
        success: false,
        error: { code: "UPLOAD_ERROR", message: err.message },
      });
      return;
    }
    res.status(400).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: err instanceof Error ? err.message : "Invalid image upload",
      },
    });
  });
}

export function getUploadedAvatarFile(
  req: Request
): Express.Multer.File | undefined {
  const files = req.files as { avatar?: Express.Multer.File[]; image?: Express.Multer.File[] } | undefined;
  return files?.avatar?.[0] ?? files?.image?.[0];
}
