import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { tasksTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.post("/tasks", requireAuth, async (req, res) => {
  try {
    const { title, description, targetRole, targetPersonName, priority } = req.body as {
      title: string;
      description: string;
      targetRole: "finance_manager" | "supervisor" | "tech_engineer";
      targetPersonName?: string;
      priority?: "low" | "medium" | "high" | "urgent";
    };

    if (!title || !description || !targetRole) {
      res.status(400).json({ error: "title, description, and targetRole are required" });
      return;
    }

    const [task] = await db.insert(tasksTable).values({
      title,
      description,
      targetRole,
      targetPersonName: targetPersonName ?? null,
      assignedByRole: req.currentUser?.role ?? "owner",
      status: "pending",
      priority: priority ?? "medium",
      createdById: req.currentUser?.id,
    }).returning();

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: "Failed to create task", details: String(error) });
  }
});

router.get("/tasks", requireAuth, async (req, res) => {
  try {
    const { targetRole } = req.query as { targetRole?: string };

    const tasks = targetRole
      ? await db.select().from(tasksTable)
          .where(eq(tasksTable.targetRole, targetRole as "finance_manager" | "supervisor" | "tech_engineer"))
          .orderBy(desc(tasksTable.createdAt))
      : await db.select().from(tasksTable).orderBy(desc(tasksTable.createdAt));

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tasks", details: String(error) });
  }
});

router.patch("/tasks/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates: any = { updatedAt: new Date() };
    if (req.body.status) updates.status = req.body.status;
    if (req.body.priority) updates.priority = req.body.priority;
    if (req.body.notes !== undefined) updates.description = req.body.notes;

    const [task] = await db.update(tasksTable).set(updates)
      .where(eq(tasksTable.id, id)).returning();
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: "Failed to update task", details: String(error) });
  }
});

export default router;
