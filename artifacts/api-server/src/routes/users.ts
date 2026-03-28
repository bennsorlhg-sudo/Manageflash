import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq, ne } from "drizzle-orm";
import { requireAuth, requireRole, hashPassword } from "../lib/auth";

const router = Router();

router.get("/", requireAuth, requireRole("owner"), async (_req, res) => {
  const users = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      phone: usersTable.phone,
      role: usersTable.role,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(ne(usersTable.role, "owner"));

  res.json(users);
});

router.post("/", requireAuth, requireRole("owner"), async (req, res) => {
  const { name, phone, password, role } = req.body as {
    name?: string;
    phone?: string;
    password?: string;
    role?: string;
  };

  if (!name || !phone || !password || !role) {
    res.status(400).json({ error: "bad_request", message: "All fields are required" });
    return;
  }

  if (!["finance_manager", "supervisor", "tech_engineer"].includes(role)) {
    res.status(400).json({ error: "bad_request", message: "Invalid role" });
    return;
  }

  const [existing] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.phone, phone))
    .limit(1);

  if (existing) {
    res.status(409).json({ error: "conflict", message: "Phone number already in use" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db
    .insert(usersTable)
    .values({ name, phone, passwordHash, role: role as "finance_manager" | "supervisor" | "tech_engineer", isActive: true })
    .returning({
      id: usersTable.id,
      name: usersTable.name,
      phone: usersTable.phone,
      role: usersTable.role,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    });

  res.status(201).json(user);
});

router.get("/:id", requireAuth, requireRole("owner"), async (req, res) => {
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "bad_request", message: "Invalid user ID" });
    return;
  }

  const [user] = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      phone: usersTable.phone,
      role: usersTable.role,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "not_found", message: "User not found" });
    return;
  }

  res.json(user);
});

router.put("/:id", requireAuth, requireRole("owner"), async (req, res) => {
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "bad_request", message: "Invalid user ID" });
    return;
  }

  const [target] = await db
    .select({ id: usersTable.id, role: usersTable.role })
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);

  if (!target) {
    res.status(404).json({ error: "not_found", message: "User not found" });
    return;
  }

  if (target.role === "owner") {
    res.status(403).json({ error: "forbidden", message: "Cannot modify owner accounts" });
    return;
  }

  const { name, phone, role } = req.body as {
    name?: string;
    phone?: string;
    role?: string;
  };

  const updateData: {
    updatedAt: Date;
    name?: string;
    phone?: string;
    role?: "finance_manager" | "supervisor" | "tech_engineer";
  } = { updatedAt: new Date() };

  if (name) updateData.name = name;
  if (phone) {
    const [existing] = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(eq(usersTable.phone, phone))
      .limit(1);
    if (existing && existing.id !== id) {
      res.status(409).json({ error: "conflict", message: "Phone number already in use" });
      return;
    }
    updateData.phone = phone;
  }
  if (role !== undefined) {
    if (!["finance_manager", "supervisor", "tech_engineer"].includes(role)) {
      res.status(400).json({ error: "bad_request", message: "Invalid role" });
      return;
    }
    updateData.role = role as "finance_manager" | "supervisor" | "tech_engineer";
  }

  const [user] = await db
    .update(usersTable)
    .set(updateData)
    .where(eq(usersTable.id, id))
    .returning({
      id: usersTable.id,
      name: usersTable.name,
      phone: usersTable.phone,
      role: usersTable.role,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    });

  if (!user) {
    res.status(404).json({ error: "not_found", message: "User not found" });
    return;
  }

  res.json(user);
});

router.post("/:id/toggle-active", requireAuth, requireRole("owner"), async (req, res) => {
  const id = parseInt(req.params["id"] as string, 10);
  if (isNaN(id)) {
    res.status(400).json({ error: "bad_request", message: "Invalid user ID" });
    return;
  }

  const [existing] = await db
    .select({ id: usersTable.id, role: usersTable.role, isActive: usersTable.isActive })
    .from(usersTable)
    .where(eq(usersTable.id, id))
    .limit(1);

  if (!existing) {
    res.status(404).json({ error: "not_found", message: "User not found" });
    return;
  }

  if (existing.role === "owner") {
    res.status(403).json({ error: "forbidden", message: "Cannot modify owner accounts" });
    return;
  }

  const [user] = await db
    .update(usersTable)
    .set({ isActive: !existing.isActive, updatedAt: new Date() })
    .where(eq(usersTable.id, id))
    .returning({
      id: usersTable.id,
      name: usersTable.name,
      phone: usersTable.phone,
      role: usersTable.role,
      isActive: usersTable.isActive,
      createdAt: usersTable.createdAt,
    });

  res.json(user);
});

export default router;
