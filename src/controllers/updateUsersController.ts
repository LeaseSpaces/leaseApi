/* eslint-disable */

import firebase from "../firebase";
import { Response } from "express";
import {
  getFirestore,
  doc,
  updateDoc,
} from "firebase/firestore";
import { AuthenticatedRequest } from "../middleware/auth";
import crypto from "crypto";

const db = getFirestore(firebase);

export const updateUser = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    const userId  = req.params["userId"];
    const updateData = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields provided to update",
      });
    }

    // Optionally hash password if it's part of update
    if (updateData.password) {
      updateData.password = crypto
        .createHash("sha1")
        .update(updateData.password)
        .digest("hex");
    }

    const userRef = doc(db, "users", userId);
    await updateDoc(userRef, updateData);

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
    });
  } catch (error) {
    console.error("Error updating user:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update user",
    });
  }
};



