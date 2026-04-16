import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireRole } from "../lib/auth";

const router = Router();

router.get("/engineers", requireAuth, requireRole("supervisor"), async (_req, res) => {
  const engineers = await db
    .select({
      id: usersTable.id,
      name: usersTable.name,
      phone: usersTable.phone,
      isActive: usersTable.isActive,
    })
    .from(usersTable)
    .where(eq(usersTable.role, "tech_engineer"));
  res.json(engineers);
});

export default router;
