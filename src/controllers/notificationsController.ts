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
  query,
  where,
} from "firebase/firestore";
import { AuthenticatedRequest } from "../middleware/auth";

const db = getFirestore(firebase);

// Create Notification
export const createNotification = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    const { userId, notificationType, title, message, createdAt } = req.body;

    if (!userId || !notificationType || !title || !message || !createdAt) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields.",
      });
    }

    const newNotification = {
      userId,
      notificationType,
      title,
      message,
      createdAt,
    };

    const ref = await addDoc(collection(db, "notifications"), newNotification);
    return res.status(200).json({
      success: true,
      message: "Notification created",
      notificationId: ref.id,
    });
  } catch (error) {
    console.error("Error creating notification:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to create notification",
    });
  }
};

// Update Notification
export const updateNotification = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    const notificationId  = req.params["notificationId"];
    const updateData = req.body;

    if (!notificationId) {
      return res.status(400).json({
        success: false,
        message: "Notification ID is required",
      });
    }

    if (!updateData || Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: "No fields provided to update",
      });
    }

    const ref = doc(db, "notifications", notificationId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      return res
        .status(404)
        .json({ success: false, message: "Notification not found" });
    }

    await updateDoc(ref, updateData);
    return res.status(200).json({
      success: true,
      message: "Notification updated",
    });
  } catch (error) {
    console.error("Error updating notification:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update notification",
    });
  }
};

// Delete Notification
export const deleteNotification = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    const notificationId = req.params["notificationId"];

    if (!notificationId) {
      return res.status(400).json({
        success: false,
        message: "Notification ID is required",
      });
    }

    await deleteDoc(doc(db, "notifications", notificationId));
    return res.status(200).json({
      success: true,
      message: "Notification deleted",
    });
  } catch (error) {
    console.error("Error deleting notification:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete notification",
    });
  }
};

// Get Notifications for a User
export const getNotifications = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    const userId  = req.params["userId"];

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const q = query(
      collection(db, "notifications"),
      where("userId", "==", userId)
    );
    const snapshot = await getDocs(q);

    const notifications = snapshot.docs.map((doc) => ({
      notificationId: doc.id,
      ...doc.data(),
    }));

    return res.status(200).json({
      success: true,
      notifications,
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to get notifications",
    });
  }
};


export const vetServiceProvider = async (
  req: AuthenticatedRequest,
  res: Response
): Promise<any> => {
  try {
    const userId = req.params["userId"];
    const { email, status, statusDesign, message } = req.body;

    if (
      !userId ||
      !email ||
      status === undefined ||
      !statusDesign ||
      !message
    ) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields",
      });
    }

    const userRef = doc(db, "users", userId);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Update user's status and statusDesign
    await updateDoc(userRef, {
      status,
      statusDesign,
    });

    // Create notification with status included
    await addDoc(collection(db, "notifications"), {
      userId,
      notificationType: "vetting-status",
      title: "Vetting Update",
      message: message,
      status, // <-- include status in the notification
      createdAt: new Date().toISOString(),
    });

    return res.status(200).json({
      success: true,
      message: "User status updated and notification sent",
      data: {
        email,
        status,
        statusDesign,
        message,
      },
    });
  } catch (error) {
    console.error("Error vetting service provider:", error);
    return res.status(500).json({
      success: false,
      message: "An error occurred while vetting the service provider",
    });
  }
};



