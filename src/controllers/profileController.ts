/* eslint-disable */
import { Request, Response } from "express";
import { AuthRequest } from "../middleware/auth.middleware";
import * as profileService from "../services/profileService";
import {
  ProfileDeleteBlockedException,
  ProfileValidationException,
} from "../services/profileService";
import {
  buildProfileAvatarUrl,
  getUploadedAvatarFile,
} from "../middleware/profileAvatarUpload";

function sendError(res: Response, status: number, code: string, message: string) {
  res.status(status).json({ success: false, error: { code, message } });
}

/** GET /api/profile */
export async function getProfile(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const result = await profileService.getProfileWithSettings(authReq.user.id);
    if (!result) {
      sendError(res, 404, "NOT_FOUND", "Profile not found");
      return;
    }
    res.status(200).json({ success: true, ...result });
  } catch (e) {
    sendError(res, 500, "INTERNAL_SERVER_ERROR", e instanceof Error ? e.message : "Failed to load profile");
  }
}

/** PATCH /api/profile */
export async function updateProfile(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const body = req.body as {
      name?: string;
      surname?: string;
      email?: string;
      phone?: string | null;
      cellphone?: string | null;
    };
    const profile = await profileService.updateProfile(authReq.user.id, {
      name: body.name,
      surname: body.surname,
      email: body.email,
      phone: body.phone ?? body.cellphone,
    });
    res.status(200).json({ success: true, profile, message: "Profile updated" });
  } catch (e) {
    if (e instanceof ProfileValidationException) {
      sendError(res, 400, "VALIDATION_ERROR", e.message);
      return;
    }
    sendError(res, 500, "INTERNAL_SERVER_ERROR", e instanceof Error ? e.message : "Failed to update profile");
  }
}

/** POST /api/profile/avatar — multipart, max 2MB (field: avatar or image) */
export async function uploadAvatar(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const file = getUploadedAvatarFile(req);
    if (!file) {
      sendError(
        res,
        400,
        "VALIDATION_ERROR",
        'No image uploaded. Use multipart field "avatar" or "image".'
      );
      return;
    }
    const avatarUrl = buildProfileAvatarUrl(req, file.filename);
    const profile = await profileService.updateAvatar(authReq.user.id, avatarUrl);
    res.status(200).json({
      success: true,
      profile,
      avatarUrl,
      message: "Profile image updated",
    });
  } catch (e) {
    if (e instanceof ProfileValidationException) {
      sendError(res, 400, "VALIDATION_ERROR", e.message);
      return;
    }
    sendError(res, 500, "INTERNAL_SERVER_ERROR", e instanceof Error ? e.message : "Failed to upload image");
  }
}

/** POST /api/profile/2fa/init */
export async function init2fa(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const result = await profileService.initTwoFactor(authReq.user.id);
    res.status(200).json({ success: true, ...result });
  } catch (e) {
    if (e instanceof ProfileValidationException) {
      const code = e.message.includes("already") ? "2FA_ALREADY_ENABLED" : "VALIDATION_ERROR";
      sendError(res, 400, code, e.message);
      return;
    }
    sendError(res, 500, "INTERNAL_SERVER_ERROR", e instanceof Error ? e.message : "Failed to init 2FA");
  }
}

/** POST /api/profile/2fa/enable */
export async function enable2fa(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const { secret, otp } = req.body as { secret?: string; otp?: string };
    const result = await profileService.enableTwoFactor(authReq.user.id, secret ?? "", otp ?? "");
    res.status(200).json({ success: true, message: "2FA enabled successfully", ...result });
  } catch (e) {
    if (e instanceof ProfileValidationException) {
      const code = e.message.includes("OTP") ? "INVALID_OTP" : "VALIDATION_ERROR";
      sendError(res, 400, code, e.message);
      return;
    }
    sendError(res, 500, "INTERNAL_SERVER_ERROR", e instanceof Error ? e.message : "Failed to enable 2FA");
  }
}

/** POST /api/profile/2fa/disable */
export async function disable2fa(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const { otp } = req.body as { otp?: string };
    const result = await profileService.disableTwoFactor(authReq.user.id, otp ?? "");
    res.status(200).json({ success: true, message: "2FA disabled", ...result });
  } catch (e) {
    if (e instanceof ProfileValidationException) {
      sendError(res, 400, "INVALID_OTP", e.message);
      return;
    }
    sendError(res, 500, "INTERNAL_SERVER_ERROR", e instanceof Error ? e.message : "Failed to disable 2FA");
  }
}

/** DELETE /api/profile */
export async function deleteAccount(req: Request, res: Response): Promise<void> {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      sendError(res, 401, "AUTHENTICATION_REQUIRED", "Authentication required");
      return;
    }
    const body = req.body as { confirmEmail?: string; otp?: string; password?: string };
    await profileService.deleteAccount(authReq.user.id, body);
    res.status(200).json({
      success: true,
      message: "Your account has been permanently deleted.",
      deleted: true,
    });
  } catch (e) {
    if (e instanceof ProfileDeleteBlockedException) {
      sendError(res, 409, e.code, e.message);
      return;
    }
    if (e instanceof ProfileValidationException) {
      sendError(res, 400, "VALIDATION_ERROR", e.message);
      return;
    }
    sendError(res, 500, "INTERNAL_SERVER_ERROR", e instanceof Error ? e.message : "Failed to delete account");
  }
}
