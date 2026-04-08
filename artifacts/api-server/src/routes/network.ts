import { Router } from "express";
import { db } from "@workspace/db";
import { hotspotPointsTable, broadbandPointsTable, salesPointsTable } from "@workspace/db";
import { requireAuth } from "../lib/auth";
import { eq, ilike, or, and, asc, sql } from "drizzle-orm";

const router = Router();

const HOTSPOT_FIELDS = [
  "name", "location", "status", "notes", "supervisorId",
  "hotspotType", "flashNumber", "deviceName",
  "clientName", "clientPhone", "subscriptionFee",
  "ipAddress", "isClientOwned", "locationUrl",
  "installPhoto", "installedByName", "installDate",
];

const BROADBAND_FIELDS = [
  "name", "location", "status", "notes", "supervisorId", "speed",
  "flashNumber", "subscriptionName", "clientName", "clientPhone",
  "subscriptionFee", "modemFee", "locationUrl", "installedByName", "installDate",
];

router.get("/hotspot-points", requireAuth, async (req, res) => {
  try {
    const { search, type, limit = "50", offset = "0" } = req.query as any;
    const lim = Math.min(parseInt(limit) || 50, 200);
    const off = parseInt(offset) || 0;

    const conditions: any[] = [];
    if (type === "internal") conditions.push(eq(hotspotPointsTable.hotspotType, "internal"));
    else if (type === "external") conditions.push(eq(hotspotPointsTable.hotspotType, "external"));

    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      conditions.push(or(
        ilike(hotspotPointsTable.name, q),
        ilike(hotspotPointsTable.location, q),
        ilike(hotspotPointsTable.clientName, q),
        ilike(hotspotPointsTable.deviceName, q),
      ));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countRows] = await Promise.all([
      db.select().from(hotspotPointsTable)
        .where(where)
        .orderBy(asc(hotspotPointsTable.flashNumber))
        .limit(lim).offset(off),
      db.select({ count: sql<number>`count(*)` }).from(hotspotPointsTable).where(where),
    ]);

    res.json({ data: rows, total: Number(countRows[0]?.count ?? 0), offset: off, limit: lim });
  } catch (err) {
    res.status(500).json({ error: "فشل في جلب النقاط", details: String(err) });
  }
});

router.get("/hotspot-points/flash-numbers", requireAuth, async (_req, res) => {
  const rows = await db.select({ n: hotspotPointsTable.flashNumber }).from(hotspotPointsTable);
  res.json(rows.map(r => r.n).filter(Boolean).sort((a: any, b: any) => a - b));
});

router.post("/hotspot-points", requireAuth, async (req, res) => {
  try {
    const vals: any = { status: "active" };
    for (const f of HOTSPOT_FIELDS) {
      if (req.body[f] !== undefined) vals[f] = req.body[f];
    }
    if (!vals.name && vals.flashNumber) vals.name = `فلاش ${vals.flashNumber}`;
    // Check for duplicate flash number
    if (vals.flashNumber) {
      const existing = await db.select({ id: hotspotPointsTable.id, name: hotspotPointsTable.name })
        .from(hotspotPointsTable)
        .where(eq(hotspotPointsTable.flashNumber, Number(vals.flashNumber)))
        .limit(1);
      if (existing.length > 0) {
        return res.status(409).json({ error: `الجهاز برقم ${vals.flashNumber} موجود بالفعل (${existing[0].name})، يجب حذفه أولاً ثم إضافة الجديد` });
      }
    }
    const [row] = await db.insert(hotspotPointsTable).values(vals).returning();
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "فشل في إضافة النقطة", details: String(error) });
  }
});

router.put("/hotspot-points/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates: any = { updatedAt: new Date() };
    for (const f of HOTSPOT_FIELDS) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }
    const [row] = await db.update(hotspotPointsTable).set(updates)
      .where(eq(hotspotPointsTable.id, id)).returning();
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "فشل في تحديث النقطة", details: String(error) });
  }
});

router.delete("/hotspot-points/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(hotspotPointsTable).where(eq(hotspotPointsTable.id, id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "فشل في حذف النقطة", details: String(error) });
  }
});

