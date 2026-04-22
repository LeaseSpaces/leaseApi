/* eslint-disable */
import { Request, Response } from "express";
import { prisma } from "../config/prisma";
import { hashPassword } from "../utils/password";
import { AgentRole, AccountType } from "@prisma/client";

function normalizeEmail(v: unknown): string {
  return String(v ?? "").trim().toLowerCase();
}

export const createAdminUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const name = String(req.body?.name ?? "").trim();
    const surname = String(req.body?.surname ?? "").trim();
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password ?? "");
    const isSuperAdmin = req.body?.isSuperAdmin === true;

    if (!name || !surname || !email || !password) {
      res.status(400).json({
        success: false,
        error: { code: "MISSING_FIELDS", message: "name, surname, email, password are required" },
      });
      return;
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({
        success: false,
        error: { code: "EMAIL_EXISTS", message: "A user with this email already exists" },
      });
      return;
    }

    const role = await prisma.role.upsert({
      where: { id: 1 },
      create: { id: 1, description: "Default" },
      update: {},
    });

    const user = await prisma.user.create({
      // Prisma client types may lag behind schema changes in some editors; keep this explicit.
      data: {
        name,
        surname,
        email,
        password: hashPassword(password),
        roleId: role.id,
        registrationType: AccountType.EMAIL,
        socialUserId: `admin-${email}-${Date.now()}`,
        appRole: "admin",
        isSuperAdmin,
        admin: {
          create: {},
        },
      } as any,
      include: {
        admin: true,
      },
    });

    res.status(201).json({
      success: true,
      admin: {
        id: user.id,
        name: user.name,
        surname: user.surname,
        email: user.email,
        appRole: user.appRole,
        isSuperAdmin: (user as any).isSuperAdmin === true,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create admin user",
        details: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
};

export const createSupportAgent = async (req: Request, res: Response): Promise<void> => {
  try {
    const name = String(req.body?.name ?? "").trim();
    const email = normalizeEmail(req.body?.email);
    const role = (String(req.body?.role ?? "agent").trim().toLowerCase() || "agent") as AgentRole;
    const maxTickets = req.body?.maxTickets != null ? Number(req.body.maxTickets) : undefined;
    const isActive = req.body?.isActive != null ? Boolean(req.body.isActive) : true;

    if (!name || !email) {
      res.status(400).json({
        success: false,
        error: { code: "MISSING_FIELDS", message: "name and email are required" },
      });
      return;
    }

    const allowed: AgentRole[] = ["agent", "senior_agent", "supervisor"];
    if (!allowed.includes(role)) {
      res.status(400).json({
        success: false,
        error: { code: "INVALID_ROLE", message: "Invalid agent role" },
      });
      return;
    }

    const existing = await prisma.supportAgents.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({
        success: false,
        error: { code: "EMAIL_EXISTS", message: "A support agent with this email already exists" },
      });
      return;
    }

    const agent = await prisma.supportAgents.create({
      data: {
        name,
        email,
        role,
        isActive,
        maxTickets: maxTickets != null && !Number.isNaN(maxTickets) ? maxTickets : 10,
      },
    });

    res.status(201).json({ success: true, agent });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create support agent",
        details: error instanceof Error ? error.message : "Unknown error",
      },
    });
  }
};

