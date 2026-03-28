import { Router } from "express";
import { db } from "@workspace/db";
import { salesPointsTable, salesPointLoansTable } from "@workspace/db/schema";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/sales-points", async (_req, res) => {
  const points = await db.select().from(salesPointsTable).orderBy(salesPointsTable.name);
  res.json(points);
});

router.post("/sales-points", async (req, res) => {
  const { name, ownerName, phoneNumber, location, oldDebt, notes } = req.body as Record<string, string>;
  if (!name || !ownerName || !phoneNumber || !location) {
    res.status(400).json({ error: "Missing required fields", message: "name, ownerName, phoneNumber, location are required" });
    return;
  }
  const [point] = await db.insert(salesPointsTable).values({
    name,
    ownerName,
    phoneNumber,
    location,
    oldDebt: oldDebt ?? "0",
    notes: notes ?? null,
  }).returning();
  res.status(201).json(point);
});

router.get("/sales-points/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [point] = await db.select().from(salesPointsTable).where(eq(salesPointsTable.id, id));
  if (!point) {
    res.status(404).json({ error: "Sales point not found", message: "Sales point not found" });
    return;
  }
  res.json(point);
});

router.patch("/sales-points/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  const [existing] = await db.select().from(salesPointsTable).where(eq(salesPointsTable.id, id));
  if (!existing) {
    res.status(404).json({ error: "Sales point not found", message: "Sales point not found" });
    return;
  }
  const { name, ownerName, phoneNumber, location, notes } = req.body as Record<string, string>;
  const [point] = await db.update(salesPointsTable)
    .set({
      name: name ?? existing.name,
      ownerName: ownerName ?? existing.ownerName,
      phoneNumber: phoneNumber ?? existing.phoneNumber,
      location: location ?? existing.location,
      notes: notes !== undefined ? notes : existing.notes,
      updatedAt: new Date(),
    })
    .where(eq(salesPointsTable.id, id))
    .returning();
  res.json(point);
});

router.get("/sales-points/:id/loans", async (req, res) => {
  const salesPointId = parseInt(req.params.id);
  const loans = await db.select().from(salesPointLoansTable).where(eq(salesPointLoansTable.salesPointId, salesPointId)).orderBy(salesPointLoansTable.recordedAt);
  res.json(loans);
});

router.post("/sales-points/:id/loans", async (req, res) => {
  const salesPointId = parseInt(req.params.id);
  const [existing] = await db.select().from(salesPointsTable).where(eq(salesPointsTable.id, salesPointId));
  if (!existing) {
    res.status(404).json({ error: "Sales point not found", message: "Sales point not found" });
    return;
  }
  const { direction, amount, notes } = req.body as Record<string, string>;
  if (!direction || !amount) {
    res.status(400).json({ error: "Missing required fields", message: "direction and amount are required" });
    return;
  }
  const [loan] = await db.insert(salesPointLoansTable).values({
    salesPointId,
    direction,
    amount,
    notes: notes ?? null,
  }).returning();
  res.status(201).json(loan);
});

export default router;
