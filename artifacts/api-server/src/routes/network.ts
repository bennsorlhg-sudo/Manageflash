import { Router } from "express";
import { db } from "@workspace/db";
import { hotspotPointsTable, broadbandPointsTable, salesPointsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";

const router = Router();

router.get("/hotspot-points", requireAuth, async (_req, res) => {
  const points = await db.select().from(hotspotPointsTable).orderBy(hotspotPointsTable.name);
  res.json(points);
});

router.get("/broadband-points", requireAuth, async (_req, res) => {
  const points = await db.select().from(broadbandPointsTable).orderBy(broadbandPointsTable.name);
  res.json(points);
});

router.get("/sales-points", requireAuth, async (_req, res) => {
  const points = await db.select().from(salesPointsTable).orderBy(salesPointsTable.name);
  res.json(points);
});

export default router;