router.get("/broadband-points", requireAuth, async (req, res) => {
  try {
    const { search, limit = "50", offset = "0" } = req.query as any;
    const lim = Math.min(parseInt(limit) || 50, 200);
    const off = parseInt(offset) || 0;

    const conditions: any[] = [];
    if (search && search.trim()) {
      const q = `%${search.trim()}%`;
      conditions.push(or(
        ilike(broadbandPointsTable.name, q),
        ilike(broadbandPointsTable.location, q),
        ilike(broadbandPointsTable.clientName, q),
        ilike(broadbandPointsTable.subscriptionName, q),
      ));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const [rows, countRows] = await Promise.all([
      db.select().from(broadbandPointsTable)
        .where(where)
        .orderBy(asc(broadbandPointsTable.flashNumber))
        .limit(lim).offset(off),
      db.select({ count: sql<number>`count(*)` }).from(broadbandPointsTable).where(where),
    ]);

    res.json({ data: rows, total: Number(countRows[0]?.count ?? 0), offset: off, limit: lim });
  } catch (err) {
    res.status(500).json({ error: "فشل في جلب النقاط", details: String(err) });
  }
});

router.get("/broadband-points/flash-numbers", requireAuth, async (_req, res) => {
  const rows = await db.select({ n: broadbandPointsTable.flashNumber }).from(broadbandPointsTable);
  res.json(rows.map(r => r.n).filter(Boolean).sort((a: any, b: any) => a - b));
});

router.post("/broadband-points", requireAuth, async (req, res) => {
  try {
    const vals: any = { status: "active" };
    for (const f of BROADBAND_FIELDS) {
      if (req.body[f] !== undefined) vals[f] = req.body[f];
    }
    if (!vals.name && vals.flashNumber) vals.name = `فلاش P${vals.flashNumber}`;
    const [row] = await db.insert(broadbandPointsTable).values(vals).returning();
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "فشل في إضافة نقطة الباقات", details: String(error) });
  }
});

router.put("/broadband-points/:id", requireAuth, async (req, res) => {
  const id = parseInt(req.params.id);

  const buildUpdates = (fields: string[]) => {
    const u: any = { updatedAt: new Date() };
    for (const f of fields) {
      if (req.body[f] !== undefined) u[f] = req.body[f];
    }
    return u;
  };

  /* الحقول الأساسية الآمنة دائماً */
  const CORE = ["name", "location", "status", "notes", "supervisorId", "speed",
    "flashNumber", "subscriptionName", "clientName", "clientPhone", "locationUrl", "subscriptionFee"];

  /* الحقول الجديدة التي قد تكون غير موجودة في قواعد بيانات قديمة */
  const EXTENDED = ["modemFee", "installedByName", "installDate"];

  try {
    const updates = buildUpdates([...CORE, ...EXTENDED]);
    const [row] = await db.update(broadbandPointsTable).set(updates)
      .where(eq(broadbandPointsTable.id, id)).returning();
    if (!row) return res.status(404).json({ error: "النقطة غير موجودة" });
    return res.json(row);
  } catch (err1: any) {
    /* fallback: حاول بدون الحقول الجديدة إذا كانت الأعمدة غير موجودة */
    try {
      const updates = buildUpdates(CORE);
      const [row] = await db.update(broadbandPointsTable).set(updates)
        .where(eq(broadbandPointsTable.id, id)).returning();
      if (!row) return res.status(404).json({ error: "النقطة غير موجودة" });
      return res.json(row);
    } catch (err2: any) {
      return res.status(500).json({ error: "فشل في تحديث نقطة الباقات", details: String(err2) });
    }
  }
});

router.delete("/broadband-points/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(broadbandPointsTable).where(eq(broadbandPointsTable.id, id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "فشل في حذف النقطة", details: String(error) });
  }
});

router.get("/sales-points", requireAuth, async (_req, res) => {
  const points = await db.select().from(salesPointsTable).orderBy(salesPointsTable.name);
  res.json(points);
});

router.post("/sales-points", requireAuth, async (req, res) => {
  try {
    const { name, location, managerId, notes, ownerName, phoneNumber, oldDebt } = req.body;
    const [row] = await db.insert(salesPointsTable)
      .values({ name, location, managerId, notes, ownerName: ownerName ?? "", phoneNumber: phoneNumber ?? "", oldDebt })
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
    for (const f of ["name", "location", "managerId", "notes", "ownerName", "phoneNumber", "oldDebt"]) {
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
