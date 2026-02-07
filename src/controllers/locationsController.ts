/* eslint-disable */

import firebase from "../firebase";
import { Response } from "express";
import {
  getFirestore,
  collection,
  getDocs,
  query,
  where,
  doc,
  updateDoc,
} from "firebase/firestore";
import { AuthenticatedRequest } from "../middleware/auth";

const db = getFirestore(firebase);

export const getAllLocations = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: Missing user ID",
      });
    }

    console.log("user id", userId)

    const locationsRef = collection(db, "locations");
    const q = query(locationsRef, where("userId", "==", userId));
    const snapshot = await getDocs(q);

    const locations = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json({
      success: true,
      locations,
    });
  } catch (error) {
    console.error("Error fetching locations:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch locations",
    });
  }
};


export const updateLocation = async (
  req: AuthenticatedRequest,
  res: Response
):Promise<any> =>  {
  const locationId = req.params["locationId"];
  const updatedData = req.body;

  console.log("Body data", updatedData);
  console.log("lOC ID", locationId)

  if (!locationId) {
    return res
      .status(400)
      .json({ success: false, message: "Location ID is required" });
  }

  try {
    const locationRef = doc(db, "locations", locationId);
    await updateDoc(locationRef, {
      ...updatedData,
      updatedAt: new Date().toISOString(),
    });

    return res.status(200).json({
      success: true,
      message: "Location updated successfully",
    });
  } catch (error) {
    console.error("Error updating location:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update location",
    });
  }
};




