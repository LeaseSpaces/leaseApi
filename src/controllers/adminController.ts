/* eslint-disable */

import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { AuthRequest } from "../middleware/auth.middleware";

export const getAdminProfile = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    const admin = await prisma.admin.findFirst({
      where: { userId: authReq.user.id },
      include: { user: true },
    });
    if (!admin) {
      res.status(404).json({ success: false, message: "Admin profile not found" });
      return;
    }
    res.status(200).json({ success: true, admin });
  } catch (error) {
    res.status(500).json({ message: "Error fetching profile", error });
  }
};

export const deleteAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    const authReq = req as AuthRequest;
    if (!authReq.user) {
      res.status(401).json({ success: false, message: "Unauthorized" });
      return;
    }
    await prisma.admin.deleteMany({ where: { userId: authReq.user.id } });
    res.status(200).json({ success: true, msg: "Admin deleted", admin: { id: authReq.user.id } });
  } catch (error) {
    res.status(500).json({ message: "Error deleting", error, success: false });
  }
};

export const addAdmin = async (req: Request, res: Response): Promise<void> => {
  try {
    // TODO: create Admin record linked to user when needed
    res.status(501).json({ success: false, message: "Not implemented" });
  } catch (error) {
    res.status(500).json({ message: "Error adding admin", error });
  }
};

/**
 * GET /admin/dashboard — Dashboard stats (LeaseSpaces docs).
 */
export const getDashboard = async (_req: Request, res: Response): Promise<void> => {
  try {
    const [totalProperties, totalUsers, totalApplications, pendingApplications] = await Promise.all([
      prisma.property.count(),
      prisma.user.count(),
      prisma.application.count(),
      prisma.application.count({ where: { status: "pending" } }),
    ]);

    res.status(200).json({
      success: true,
      stats: {
        totalProperties,
        totalUsers,
        totalApplications,
        pendingApplications,
        revenue: { monthly: 0, currency: "ZAR" },
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to load dashboard stats",
        details: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
};

/**
 * GET /admin/properties/analytics?period=7d|30d|90d|1y — Property analytics.
 */
export const getPropertyAnalytics = async (req: Request, res: Response): Promise<void> => {
  try {
    const period = (req.query.period as string) || "30d";
    const since = getSinceDate(period);

    const [applicationsCount, propertiesCount, topLocationsRaw] = await Promise.all([
      prisma.application.count({ where: { createdAt: { gte: since } } }),
      prisma.property.count({ where: { createdAt: { gte: since } } }),
      prisma.property.findMany({
        where: { createdAt: { gte: since } },
        select: { location: true },
      }),
    ]);

    const locationMap = new Map<string, number>();
    for (const p of topLocationsRaw) {
      const loc = p.location as { city?: string } | null;
      const city = loc?.city ?? "Unknown";
      locationMap.set(city, (locationMap.get(city) ?? 0) + 1);
    }
    const topLocations = Array.from(locationMap.entries())
      .map(([city, count]) => ({ city, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const conversionRate = propertiesCount > 0 ? Math.round((applicationsCount / propertiesCount) * 1000) / 10 : 0;

    res.status(200).json({
      success: true,
      analytics: {
        views: 0,
        applications: applicationsCount,
        conversionRate,
        topLocations,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to load property analytics",
        details: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
};

function getSinceDate(period: string): Date {
  const d = new Date();
  switch (period) {
    case "7d":
      d.setDate(d.getDate() - 7);
      break;
    case "90d":
      d.setDate(d.getDate() - 90);
      break;
    case "1y":
      d.setFullYear(d.getFullYear() - 1);
      break;
    default:
      d.setDate(d.getDate() - 30);
  }
  return d;
}


