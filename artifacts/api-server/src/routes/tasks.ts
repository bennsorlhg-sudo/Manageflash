import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { tasksTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";

const router: IRouter = Router();

router.post("/tasks", async (req, res) => {
  try {
    const { title, description, targetRole, targetPersonName } = req.body as {
      title: string;
      description: string;
      targetRole: "finance_manager" | "supervisor" | "tech_engineer";
      targetPersonName?: string;
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
      assignedByRole: "owner",
      status: "pending",
    }).returning();

    res.status(201).json(task);
  } catch (error) {
    res.status(500).json({ error: "Failed to create task", details: String(error) });
  }
});

router.get("/tasks", async (req, res) => {
  try {
    const { targetRole } = req.query as { targetRole?: string };

    let query = db.select().from(tasksTable).orderBy(desc(tasksTable.createdAt));

    const tasks = targetRole
      ? await db.select().from(tasksTable).where(eq(tasksTable.targetRole, targetRole as "finance_manager" | "supervisor" | "tech_engineer")).orderBy(desc(tasksTable.createdAt))
      : await query;

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tasks", details: String(error) });
  }
});

export default router;
