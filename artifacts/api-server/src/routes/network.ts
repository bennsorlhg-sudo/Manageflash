import { Router } from "express";
import { db } from "@workspace/db";
import { hotspotPointsTable, broadbandPointsTable, salesPointsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { eq } from "drizzle-orm";

const router = Router();

router.get("/hotspot-points", requireAuth, async (_req, res) => {
  const points = await db.select().from(hotspotPointsTable).orderBy(hotspotPointsTable.name);
  res.json(points);
});

router.post("/hotspot-points", requireAuth, async (req, res) => {
  try {
    const { name, location, status, supervisorId, notes } = req.body;
    const [row] = await db.insert(hotspotPointsTable)
      .values({ name, location, status: status ?? "empty", supervisorId, notes })
      .returning();
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "فشل في إضافة النقطة", details: String(error) });
  }
});

router.put("/hotspot-points/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates: any = { updatedAt: new Date() };
    const fields = ["name", "location", "status", "notes", "supervisorId"];
    for (const f of fields) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }
    const [row] = await db.update(hotspotPointsTable).set(updates)
      .where(eq(hotspotPointsTable.id, id)).returning();
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "فشل في تحديث النقطة", details: String(error) });
  }
});

router.get("/broadband-points", requireAuth, async (_req, res) => {
  const points = await db.select().from(broadbandPointsTable).orderBy(broadbandPointsTable.name);
  res.json(points);
});

router.post("/broadband-points", requireAuth, async (req, res) => {
  try {
    const { name, location, status, supervisorId, speed, notes } = req.body;
    const [row] = await db.insert(broadbandPointsTable)
      .values({ name, location, status: status ?? "empty", supervisorId, speed, notes })
      .returning();
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "فشل في إضافة نقطة الباقات", details: String(error) });
  }
});

router.put("/broadband-points/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates: any = { updatedAt: new Date() };
    const fields = ["name", "location", "status", "notes", "speed", "supervisorId"];
    for (const f of fields) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }
    const [row] = await db.update(broadbandPointsTable).set(updates)
      .where(eq(broadbandPointsTable.id, id)).returning();
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "فشل في تحديث نقطة الباقات", details: String(error) });
  }
});

router.get("/sales-points", requireAuth, async (_req, res) => {
  const points = await db.select().from(salesPointsTable).orderBy(salesPointsTable.name);
  res.json(points);
});

router.post("/sales-points", requireAuth, async (req, res) => {
  try {
    const { name, location, managerId, notes } = req.body;
    const [row] = await db.insert(salesPointsTable)
      .values({ name, location, managerId, notes })
      .returning();
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "فشل في إضافة نقطة البيع", details: String(error) });
  }
});

router.put("/sales-points/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates: any = { updatedAt: new Date() };
    const fields = ["name", "location", "managerId", "notes"];
    for (const f of fields) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }
    const [row] = await db.update(salesPointsTable).set(updates)
      .where(eq(salesPointsTable.id, id)).returning();
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "فشل في تحديث نقطة البيع", details: String(error) });
  }
});

export default router;
