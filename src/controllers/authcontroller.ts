/* eslint-disable */

import { AccountType, UserRole } from "@prisma/client";
import firebase from "../firebase";
import { Request, Response } from "express";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  updateDoc,
  doc,
  where,
  addDoc,
} from "firebase/firestore";
import crypto from "crypto";
import { STATUS } from "../utils/constants";
import { verifyPassword } from "../utils/password";
import { TwoFAService } from "../services/twofa";
import { generateToken, generateAdminToken, generateTempToken, verifyTempToken, verifyToken, generateTokenWithPayload } from "../utils/jwt";
import { firebaseAdmin } from "../config/firebase-admin";
import { prisma } from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";
import { sendLeaseSpacesOtpEmail } from "../services/emailDeliveryService";
import {
  generateSixDigitOtp,
  getOtpExpiryDate,
  hashOtpCode,
  isOnboardingRequired,
  normalizeEmail,
} from "../services/otpAuthService";

const db = getFirestore(firebase);

function mapFirebaseProviderToAccountType(provider?: string): AccountType {
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

/**
 * Admin login with username (email) and password only. No Google signup.
 * Admin users are created only via backend/seed; this endpoint only authenticates.
 * POST /api/admin/login — body: { username, password }.
 * Returns token, or requires2fa + temporaryToken if 2FA is enabled.
 */
export const adminLoginPrisma = async (req: Request, res: Response): Promise<any> => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        error: { code: "MISSING_CREDENTIALS", message: "Username and password are required" },
      });
    }
    const user = await prisma.user.findFirst({
      where: {
        email: String(username).trim(),
        appRole: "admin",
      },
    });
    if (!user || !user.password) {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "Invalid username or password" },
      });
    }
    if (!verifyPassword(password, user.password)) {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_CREDENTIALS", message: "Invalid username or password" },
      });
    }

    if (user.twofa_enabled) {
      const temporaryToken = generateTempToken(String(user.id));
      return res.status(200).json({
        success: true,
        requires2fa: true,
        temporaryToken,
        user: {
          id: user.id,
          uid: user.socialUserId,
          email: user.email,
          name: user.name,
          surname: user.surname,
          role: user.appRole ?? "tenant",
          twofa_enabled: user.twofa_enabled,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    }

    const token = generateAdminToken(String(user.id));
    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        uid: user.socialUserId,
        email: user.email,
        name: user.name,
        surname: user.surname,
        role: user.appRole ?? "tenant",
        twofa_enabled: user.twofa_enabled,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      token,
    });
  } catch (error) {
    console.error("adminLoginPrisma error:", error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: (error as Error).message },
    });
  }
};

export const adminLogin = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).send("Username and password are required");
      return;
    }
    // Convert the password to SHA-1
    const hashedPassword = crypto
      .createHash("sha1")
      .update(password)
      .digest("hex");

    console.log("Hashed p", hashedPassword);

    // Query the Admins collection for a matching email and hashed password
    const adminsRef = collection(db, "admins");
    const q = query(
      adminsRef,
      where("email", "==", email),
      where("password", "==", hashedPassword)
    );

    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      res.status(401).send("Invalid username or password");
      return;
    }

    const adminDoc = querySnapshot.docs[0].data();
    const userId = querySnapshot.docs[0].id;

    const token = generateToken(userId);

    res.status(200).json({ token, details: adminDoc });
  } catch (error) {
    console.error("Error during admin login:", error);
    res.status(500).send((error as Error).message);
  }
};

export const initTwoFA = async (req: Request, res: Response): Promise<any> => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(STATUS.BAD_REQUEST).send("User email is missing");
    }

    const { secret, qrCodeBase64 } = await TwoFAService.generateKeyAndQrCode(
      email
    );

    return res.status(STATUS.OK).json({
      success: true,
      secret,
      qrCodeBase64,
    });
  } catch (error) {
    console.error("Error in initTwoFA:", error);
    return res
      .status(STATUS.INTERNAL_SERVER_ERROR)
      .send("Failed to initialize 2FA");
  }
};

