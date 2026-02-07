import { AccountType, UserRole } from "@prisma/client";
import { firebaseAdmin } from "../config/firebase-admin";
import { prisma } from "../config/prisma";
import { generateToken } from "../utils/jwt";

export const authService = {
  handleFirebaseAuth: async (idToken: string, registrationType: AccountType) => {
    // 1. Verify ID token with Firebase Admin
    const decoded = await firebaseAdmin.auth().verifyIdToken(idToken);
    const uid = decoded.uid;
    const email = decoded.email ?? "";
    const name = decoded.name ?? "";

    // 2. Find or create user in Neon (Prisma)
    let user = await prisma.user.findUnique({
      where: { socialUserId: uid },
    });

    if (!user) {
      user = await prisma.user.create({
        data: {
          name: name || "",
          surname: "",
          email: email || "",
          password: null,
          roleId: 1,
          registrationType,
          socialUserId: uid,
          appRole: UserRole.tenant,
        },
      });
    }

    // 3. Backend JWT (userId) for auth middleware
    const token = generateToken(String(user.id));
    return { user, token };
  },
};
