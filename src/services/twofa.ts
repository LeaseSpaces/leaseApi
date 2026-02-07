/* eslint-disable */

import speakeasy from "speakeasy";
import QRCode from "qrcode";
import { APP_NAME } from "../utils/constants";

export class TwoFAService {
  /**
   * Generates a secret key and a QR code in base64 format.
   * @param userEmail The user email to associate with the QR code label.
   * @param appName The name of your app/service.
   * @returns Object containing the secret and QR code as a base64 image (no prefix).
   */
  static async generateKeyAndQrCode(userEmail: string) {
    const secret = speakeasy.generateSecret({
      name: `${APP_NAME} (${userEmail})`,
    });

    // Generate QR code as a PNG buffer
    const buffer = await QRCode.toBuffer(secret.otpauth_url ?? "", {
      type: "png",
    });

    // Convert buffer to base64 string (without the data URI prefix)
    const qrCodeBase64 = buffer.toString("base64");

    return {
      secret: secret.base32,
      qrCodeBase64,
    };
  }

  /**
   * Verifies a TOTP code entered by the user.
   * @param token The OTP token entered by the user.
   * @param secret The shared secret used to generate the token.
   * @returns Whether the token is valid or not.
   */
  static verifyOtp(token: string, secret: string): boolean {
    return speakeasy.totp.verify({
      secret,
      encoding: "base32",
      token,
      window: 1,
    });
  }
}