export const enableTwoFA = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { email, secret_key } = req.body;

    if (!email || !secret_key) {
      return res
        .status(STATUS.BAD_REQUEST)
        .send("Email and secret key are required");
    }

    const adminsRef = collection(db, "admins");
    const q = query(adminsRef, where("email", "==", email));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return res
        .status(STATUS.BAD_REQUEST)
        .json({ success: false, message: "Admin not found" });
    }

    const adminDoc = snapshot.docs[0];
    const adminRef = doc(db, "admins", adminDoc.id);

    await updateDoc(adminRef, {
      two_fa_enabled: true,
      secret_key,
    });

    return res.status(STATUS.OK).json({
      success: true,
      message: "2FA enabled successfully",
    });
  } catch (error) {
    console.error("Error enabling 2FA:", error);
    return res
      .status(STATUS.INTERNAL_SERVER_ERROR)
      .send("Failed to enable 2FA");
  }
};


export const verifyTwoFA = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { email, token } = req.body;

    if (!email || !token) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: "Email and token are required",
      });
    }

    // Fetch admin with the email
    const adminsRef = collection(db, "admins");
    const q = query(adminsRef, where("email", "==", email));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return res.status(STATUS.UNAUTHORIZED).json({
        success: false,
        message: "Admin not found",
      });
    }

    const adminDoc = snapshot.docs[0];
    const adminData = adminDoc.data();
    const secret = adminData.secret_key;

    if (!secret) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        message: "2FA not enabled or secret key missing",
      });
    }

    const verified = TwoFAService.verifyOtp(token,secret);

    if (!verified) {
      return res.status(STATUS.UNAUTHORIZED).json({
        success: false,
        message: "Invalid or expired token",
      });
    }

    return res.status(STATUS.OK).json({
      success: true,
      message: "OTP verified successfully",
    });
  } catch (error) {
    console.error("Error verifying OTP:", error);
    return res
      .status(STATUS.INTERNAL_SERVER_ERROR)
      .send("Failed to verify OTP");
  }
};

export const getAllAdmins = async (req: Request, res: Response): Promise<any> => {
  try {
    const adminsRef = collection(db, "admins");
    const snapshot = await getDocs(adminsRef);

    const admins = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(STATUS.OK).json({
      success: true,
      admins,
    });
  } catch (error) {
    console.error("Error fetching admins:", error);
    return res.status(STATUS.INTERNAL_SERVER_ERROR).json({
      success: false,
      message: "Failed to fetch admins",
    });
  }
};

export const forgotPassword = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const { email, newPassword } = req.body;

    if (!email || !newPassword) {
      return res
        .status(STATUS.BAD_REQUEST)
        .json({
          success: false,
          message: "Email and new password are required",
        });
    }

    // Hash the new password using SHA-1
    const hashedPassword = crypto
      .createHash("sha1")
      .update(newPassword)
      .digest("hex");

    // Query admin by email
    const adminsRef = collection(db, "admins");
    const q = query(adminsRef, where("email", "==", email));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return res
        .status(STATUS.BAD_REQUEST)
        .json({ success: false, message: "Admin not found" });
    }

    // Update password
    const adminDoc = snapshot.docs[0];
    const adminRef = doc(db, "admins", adminDoc.id);

    await updateDoc(adminRef, {
      password: hashedPassword,
    });

    return res.status(STATUS.OK).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    console.error("Error resetting password:", error);
    return res
      .status(STATUS.INTERNAL_SERVER_ERROR)
      .json({ success: false, message: "Failed to reset password" });
  }
};


export const registerUser = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const {
      name,
      surname,
      email,
      phoneNumber,
      userType,
      password,
      image,
      location,
    } = req.body;

    if (
      !name ||
      !surname ||
      !email ||
      !phoneNumber ||
      userType == null ||
      !password ||
      !location
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required user or location fields",
      });
    }

    const usersRef = collection(db, "users");
    const existing = await getDocs(
      query(usersRef, where("email", "==", email))
    );

    if (!existing.empty) {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists",
      });
    }

    const hashedPassword = crypto
      .createHash("sha1")
      .update(password)
      .digest("hex");

    const newUser = {
      name,
      surname,
      email,
      phone: phoneNumber,
      role: userType,
      password: hashedPassword,
      image: image || "https://via.placeholder.com/150",
      createdAt: new Date().toISOString(),
    };

    const userRef = await addDoc(usersRef, newUser);
    const userId = userRef.id;
    const token = generateToken(userId);

    const locationRef = collection(db, "locations");
    await addDoc(locationRef, {
      userId,
      ...location,
    });

    return res.status(201).json({
      success: true,
      message: "User and location registered successfully",
      userId,
      token
    });
  } catch (error) {
    console.error("Error registering user and location:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to register user",
    });
  }
};

