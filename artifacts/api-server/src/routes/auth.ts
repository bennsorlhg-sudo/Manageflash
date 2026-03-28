import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  verifyPassword,
  createToken,
  requireAuth,
} from "../lib/auth";

const router = Router();

router.post("/login", async (req, res) => {
  const { phone, password } = req.body as { phone?: string; password?: string };

  if (!phone || !password) {
    res.status(400).json({ error: "bad_request", message: "Phone and password are required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.phone, phone))
    .limit(1);

  if (!user) {
    res.status(401).json({ error: "invalid_credentials", message: "Invalid phone or password" });
    return;
  }

  if (!user.isActive) {
    res.status(401).json({ error: "account_inactive", message: "Account is deactivated" });
    return;
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "invalid_credentials", message: "Invalid phone or password" });
    return;
  }

  const token = createToken(user.id, user.role);

  res.json({
    token,
    user: {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
    },
  });
});

router.get("/me", requireAuth, (req, res) => {
  const user = req.currentUser!;
  res.json({
    id: user.id,
    name: user.name,
    phone: user.phone,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt,
  });
});

export default router;
