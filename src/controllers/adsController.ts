/* eslint-disable */

import firebase from "../firebase";
import { Response } from "express";
import {
  getFirestore,
  collection,
  addDoc,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { AuthenticatedRequest } from "../middleware/auth";

const db = getFirestore(firebase);

export const createAd = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    const {
      title,
      owner_id,
      userName,
      description,
      category,
      location,
      price,
      images = [],
      documents = [],
    } = req.body;

    if (
      !title ||
      !description ||
      !category ||
      !location ||
      price === undefined
    ) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: title, description, category, location, or price",
      });
    }

    // Enforce max file limits
    if (images.length > 3) {
      return res.status(400).json({
        success: false,
        message: "You can only upload up to 3 images.",
      });
    }

    if (documents.length > 5) {
      return res.status(400).json({
        success: false,
        message: "You can only upload up to 5 documents.",
      });
    }

    // Prepare ad object
    const newAd = {
      title,
      owner_id: owner_id || null,
      userName,
      description,
      category,
      location,
      price,
      images,
      status:"open",
      numOfBids:0,
      documents,
      createdAt: new Date().toISOString(),
    };

    // Save to Firestore
    const adRef = await addDoc(collection(db, "ads"), newAd);

    return res.status(200).json({
      success: true,
      message: "Ad created successfully",
      adId: adRef.id,
    });
  } catch (error) {
    console.error("Error creating ad:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create ad",
    });
  }
};


export const updateAd = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    const adId = req.params["adId"];
    const updateData = req.body;

    const adRef = doc(db, "ads", adId);
    const adSnap = await getDoc(adRef);

    if (!adSnap.exists()) {
      return res.status(404).json({
        success: false,
        message: "Ad not found",
      });
    }

    await updateDoc(adRef, {
      ...updateData,
      updatedAt: new Date().toISOString(),
    });

    return res.status(200).json({
      success: true,
      message: "Ad updated successfully",
    });
  } catch (error) {
    console.error("Error updating ad:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update ad",
    });
  }
};


export const deleteAd = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    const adId = req.params["adId"];

    const adRef = doc(db, "ads", adId);
    await deleteDoc(adRef);

    return res.status(200).json({
      success: true,
      message: "Ad deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting ad:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete ad",
    });
  }
};


export const getAllAds = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    const adsRef = collection(db, "ads");
    const snapshot = await getDocs(adsRef);

    const ads = snapshot.docs.map((doc) => ({
      adId: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json({
      success: true,
      data: ads,
    });
  } catch (error) {
    console.error("Error fetching ads:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve ads",
    });
  }
};


export const getAd = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    const adId  = req.params["adId"];

    const adRef = doc(db, "ads", adId);
    const adSnap = await getDoc(adRef);

    if (!adSnap.exists()) {
      return res.status(404).json({
        success: false,
        message: "Ad not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        adId: adSnap.id,
        ...adSnap.data(),
      },
    });
  } catch (error) {
    console.error("Error fetching ad:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to retrieve ad",
    });
  }
};