export const registerServiceProviderAsIndividual = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const {
      name,
      email,
      role,
      password,
      phone,
      image,
      provider_type,
      location,
      services,
      portfolio,
    } = req.body;

    // 1. Validate role
    if (role !== 1) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid role. Only role 1 (service provider) is allowed for this route.",
      });
    }

    // 2. Check required fields
    if (
      !name ||
      !email ||
      !password ||
      !phone ||
      !provider_type ||
      !location ||
      !services ||
      !portfolio
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields.",
      });
    }

    // 3. Check if user already exists
    const usersRef = collection(db, "users");
    const existing = await getDocs(
      query(usersRef, where("email", "==", email))
    );

    if (!existing.empty) {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists",
      });
    }

    // 4. Hash password
    const hashedPassword = crypto
      .createHash("sha1")
      .update(password)
      .digest("hex");

    // 5. Save user
    const newUser = {
      name,
      email,
      phone,
      role,
      points: "",
      tasks: "",
      trophies: "",
      experience: "",
      rating: "",
      status: "pending",
      password: hashedPassword,
      image: image || "https://via.placeholder.com/150",
      provider_type,
      createdAt: new Date().toISOString(),
    };

    const userRef = await addDoc(usersRef, newUser);
    const userId = userRef.id;
    const token = generateToken(userId);

    // 6. Save location
    await addDoc(collection(db, "locations"), {
      userId,
      ...location,
      latitude: location.latitude,
      longitude: location.longitude,
    });

    // 7. Save services
    await addDoc(collection(db, "services"), {
      userId,
      services,
    });

    // 8. Save portfolio
    await addDoc(collection(db, "portfolios"), {
      userId,
      images: portfolio.images || [],
      docs: portfolio.docs || [],
    });

    return res.status(201).json({
      success: true,
      token,
      message: "Service provider registered successfully",
      userId,
    });
  } catch (error) {
    console.error("Error registering service provider:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to register service provider",
    });
  }
};

export const registerServiceProviderAsBusiness = async (
  req: Request,
  res: Response
): Promise<any> => {
  try {
    const {
      name,
      bis_reg_num,
      email,
      role,
      password,
      phone,
      image,
      provider_type,
      location,
      services,
      portfolio,
    } = req.body;

    if (role !== 1) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid role. Only role 1 (service provider) is allowed for this route.",
      });
    }

    if (
      !name ||
      !email ||
      !password ||
      !phone ||
      !provider_type ||
      !location ||
      !services ||
      !portfolio
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields.",
      });
    }

    // Check for duplicate email
    const usersRef = collection(db, "users");
    const existing = await getDocs(
      query(usersRef, where("email", "==", email))
    );
    if (!existing.empty) {
      return res.status(409).json({
        success: false,
        message: "A user with this email already exists",
      });
    }

    const hashedPassword = crypto
      .createHash("sha1")
      .update(password)
      .digest("hex");

    const newUser = {
      name,
      email,
      phone,
      role,
      points:"",
      tasks:"",
      trophies:"",
      experience:"",
      rating:"",
      status:"pending",
      password: hashedPassword,
      image: image || "https://via.placeholder.com/150",
      provider_type,
      bis_reg_num: bis_reg_num || "N/A",
      createdAt: new Date().toISOString(),
    };

    const userRef = await addDoc(usersRef, newUser);
    const userId = userRef.id;

    // Save HQ and branches
    await addDoc(collection(db, "locations"), {
      userId,
      province: location.province,
      city: location.city,
      suburb: location.suburb,
      address: location.address,
      latitude: location.latitude,
      longitude: location.longitude,
      service_radius: location.service_radius,
      other_locations: location.other_locations || [],
    });

    // Save services
    await addDoc(collection(db, "services"), {
      userId,
      services,
    });

    // Save portfolio
    await addDoc(collection(db, "portfolios"), {
      userId,
      images: portfolio.images || [],
      docs: portfolio.docs || [],
    });
    const token = generateToken(userId);

    return res.status(201).json({
      success: true,
      message: "Business service provider registered successfully",
      userId,
      token
    });
  } catch (error) {
    console.error("Error registering business provider:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to register business provider",
    });
  }
};


