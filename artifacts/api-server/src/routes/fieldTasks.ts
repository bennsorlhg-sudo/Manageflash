import { Router } from "express";
import { db } from "@workspace/db";
import { fieldTasksTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

router.get("/field-tasks", async (req, res) => {
  const { status, engineerName } = req.query as Record<string, string>;
  const conditions = [];
  if (status) conditions.push(eq(fieldTasksTable.status, status));
  if (engineerName) conditions.push(eq(fieldTasksTable.assignedEngineerName, engineerName));
  const tasks = await db
    .select()
    .from(fieldTasksTable)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(fieldTasksTable.createdAt);
  res.json(tasks);
});

router.post("/field-tasks", async (req, res) => {
  const { taskType, serviceNumber, clientName, location, phoneNumber, assignedEngineerName } = req.body as Record<string, string>;
  if (!taskType || !serviceNumber || !location || !phoneNumber) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  const [task] = await db.insert(fieldTasksTable).values({
    taskType,
    serviceNumber,
    clientName: clientName ?? null,
    location,
    phoneNumber,
    status: "new",
    assignedEngineerName: assignedEngineerName ?? null,
  }).returning();
  res.status(201).json(task);
});

router.get("/field-tasks/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [task] = await db.select().from(fieldTasksTable).where(eq(fieldTasksTable.id, id));
  if (!task) {
    res.status(404).json({ error: "Field task not found" });
    return;
  }
  res.json(task);
});

router.patch("/field-tasks/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const { notes, photoUrl, assignedEngineerName } = req.body as Record<string, string>;
  const [existing] = await db.select().from(fieldTasksTable).where(eq(fieldTasksTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Field task not found" });
    return;
  }
  const [task] = await db.update(fieldTasksTable)
    .set({ notes: notes ?? existing.notes, photoUrl: photoUrl ?? existing.photoUrl, assignedEngineerName: assignedEngineerName ?? existing.assignedEngineerName })
    .where(eq(fieldTasksTable.id, id))
    .returning();
  res.json(task);
});

router.post("/field-tasks/:id/start", async (req, res) => {
  const id = parseInt(req.params.id);
  const [existing] = await db.select().from(fieldTasksTable).where(eq(fieldTasksTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Field task not found" });
    return;
  }
  const [task] = await db.update(fieldTasksTable)
    .set({ status: "in_progress", startedAt: new Date() })
    .where(eq(fieldTasksTable.id, id))
    .returning();
  res.json(task);
});

router.post("/field-tasks/:id/complete", async (req, res) => {
  const id = parseInt(req.params.id);
  const { notes, photoUrl } = req.body as Record<string, string>;
  const [existing] = await db.select().from(fieldTasksTable).where(eq(fieldTasksTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Field task not found" });
    return;
  }
  const [task] = await db.update(fieldTasksTable)
    .set({ status: "completed", completedAt: new Date(), notes: notes ?? existing.notes, photoUrl: photoUrl ?? existing.photoUrl })
    .where(eq(fieldTasksTable.id, id))
    .returning();
  res.json(task);
});

export default router;
