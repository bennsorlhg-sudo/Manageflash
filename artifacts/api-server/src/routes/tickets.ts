import { Router } from "express";
import { db } from "@workspace/db";
import {
  repairTicketsTable,
  installationTicketsTable,
  purchaseRequestsTable,
} from "@workspace/db/schema";
import { hotspotPointsTable, broadbandPointsTable } from "@workspace/db/schema";
import { requireAuth } from "../lib/auth";
import { eq, desc, sql } from "drizzle-orm";

const router = Router();

/* ═══════════════════════════════════════════════════════
   تذاكر الإصلاح
═══════════════════════════════════════════════════════ */
router.get("/tickets/repair", requireAuth, async (req, res) => {
  try {
    const { status } = req.query as any;
    const rows = await db.select().from(repairTicketsTable)
      .orderBy(desc(repairTicketsTable.createdAt));
    res.json(status ? rows.filter(r => r.status === status) : rows);
  } catch (error) {
    res.status(500).json({ error: "فشل في جلب تذاكر الصيانة", details: String(error) });
  }
});

router.post("/tickets/repair", requireAuth, async (req, res) => {
  try {
    const { serviceNumber, clientName, clientPhone, serviceType, problemDescription,
      priority, assignedToId, assignedToName, locationUrl, notes } = req.body;

    const [row] = await db.insert(repairTicketsTable).values({
      serviceNumber, clientName, clientPhone, serviceType: serviceType ?? "hotspot",
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
    for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
    if (req.body.status === "completed") updates.resolvedAt = new Date();

    const [row] = await db.update(repairTicketsTable).set(updates)
      .where(eq(repairTicketsTable.id, id)).returning();
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "فشل في تحديث التذكرة", details: String(error) });
  }
});

/* ═══════════════════════════════════════════════════════
   تذاكر التركيب
═══════════════════════════════════════════════════════ */
router.get("/tickets/installation", requireAuth, async (req, res) => {
  try {
    const { status, parentOnly } = req.query as any;
    let rows = await db.select().from(installationTicketsTable)
      .orderBy(desc(installationTicketsTable.createdAt));

    if (status) rows = rows.filter(r => r.status === status);
    // parentOnly=true يحذف نقاط البث الوسيطة من القائمة الرئيسية
    if (parentOnly === "true") rows = rows.filter(r => !r.isRelayPoint);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "فشل في جلب تذاكر التركيب", details: String(error) });
  }
});

router.post("/tickets/installation", requireAuth, async (req, res) => {
  try {
    const {
      clientName, clientPhone, serviceType, locationUrl, address,
      notes, assignedToId, assignedToName, subscriptionFee,
      parentTicketId, isRelayPoint,
    } = req.body;

    const [row] = await db.insert(installationTicketsTable).values({
      clientName: clientName ?? null,
      clientPhone: clientPhone ?? null,
      serviceType: serviceType ?? "hotspot_internal",
      locationUrl: locationUrl ?? null,
      address: address ?? null,
      notes: notes ?? null,
      status: "new",
      assignedToId: assignedToId ?? null,
      assignedToName: assignedToName ?? null,
      subscriptionFee: subscriptionFee ? String(subscriptionFee) : null,
      parentTicketId: parentTicketId ?? null,
      isRelayPoint: isRelayPoint ?? false,
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
    const fields = [
      "status", "assignedToId", "assignedToName", "notes", "locationUrl", "address",
      "archiveNotes", "engineerNotes", "subscriptionFee",
    ];
    for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
    if (req.body.status === "completed") updates.completedAt = new Date();
    if (req.body.status === "archived")  updates.archivedAt  = new Date();

    const [row] = await db.update(installationTicketsTable).set(updates)
      .where(eq(installationTicketsTable.id, id)).returning();
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "فشل في تحديث التذكرة", details: String(error) });
  }
});

/* ────────────────────────────────────────────────────
   POST /tickets/installation/:id/prepare
   حفظ بيانات مرحلة التجهيز
────────────────────────────────────────────────────── */
router.post("/tickets/installation/:id/prepare", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const {
      address, locationUrl, deviceName, deviceSerial,
      subscriptionFee, subscriptionName, internetFee,
      contractImageUrl, assignedToId, assignedToName,
      relayPoints, notes,
    } = req.body;

    const hasRelays = Array.isArray(relayPoints) && relayPoints.length > 0;
    const relayPointsJson = hasRelays ? JSON.stringify(relayPoints) : null;

    const updates: any = {
      status: "preparing",
      updatedAt: new Date(),
    };

    if (address       !== undefined) updates.address        = address;
    if (locationUrl   !== undefined) updates.locationUrl    = locationUrl;
    if (deviceName    !== undefined) updates.deviceName     = deviceName;
    if (deviceSerial  !== undefined) updates.deviceSerial   = deviceSerial;
    if (subscriptionFee !== undefined) updates.subscriptionFee = subscriptionFee ? String(subscriptionFee) : null;
    if (subscriptionName !== undefined) updates.subscriptionName = subscriptionName;
    if (internetFee   !== undefined) updates.internetFee    = internetFee ? String(internetFee) : null;
    if (contractImageUrl !== undefined) updates.contractImageUrl = contractImageUrl;
    if (assignedToId  !== undefined) updates.assignedToId   = assignedToId;
    if (assignedToName !== undefined) updates.assignedToName = assignedToName;
    if (notes         !== undefined) updates.notes          = notes;
    if (relayPointsJson !== null)     updates.relayPointsJson = relayPointsJson;
    updates.hasRelayPoints = hasRelays;

    const [row] = await db.update(installationTicketsTable)
      .set(updates)
      .where(eq(installationTicketsTable.id, id))
      .returning();

    /* إذا يوجد نقاط وسيطة — أنشئ تذاكر لها */
    if (hasRelays) {
      for (const rp of relayPoints) {
        await db.insert(installationTicketsTable).values({
          serviceType: "hotspot_external",
          address: rp.description ?? null,
          locationUrl: rp.locationUrl ?? null,
          status: "new",
          isRelayPoint: true,
          parentTicketId: id,
          createdById: req.currentUser!.id,
        });
      }
    }

    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "فشل في حفظ بيانات التجهيز", details: String(error) });
  }
});