export const loginUser = async (req: Request, res: Response):Promise<any> =>{
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res
        .status(400)
        .json({ success: false, message: "Email and password are required" });

    const hashedPassword = crypto
      .createHash("sha1")
      .update(password)
      .digest("hex");

    const usersRef = collection(db, "users");
    const q = query(
      usersRef,
      where("email", "==", email),
      where("password", "==", hashedPassword)
    );
    const snapshot = await getDocs(q);


    if (snapshot.empty)
      return res
        .status(401)
        .json({ success: false, message: "Invalid credentials" });

    const userDoc = snapshot.docs[0];
    const user = userDoc.data();
    const userId = userDoc.id;
    const [locationSnap, servicesSnap, portfolioSnap] = await Promise.all([
      getDocs(
        query(collection(db, "locations"), where("userId", "==", userId))
      ),
      getDocs(query(collection(db, "services"), where("userId", "==", userId))),
      getDocs(
        query(collection(db, "portfolios"), where("userId", "==", userId))
      ),
    ]);

    const token = generateToken(userId);

    return res.status(200).json({
      success: true,
      message: "Login successful",
      token,
      user: {
        id: userId,
        ...user,
        location: locationSnap.docs[0]?.data() || null,
        services: servicesSnap.docs[0]?.data()?.services || [],
        portfolio: portfolioSnap.docs[0]?.data() || {},
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({ success: false, message: "Login failed" });
  }
};

/**
 * Auth Sync (LeaseSpaces): Verify Firebase JWT from Authorization header,
 * check if user exists in Neon (Prisma), create if not, return user + backend JWT.
 * Mobile signup: optional body { appRole?: "tenant" | "landlord" } for new users.
 */
export const syncAuth = async (req: Request, res: Response): Promise<any> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: {
          code: "AUTHENTICATION_REQUIRED",
          message: "Authentication token is required",
          details: "Please provide a valid Bearer token (Firebase ID token)",
        },
      });
    }

    const idToken = authHeader.split(" ")[1];
    const decoded = await firebaseAdmin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email ?? "";
    const name = decoded.name ?? "";

    const registrationType = mapFirebaseProviderToAccountType(decoded.firebase?.sign_in_provider);
    const appRole = validAppRole(req.body?.appRole) ?? UserRole.tenant;

    // Ensure default role exists for first-login environments without seed.
    const defaultRole = await prisma.role.upsert({
      where: { id: 1 },
      create: { id: 1, description: "Default" },
      update: {},
    });

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
              registrationType: byEmail.registrationType ?? registrationType,
              appRole: byEmail.appRole ?? appRole,
            },
          });
        }
      }
    }

    if (!user) {
      user = await prisma.user.create({
        data: {
          name,
          surname: "",
          email: email || "unknown@leasespaces.local",
          password: null,
          roleId: defaultRole.id,
          registrationType,
          socialUserId: uid,
          appRole,
        },
      });
    }

    const isAdmin = user.appRole === "admin";

    // Admin with 2FA: return temporary token; full token after OTP verification
    if (isAdmin && user.twofa_enabled) {
      const temporaryToken = generateTempToken(String(user.id));
      return res.status(200).json({
        success: true,
        requires2fa: true,
        temporaryToken,
        user: {
          id: user.id,
          uid: user.socialUserId,
          email: user.email,
          name: user.name,
          surname: user.surname,
          role: user.appRole ?? "tenant",
          twofa_enabled: user.twofa_enabled,
          createdAt: user.createdAt,
          updatedAt: user.updatedAt,
        },
      });
    }

    const token = isAdmin ? generateAdminToken(String(user.id)) : generateToken(String(user.id));

    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        uid: user.socialUserId,
        email: user.email,
        name: user.name,
        surname: user.surname,
        role: user.appRole ?? "tenant",
        twofa_enabled: user.twofa_enabled,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
      },
      token,
    });
  } catch (error) {
    console.error("syncAuth error:", error);
    return res.status(401).json({
      success: false,
      error: {
        code: "INVALID_TOKEN",
        message: "Invalid or expired token",
        details: error instanceof Error ? error.message : "Token verification failed",
      },
    });
  }
};

