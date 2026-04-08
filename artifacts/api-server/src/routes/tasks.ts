import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { tasksTable, usersTable } from "@workspace/db/schema";
import { eq, desc, and, or, isNull } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

/* ─── إنشاء مهمة ─── */
router.post("/tasks", requireAuth, async (req, res) => {
  try {
    const { title, description, targetRole, assignedToId, priority } = req.body as {
      title: string;
      description: string;
      targetRole: "finance_manager" | "supervisor" | "tech_engineer";
      assignedToId?: number;
      priority?: "low" | "medium" | "high" | "urgent";
    };

    if (!title || !description || !targetRole) {
      res.status(400).json({ error: "title, description, and targetRole are required" });
      return;
    }

    /* جلب اسم الشخص المحدد إن وُجد */
    let targetPersonName: string | null = null;
    if (assignedToId) {
      const [person] = await db.select({ name: usersTable.name })
        .from(usersTable).where(eq(usersTable.id, assignedToId));
      targetPersonName = person?.name ?? null;
    }

    const [task] = await db.insert(tasksTable).values({
      title,
      description,
      targetRole,
      assignedToId: assignedToId ?? null,
      targetPersonName,
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

/* ─── جلب المهام ─── */
router.get("/tasks", requireAuth, async (req, res) => {
  try {
    const { targetRole, assignedToId, myTasks } = req.query as {
      targetRole?: string;
      assignedToId?: string;
      myTasks?: string;
    };

    let tasks: any[];

    if (myTasks === "1" && req.currentUser) {
      /* مهامي: إما مُسندة لي مباشرة، أو (بلا تحديد شخص وتستهدف دوري) */
      tasks = await db.select().from(tasksTable)
        .where(
          or(
            eq(tasksTable.assignedToId, req.currentUser.id),
            and(
              isNull(tasksTable.assignedToId),
              eq(tasksTable.targetRole, req.currentUser.role as any)
            )
          )
        )
        .orderBy(desc(tasksTable.createdAt));
    } else if (assignedToId) {
      tasks = await db.select().from(tasksTable)
        .where(eq(tasksTable.assignedToId, parseInt(assignedToId)))
        .orderBy(desc(tasksTable.createdAt));
    } else if (targetRole) {
      tasks = await db.select().from(tasksTable)
        .where(eq(tasksTable.targetRole, targetRole as any))
        .orderBy(desc(tasksTable.createdAt));
    } else {
      tasks = await db.select().from(tasksTable).orderBy(desc(tasksTable.createdAt));
    }

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tasks", details: String(error) });
  }
});

/* ─── تحديث مهمة ─── */
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

/* ─── حذف مهمة ─── */
router.delete("/tasks/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(tasksTable).where(eq(tasksTable.id, id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Failed to delete task", details: String(error) });
  }
});

export default router;
