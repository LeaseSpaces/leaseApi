/* eslint-disable */

import { UserRole } from "@prisma/client";
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
import { TwoFAService } from "../services/twofa";
import { generateToken } from "../utils/jwt";
import { firebaseAdmin } from "../config/firebase-admin";
import { prisma } from "../config/prisma";

const db = getFirestore(firebase);

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

    let user = await prisma.user.findUnique({
      where: { socialUserId: uid },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name,
          surname: "",
          email: email || "unknown@leasespaces.local",
          password: null,
          roleId: 1,
          registrationType: "GOOGLE",
          socialUserId: uid,
          appRole: UserRole.tenant,
        },
      });
    }

    const token = generateToken(String(user.id));

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