/** POST /api/auth/2fa/verify-login — body: { temporaryToken, otp }. Returns full admin token. */
export const verifyLogin2fa = async (req: Request, res: Response): Promise<any> => {
  try {
    const { temporaryToken, otp } = req.body;
    if (!temporaryToken || !otp) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        error: { code: "MISSING_FIELDS", message: "temporaryToken and otp are required" },
      });
    }
    const { userId } = verifyTempToken(temporaryToken);
    const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
    if (!user || user.appRole !== "admin") {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Invalid or expired temporary token" },
      });
    }
    if (!user.twofa_secret) {
      return res.status(400).json({
        success: false,
        error: { code: "2FA_NOT_ENABLED", message: "2FA is not enabled for this user" },
      });
    }
    const valid = TwoFAService.verifyOtp(otp, user.twofa_secret);
    if (!valid) {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_OTP", message: "Invalid or expired OTP" },
      });
    }
    const token = generateAdminToken(String(user.id));
    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        uid: user.socialUserId,
        email: user.email,
        name: user.name,
        surname: user.surname,
        role: user.appRole ?? "tenant",
        twofa_enabled: user.twofa_enabled,
      },
      token,
    });
  } catch (error) {
    console.error("verifyLogin2fa error:", error);
    return res.status(401).json({
      success: false,
      error: {
        code: "INVALID_TOKEN",
        message: "Invalid or expired temporary token",
        details: error instanceof Error ? error.message : "Verification failed",
      },
    });
  }
};

/** POST /api/admin/2fa/init — auth + requireAdmin. Returns { secret, qrCodeBase64 } for first-time setup. */
export const init2faPrisma = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (userId == null) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.appRole !== "admin") {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Admin only" },
      });
    }
    if (user.twofa_enabled) {
      return res.status(400).json({
        success: false,
        error: { code: "2FA_ALREADY_ENABLED", message: "2FA is already enabled" },
      });
    }
    const { secret, qrCodeBase64 } = await TwoFAService.generateKeyAndQrCode(user.email ?? "");
    return res.status(200).json({
      success: true,
      secret,
      qrCodeBase64,
    });
  } catch (error) {
    console.error("init2faPrisma error:", error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: (error as Error).message },
    });
  }
};

/** POST /api/admin/2fa/enable — auth + requireAdmin. Body: { secret, otp }. Saves 2FA and enables. */
export const enable2faPrisma = async (req: Request, res: Response): Promise<any> => {
  try {
    const userId = (req as AuthRequest).user?.id;
    if (userId == null) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
    }
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user || user.appRole !== "admin") {
      return res.status(403).json({
        success: false,
        error: { code: "FORBIDDEN", message: "Admin only" },
      });
    }
    const { secret, otp } = req.body;
    if (!secret || !otp) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        error: { code: "MISSING_FIELDS", message: "secret and otp are required" },
      });
    }
    const valid = TwoFAService.verifyOtp(otp, secret);
    if (!valid) {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_OTP", message: "Invalid or expired OTP" },
      });
    }
    await prisma.user.update({
      where: { id: user.id },
      data: { twofa_secret: secret, twofa_enabled: true },
    });
    return res.status(200).json({
      success: true,
      message: "2FA enabled successfully",
    });
  } catch (error) {
    console.error("enable2faPrisma error:", error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: (error as Error).message },
    });
  }
};

/** POST /api/auth/refresh — Bearer token. Returns new token (same expiry from now). */
export const refreshToken = async (req: Request, res: Response): Promise<any> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Bearer token required" },
      });
    }
    const { userId } = verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: Number(userId) } });
    if (!user) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "User not found" },
      });
    }
    const newToken = user.appRole === "admin" ? generateAdminToken(String(user.id)) : generateToken(String(user.id));
    return res.status(200).json({
      success: true,
      token: newToken,
    });
  } catch (error) {
    console.error("refreshToken error:", error);
    return res.status(401).json({
      success: false,
      error: {
        code: "INVALID_TOKEN",
        message: "Invalid or expired token",
        details: error instanceof Error ? error.message : "Refresh failed",
      },
    });
  }
};

/**
 * POST /api/auth/otp/request
 * body: { email }
 * Sends a 6-digit OTP by email and stores hashed OTP with 5-minute TTL.
 */
