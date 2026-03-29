import { Router } from "express";
import { db } from "@workspace/db";
import {
  repairTicketsTable,
  installationTicketsTable,
  purchaseRequestsTable,
} from "@workspace/db/schema";
import { requireAuth } from "../lib/auth";
import { eq, desc, and } from "drizzle-orm";

const router = Router();

router.get("/tickets/repair", requireAuth, async (req, res) => {
  try {
    const { status } = req.query as any;
    let q = db.select().from(repairTicketsTable).orderBy(desc(repairTicketsTable.createdAt));
    const rows = await q;
    res.json(status ? rows.filter(r => r.status === status) : rows);
  } catch (error) {
    res.status(500).json({ error: "فشل في جلب تذاكر الصيانة", details: String(error) });
  }
});

router.post("/tickets/repair", requireAuth, async (req, res) => {
  try {
    const {
      serviceNumber, clientName, serviceType, problemDescription,
      priority, assignedToId, assignedToName, locationUrl, notes
    } = req.body;

    const [row] = await db.insert(repairTicketsTable).values({
      serviceNumber, clientName, serviceType: serviceType ?? "hotspot",
      problemDescription, status: "pending",
      priority: priority ?? "medium",
      assignedToId, assignedToName, locationUrl, notes,
      createdById: req.currentUser!.id,
    }).returning();

    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "فشل في إنشاء تذكرة الصيانة", details: String(error) });
  }
});

router.patch("/tickets/repair/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates: any = { updatedAt: new Date() };
    const fields = ["status", "priority", "assignedToId", "assignedToName", "notes", "locationUrl"];
    for (const f of fields) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }
    if (req.body.status === "completed") updates.resolvedAt = new Date();

    const [row] = await db.update(repairTicketsTable).set(updates)
      .where(eq(repairTicketsTable.id, id)).returning();
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "فشل في تحديث التذكرة", details: String(error) });
  }
});

router.get("/tickets/installation", requireAuth, async (req, res) => {
  try {
    const { status } = req.query as any;
    const rows = await db.select().from(installationTicketsTable)
      .orderBy(desc(installationTicketsTable.createdAt));
    res.json(status ? rows.filter(r => r.status === status) : rows);
  } catch (error) {
    res.status(500).json({ error: "فشل في جلب تذاكر التركيب", details: String(error) });
  }
});

router.post("/tickets/installation", requireAuth, async (req, res) => {
  try {
    const {
      clientName, clientPhone, serviceType, locationUrl,
      address, notes, assignedToId, assignedToName, scheduledAt
    } = req.body;

    const [row] = await db.insert(installationTicketsTable).values({
      clientName, clientPhone,
      serviceType: serviceType ?? "hotspot_internal",
      locationUrl, address, notes, status: "new",
      assignedToId, assignedToName,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : undefined,
      createdById: req.currentUser!.id,
    }).returning();

    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "فشل في إنشاء تذكرة التركيب", details: String(error) });
  }
});

router.patch("/tickets/installation/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates: any = { updatedAt: new Date() };
    const fields = ["status", "assignedToId", "assignedToName", "notes", "locationUrl", "address", "archiveNotes"];
    for (const f of fields) {
      if (req.body[f] !== undefined) updates[f] = req.body[f];
    }
    if (req.body.status === "completed") updates.completedAt = new Date();
    if (req.body.status === "archived") updates.archivedAt = new Date();

    const [row] = await db.update(installationTicketsTable).set(updates)
      .where(eq(installationTicketsTable.id, id)).returning();
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "فشل في تحديث التذكرة", details: String(error) });
  }
});

router.get("/purchase-requests", requireAuth, async (req, res) => {
  try {
    const rows = await db.select().from(purchaseRequestsTable)
      .orderBy(desc(purchaseRequestsTable.createdAt));
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "فشل في جلب طلبات الشراء", details: String(error) });
  }
});

router.post("/purchase-requests", requireAuth, async (req, res) => {
  try {
    const { description, amount, estimatedCost, notes, quantity, unit, priority } = req.body;
    const finalAmount = amount ?? estimatedCost;
    const [row] = await db.insert(purchaseRequestsTable).values({
      description,
      amount: finalAmount ? String(finalAmount) : undefined,
      requestedById: req.currentUser!.id,
      status: "pending",
      notes: notes || undefined,
      quantity: quantity ? parseInt(quantity) : undefined,
      unit: unit || undefined,
      priority: priority ?? "medium",
    }).returning();
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "فشل في إنشاء طلب الشراء", details: String(error) });
  }
});

router.put("/purchase-requests/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates: any = { updatedAt: new Date() };
    if (req.body.status) updates.status = req.body.status;
    if (req.body.notes !== undefined) updates.notes = req.body.notes;

    const [row] = await db.update(purchaseRequestsTable).set(updates)
      .where(eq(purchaseRequestsTable.id, id)).returning();
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "فشل في تحديث طلب الشراء", details: String(error) });
  }
});

export default router;
