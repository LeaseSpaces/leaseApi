/* eslint-disable */

import { Request, Response } from "express";
import { firebaseAdmin } from "../config/firebase-admin";
import { AuthRequest } from "../middleware/auth.middleware";

interface LocationRequest extends Request {
  userId?: string;
  user?: { id: number };
}

const db = () => firebaseAdmin.firestore();

export const getAllLocations = async (req: LocationRequest, res: Response): Promise<void> => {
  try {
    const userId = req.userId || (req.user?.id != null ? String(req.user.id) : undefined);

    if (!userId) {
      res.status(401).json({
        success: false,
        message: "Unauthorized: Missing user ID",
      });
      return;
    }

    const snapshot = await db()
      .collection("locations")
      .where("userId", "==", userId)
      .get();

    const locations = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json({ success: true, locations });
  } catch (error) {
    console.error("Error fetching locations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch locations",
      details: error instanceof Error ? error.message : undefined,
    });
  }
};

export const getAdminLocations = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const userIdQuery = req.query.userId ? String(req.query.userId) : undefined;
    const col = db().collection("locations");
    const snapshot = userIdQuery
      ? await col.where("userId", "==", userIdQuery).get()
      : await col.get();

    const locations = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.status(200).json({ success: true, locations });
  } catch (error) {
    console.error("Error fetching admin locations:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch locations",
      details: error instanceof Error ? error.message : undefined,
    });
  }
};

export const updateLocation = async (req: Request, res: Response): Promise<void> => {
  const locationId = String(req.params["locationId"] ?? "");
  const updatedData = req.body;

  if (!locationId) {
    res.status(400).json({ success: false, message: "Location ID is required" });
    return;
  }

  try {
    await db()
      .collection("locations")
      .doc(locationId)
      .update({
        ...updatedData,
        updatedAt: new Date().toISOString(),
      });

    res.status(200).json({
      success: true,
      message: "Location updated successfully",
    });
  } catch (error) {
    console.error("Error updating location:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update location",
      details: error instanceof Error ? error.message : undefined,
    });
  }
};