export const requestEmailOtp = async (req: Request, res: Response): Promise<any> => {
  try {
    const emailInput = req.body?.email;
    if (!emailInput || typeof emailInput !== "string") {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        error: { code: "MISSING_FIELDS", message: "email is required" },
      });
    }

    const email = normalizeEmail(emailInput);
    const defaultRole = await prisma.role.upsert({
      where: { id: 1 },
      create: { id: 1, description: "Default" },
      update: {},
    });

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          name: "",
          surname: "",
          email,
          password: null,
          roleId: defaultRole.id,
          registrationType: AccountType.EMAIL,
          socialUserId: `email:${email}`,
          appRole: null,
        },
      });
    }

    // @ts-ignore prisma client may be stale in editor until prisma generate reruns
    await prisma.emailOtp.updateMany({
      where: { email, consumedAt: null, expiresAt: { gt: new Date() } },
      data: { consumedAt: new Date() },
    });

    const otp = generateSixDigitOtp();
    // @ts-ignore prisma client may be stale in editor until prisma generate reruns
    await prisma.emailOtp.create({
      data: {
        email,
        codeHash: hashOtpCode(email, otp),
        expiresAt: getOtpExpiryDate(),
        userId: user.id,
      },
    });

    await sendLeaseSpacesOtpEmail({ to: email, otp });

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
      expiresInSeconds: 300,
    });
  } catch (error) {
    console.error("requestEmailOtp error:", error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: (error as Error).message },
    });
  }
};

/**
 * POST /api/auth/otp/verify
 * body: { email, otp }
 * Verifies OTP, marks it as consumed, and returns JWT.
 */
export const verifyEmailOtp = async (req: Request, res: Response): Promise<any> => {
  try {
    const emailInput = req.body?.email;
    const otp = req.body?.otp;

    if (!emailInput || typeof emailInput !== "string" || !otp || typeof otp !== "string") {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        error: { code: "MISSING_FIELDS", message: "email and otp are required" },
      });
    }

    const email = normalizeEmail(emailInput);
    const otpHash = hashOtpCode(email, otp);
    const now = new Date();

    // @ts-ignore prisma client may be stale in editor until prisma generate reruns
    const otpRecord = await prisma.emailOtp.findFirst({
      where: {
        email,
        codeHash: otpHash,
        consumedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
    });

    if (!otpRecord) {
      return res.status(401).json({
        success: false,
        error: { code: "INVALID_OTP", message: "Invalid or expired OTP" },
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({
        success: false,
        error: { code: "USER_NOT_FOUND", message: "User not found" },
      });
    }

    // @ts-ignore prisma client may be stale in editor until prisma generate reruns
    await prisma.emailOtp.update({
      where: { id: otpRecord.id },
      data: { consumedAt: now },
    });

    const needsOnboarding = isOnboardingRequired(user);
    const role = user.appRole ?? "onboarding";
    const token = generateTokenWithPayload({
      userId: String(user.id),
      user_id: user.id,
      role,
    });

    return res.status(200).json({
      success: true,
      token,
      onboardingRequired: needsOnboarding,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        surname: user.surname,
        role: user.appRole,
      },
    });
  } catch (error) {
    console.error("verifyEmailOtp error:", error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: (error as Error).message },
    });
  }
};

/**
 * POST /api/auth/onboarding
 * header: Authorization: Bearer <backend_jwt>
 * body: { name, surname, role }
 */
export const completeManualOnboarding = async (req: AuthRequest, res: Response): Promise<any> => {
  try {
    const userId = req.user?.id;
    const { name, surname, role } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Authentication required" },
      });
    }

    const trimmedName = typeof name === "string" ? name.trim() : "";
    const trimmedSurname = typeof surname === "string" ? surname.trim() : "";
    const appRole = validAppRole(role);

    if (!trimmedName || !trimmedSurname || !appRole) {
      return res.status(STATUS.BAD_REQUEST).json({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "name, surname and role (tenant|landlord) are required",
        },
      });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        name: trimmedName,
        surname: trimmedSurname,
        appRole,
      },
    });

    const token = generateTokenWithPayload({
      userId: String(updated.id),
      user_id: updated.id,
      role: updated.appRole ?? "tenant",
    });

    return res.status(200).json({
      success: true,
      token,
      onboardingRequired: false,
      user: {
        id: updated.id,
        email: updated.email,
        name: updated.name,
        surname: updated.surname,
        role: updated.appRole,
      },
    });
  } catch (error) {
    console.error("completeManualOnboarding error:", error);
    return res.status(500).json({
      success: false,
      error: { code: "SERVER_ERROR", message: (error as Error).message },
    });
  }
};