/* ────────────────────────────────────────────────────
   POST /tickets/installation/:id/execute
   تحويل الحالة إلى in_progress (المهندس يبدأ التنفيذ)
────────────────────────────────────────────────────── */
router.post("/tickets/installation/:id/execute", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    /* التحقق من النقاط الوسيطة */
    const ticket = await db.select().from(installationTicketsTable)
      .where(eq(installationTicketsTable.id, id));

    if (!ticket[0]) return res.status(404).json({ error: "التذكرة غير موجودة" });
    const t = ticket[0];

    if (t.hasRelayPoints) {
      const relayTickets = await db.select().from(installationTicketsTable)
        .where(eq(installationTicketsTable.parentTicketId, id));
      const pendingRelays = relayTickets.filter(r => r.status !== "archived" && r.status !== "completed");
      if (pendingRelays.length > 0) {
        return res.status(400).json({
          error: "يجب إتمام جميع نقاط البث الوسيطة أولاً",
          pendingCount: pendingRelays.length,
        });
      }
    }

    const [row] = await db.update(installationTicketsTable)
      .set({ status: "in_progress", updatedAt: new Date() })
      .where(eq(installationTicketsTable.id, id))
      .returning();
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "فشل في بدء التنفيذ", details: String(error) });
  }
});

/* ────────────────────────────────────────────────────
   POST /tickets/installation/:id/archive
   أرشفة التذكرة + حفظ في قاعدة بيانات الشبكة
────────────────────────────────────────────────────── */
router.post("/tickets/installation/:id/archive", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { archiveNotes, engineerNotes } = req.body;

    const rows = await db.select().from(installationTicketsTable)
      .where(eq(installationTicketsTable.id, id));
    if (!rows[0]) return res.status(404).json({ error: "التذكرة غير موجودة" });

    const t = rows[0];

    /* حفظ في قاعدة بيانات الشبكة */
    if (t.serviceType === "hotspot_internal" || t.serviceType === "hotspot_external") {
      /* جلب أعلى flashNumber موجود */
      const existing = await db.select({ fn: hotspotPointsTable.flashNumber })
        .from(hotspotPointsTable).orderBy(desc(hotspotPointsTable.flashNumber)).limit(1);
      const nextFlash = (existing[0]?.fn ?? 0) + 1;

      await db.insert(hotspotPointsTable).values({
        name: t.deviceName ?? `فلاش ${nextFlash}`,
        location: t.address ?? "غير محدد",
        hotspotType: t.serviceType === "hotspot_internal" ? "internal" : "external",
        flashNumber: nextFlash,
        deviceName: t.deviceName ?? null,
        clientName: t.clientName ?? null,
        clientPhone: t.clientPhone ?? null,
        subscriptionFee: t.subscriptionFee ?? null,
        locationUrl: t.locationUrl ?? null,
        status: "active",
        supervisorId: t.createdById ?? null,
        notes: archiveNotes ?? null,
      });
    } else if (t.serviceType === "broadband_internal") {
      /* جلب أعلى flashNumber */
      const existing = await db.select({ fn: broadbandPointsTable.flashNumber })
        .from(broadbandPointsTable).orderBy(desc(broadbandPointsTable.flashNumber)).limit(1);
      const nextFlash = (existing[0]?.fn ?? 0) + 1;

      await db.insert(broadbandPointsTable).values({
        name: t.subscriptionName ?? `P${nextFlash}`,
        location: t.address ?? "غير محدد",
        flashNumber: nextFlash,
        subscriptionName: t.subscriptionName ?? null,
        clientName: t.clientName ?? null,
        clientPhone: t.clientPhone ?? null,
        subscriptionFee: t.internetFee ?? null,
        locationUrl: t.locationUrl ?? null,
        status: "active",
        supervisorId: t.createdById ?? null,
        notes: archiveNotes ?? null,
      });
    }

    /* تحديث حالة التذكرة */
    const [updated] = await db.update(installationTicketsTable).set({
      status: "archived",
      archivedAt: new Date(),
      archiveNotes: archiveNotes ?? null,
      engineerNotes: engineerNotes ?? null,
      updatedAt: new Date(),
    }).where(eq(installationTicketsTable.id, id)).returning();

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "فشل في أرشفة التذكرة", details: String(error) });
  }
});

router.delete("/tickets/installation/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(installationTicketsTable).where(eq(installationTicketsTable.id, id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "فشل في حذف التذكرة", details: String(error) });
  }
});

/* ═══════════════════════════════════════════════════════
   طلبات الشراء
═══════════════════════════════════════════════════════ */
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
