import { Router } from "express";
import { db } from "@workspace/db";
import {
  repairTicketsTable,
  installationTicketsTable,
  purchaseRequestsTable,
} from "@workspace/db/schema";
import { hotspotPointsTable, broadbandPointsTable } from "@workspace/db/schema";
import { requireAuth } from "../lib/auth";
import { eq, desc, sql, and } from "drizzle-orm";

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
    const {
      serviceNumber, clientName, clientPhone, serviceType, problemDescription,
      priority, assignedToId, assignedToName, locationUrl, location, notes, status,
      contractImageUrl,
    } = req.body;

    const [row] = await db.insert(repairTicketsTable).values({
      serviceNumber: serviceNumber ?? "manual",
      clientName: clientName ?? null,
      clientPhone: clientPhone ?? null,
      serviceType: serviceType ?? "hotspot_internal",
      problemDescription: problemDescription ?? null,
      location: location ?? null,
      status: status ?? "pending",
      priority: priority ?? "normal",
      assignedToId: assignedToId ?? null,
      assignedToName: assignedToName ?? null,
      locationUrl: locationUrl ?? null,
      notes: notes ?? null,
      contractImageUrl: contractImageUrl ?? null,
      createdById: req.currentUser!.id,
      createdByName: req.currentUser!.name ?? null,
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
    const fields = [
      "status", "priority", "assignedToId", "assignedToName",
      "notes", "locationUrl", "location", "clientName", "clientPhone",
      "problemDescription", "serviceType", "contractImageUrl", "completionPhotoUrl", "completionPhotoApproved",
    ];
    for (const f of fields) if (req.body[f] !== undefined) updates[f] = req.body[f];
    if (req.body.status === "in_progress") updates.startedAt  = new Date();
    if (req.body.status === "completed")   updates.resolvedAt = new Date();

    const [row] = await db.update(repairTicketsTable).set(updates)
      .where(eq(repairTicketsTable.id, id)).returning();
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "فشل في تحديث التذكرة", details: String(error) });
  }
});

router.delete("/tickets/repair/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.update(repairTicketsTable).set({
      deletedById:   req.currentUser!.id,
      deletedByName: req.currentUser!.name ?? null,
      deletedAt:     new Date(),
    }).where(eq(repairTicketsTable.id, id));
    await db.delete(repairTicketsTable).where(eq(repairTicketsTable.id, id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "فشل في حذف التذكرة", details: String(error) });
  }
});

/* ═══════════════════════════════════════════════════════
   تذاكر التركيب
═══════════════════════════════════════════════════════ */
router.get("/tickets/installation", requireAuth, async (req, res) => {
  try {
    const { status, parentOnly, techMode } = req.query as any;
    let rows = await db.select().from(installationTicketsTable)
      .orderBy(desc(installationTicketsTable.createdAt));

    if (status) rows = rows.filter(r => r.status === status);
    // parentOnly=true يحذف نقاط البث الوسيطة من القائمة الرئيسية
    if (parentOnly === "true") rows = rows.filter(r => !r.isRelayPoint);

    // techMode=true → يطبّق شرط الترتيب: المهندس يرى نقطة البث N فقط إذا اكتملت N-1
    if (techMode === "true") {
      // اجمع كل نقاط البث بالأب
      const relaysByParent: Record<number, typeof rows> = {};
      for (const r of rows) {
        if (r.isRelayPoint && r.parentTicketId) {
          if (!relaysByParent[r.parentTicketId]) relaysByParent[r.parentTicketId] = [];
          relaysByParent[r.parentTicketId].push(r);
        }
      }
      // أزل نقاط البث المحجوبة (التي لم تكتمل نقطة قبلها)
      const blockedIds = new Set<number>();
      for (const [_pid, relays] of Object.entries(relaysByParent)) {
        const sorted = [...relays].sort((a, b) => (a.sequenceOrder??0) - (b.sequenceOrder??0));
        let blocked = false;
        for (const relay of sorted) {
          if (blocked) {
            blockedIds.add(relay.id);
          } else {
            const done = relay.status === "completed" || relay.status === "archived";
            if (!done) blocked = true; // كل ما بعدها محجوب
          }
        }
      }
      rows = rows.filter(r => !blockedIds.has(r.id));
    }

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
      parentTicketId, isRelayPoint, contractImageUrl,
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
      contractImageUrl: contractImageUrl ?? null,
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
      /* مقوي داخلي هوتسبوت — للبرودباند فقط */
      boosterDevice,
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

    /* مقوي داخلي هوتسبوت — يُخزّن ضمن نفس التذكرة */
    if (boosterDevice && boosterDevice.deviceName) {
      updates.hasBooster             = true;
      updates.boosterDeviceName      = boosterDevice.deviceName;
      updates.boosterDeviceSerial    = boosterDevice.deviceSerial ?? null;
      updates.boosterSubscriptionFee = boosterDevice.subscriptionFee ? String(boosterDevice.subscriptionFee) : null;
    } else if (boosterDevice === null) {
      updates.hasBooster             = false;
      updates.boosterDeviceName      = null;
      updates.boosterDeviceSerial    = null;
      updates.boosterSubscriptionFee = null;
    }

    const [row] = await db.update(installationTicketsTable)
      .set(updates)
      .where(eq(installationTicketsTable.id, id))
      .returning();

    /* إذا يوجد نقاط وسيطة — أنشئ تذاكر لها بالترتيب */
    if (hasRelays) {
      /* احذف نقاط البث القديمة لهذه التذكرة أولاً (إعادة تجهيز) */
      await db.delete(installationTicketsTable)
        .where(eq(installationTicketsTable.parentTicketId, id));
      for (let idx = 0; idx < relayPoints.length; idx++) {
        const rp = relayPoints[idx];
        await db.insert(installationTicketsTable).values({
          serviceType: "hotspot_external",
          address: rp.description ?? null,
          locationUrl: rp.locationUrl ?? null,
          contractImageUrl: rp.imageUrl ?? null,
          status: "new",
          isRelayPoint: true,
          parentTicketId: id,
          sequenceOrder: idx + 1,
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
   POST /tickets/installation/:id/complete
   المهندس يُنهي مهمة التركيب الرئيسية → status=completed
   (لا يحفظ في قاعدة الشبكة — ذلك للمشرف عند الأرشفة)
────────────────────────────────────────────────────── */
router.post("/tickets/installation/:id/complete", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { engineerNotes, completionPhotoUrl } = req.body;

    const rows = await db.select().from(installationTicketsTable)
      .where(eq(installationTicketsTable.id, id));
    if (!rows[0]) return res.status(404).json({ error: "التذكرة غير موجودة" });
    const t = rows[0];

    /* تحقق من نقاط البث */
    if (t.hasRelayPoints) {
      const relayTickets = await db.select().from(installationTicketsTable)
        .where(eq(installationTicketsTable.parentTicketId, id));
      const pending = relayTickets.filter(r => r.status !== "archived" && r.status !== "completed");
      if (pending.length > 0)
        return res.status(400).json({ error: "يجب إتمام جميع نقاط البث الوسيطة أولاً", pendingCount: pending.length });
    }

    const [updated] = await db.update(installationTicketsTable).set({
      status: "completed",
      completedAt: new Date(),
      engineerNotes: engineerNotes ?? null,
      completionPhotoUrl: completionPhotoUrl ?? null,
      updatedAt: new Date(),
    }).where(eq(installationTicketsTable.id, id)).returning();

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "فشل في إنهاء التذكرة", details: String(error) });
  }
});

/* ────────────────────────────────────────────────────
   POST /tickets/installation/:id/archive
   المشرف يُؤرشف التذكرة المكتملة + يحفظ في قاعدة الشبكة
   نقاط البث الوسيطة: المهندس يستخدم هذا أيضاً لكن بدون حفظ شبكة
────────────────────────────────────────────────────── */
router.post("/tickets/installation/:id/archive", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const {
      archiveNotes, engineerNotes,
      /* حقول قابلة للتعديل من المشرف */
      serviceType:    svcOverride,
      flashNumber:    flashOverride,
      deviceName:     deviceOverride,
      clientName:     clientNameOverride,
      clientPhone:    clientPhoneOverride,
      subscriptionFee: subFeeOverride,
      internetFee:    inetFeeOverride,
      subscriptionName: subNameOverride,
      address:        addrOverride,
      locationUrl:    urlOverride,
      installedByName: installerOverride,
      installDate:    installDateOverride,
      installPhoto:   installPhotoOverride,
    } = req.body;

    const rows = await db.select().from(installationTicketsTable)
      .where(eq(installationTicketsTable.id, id));
    if (!rows[0]) return res.status(404).json({ error: "التذكرة غير موجودة" });

    const t = rows[0];
    /* الأولوية لما أرسله المشرف، ثم بيانات التذكرة الأصلية */
    const finalSvcType     = svcOverride     ?? t.serviceType;
    const finalAddress     = addrOverride    ?? t.address;
    const finalLocationUrl = urlOverride     ?? t.locationUrl;
    const finalDeviceName  = deviceOverride  ?? t.deviceName;
    const finalClientName  = clientNameOverride  ?? t.clientName;
    const finalClientPhone = clientPhoneOverride ?? t.clientPhone;
    const finalSubFee      = subFeeOverride  ?? t.subscriptionFee;
    const finalInetFee     = inetFeeOverride ?? t.internetFee;
    const finalSubName     = subNameOverride ?? t.subscriptionName;
    const finalInstaller   = installerOverride ?? t.assignedToName ?? null;
    const finalInstallDate = installDateOverride ? new Date(installDateOverride) : (t.completedAt ?? new Date());
    const finalInstallPhoto = installPhotoOverride ?? t.completionPhotoUrl ?? null;

    /* حفظ في قاعدة بيانات الشبكة — فقط للتذاكر الرئيسية (غير الوسيطة) */
    if (!t.isRelayPoint) {
      if (finalSvcType === "hotspot_internal" || finalSvcType === "hotspot_external") {
        /* تحديد رقم الفلاش: إما يحدده المشرف، أو آخر رقم + 1 */
        let flashNum: number;
        if (flashOverride && !isNaN(Number(flashOverride))) {
          flashNum = Number(flashOverride);
          /* التحقق من التكرار */
          const dup = await db.select({ fn: hotspotPointsTable.flashNumber })
            .from(hotspotPointsTable)
            .where(eq(hotspotPointsTable.flashNumber, flashNum));
          if (dup.length > 0) {
            return res.status(409).json({ error: `الجهاز برقم فلاش ${flashNum} موجود بالفعل في قاعدة البيانات، يرجى اختيار رقم آخر` });
          }
        } else {
          const existing = await db.select({ fn: hotspotPointsTable.flashNumber })
            .from(hotspotPointsTable).orderBy(desc(hotspotPointsTable.flashNumber)).limit(1);
          flashNum = (existing[0]?.fn ?? 0) + 1;
        }

        await db.insert(hotspotPointsTable).values({
          name: `فلاش ${flashNum}`,
          location: finalAddress ?? "غير محدد",
          hotspotType: finalSvcType === "hotspot_internal" ? "internal" : "external",
          flashNumber: flashNum,
          deviceName: finalDeviceName ?? null,
          clientName: finalSvcType === "hotspot_internal" ? (finalClientName ?? null) : null,
          clientPhone: finalSvcType === "hotspot_internal" ? (finalClientPhone ?? null) : null,
          subscriptionFee: finalSvcType === "hotspot_internal" ? (finalSubFee ? String(finalSubFee) : null) : null,
          locationUrl: finalLocationUrl ?? null,
          status: "active",
          supervisorId: t.createdById ?? null,
          notes: archiveNotes ?? null,
          installedByName: finalInstaller,
          installDate: finalInstallDate,
          installPhoto: finalSvcType === "hotspot_external" ? finalInstallPhoto : null,
        });
      } else if (finalSvcType === "broadband_internal") {
        /* تحديد رقم الفلاش */
        let flashNum: number;
        if (flashOverride && !isNaN(Number(flashOverride))) {
          flashNum = Number(flashOverride);
          const dup = await db.select({ fn: broadbandPointsTable.flashNumber })
            .from(broadbandPointsTable)
            .where(eq(broadbandPointsTable.flashNumber, flashNum));
          if (dup.length > 0) {
            return res.status(409).json({ error: `الجهاز برودباند برقم فلاش P${flashNum} موجود بالفعل في قاعدة البيانات، يرجى اختيار رقم آخر` });
          }
        } else {
          const existing = await db.select({ fn: broadbandPointsTable.flashNumber })
            .from(broadbandPointsTable).orderBy(desc(broadbandPointsTable.flashNumber)).limit(1);
          flashNum = (existing[0]?.fn ?? 0) + 1;
        }

        await db.insert(broadbandPointsTable).values({
          name: `فلاش P${flashNum}`,
          location: finalAddress ?? "غير محدد",
          flashNumber: flashNum,
          subscriptionName: finalSubName ?? null,
          deviceName: finalDeviceName ?? null,
          clientName: finalClientName ?? null,
          clientPhone: finalClientPhone ?? null,
          subscriptionFee: finalInetFee ? String(finalInetFee) : null,
          locationUrl: finalLocationUrl ?? null,
          status: "active",
          supervisorId: t.createdById ?? null,
          notes: archiveNotes ?? null,
        });
      }
    }

    /* تحديث حالة التذكرة + كل الحقول المُعدَّلة */
    const updateSet: any = {
      status: "archived",
      archivedAt: new Date(),
      archiveNotes: archiveNotes ?? null,
      updatedAt: new Date(),
    };
    if (svcOverride       !== undefined) updateSet.serviceType      = svcOverride;
    if (addrOverride      !== undefined) updateSet.address          = addrOverride;
    if (urlOverride       !== undefined) updateSet.locationUrl      = urlOverride;
    if (deviceOverride    !== undefined) updateSet.deviceName       = deviceOverride;
    if (clientNameOverride !== undefined) updateSet.clientName      = clientNameOverride;
    if (clientPhoneOverride !== undefined) updateSet.clientPhone    = clientPhoneOverride;
    if (subFeeOverride    !== undefined) updateSet.subscriptionFee  = subFeeOverride;
    if (inetFeeOverride   !== undefined) updateSet.internetFee      = inetFeeOverride;
    if (subNameOverride   !== undefined) updateSet.subscriptionName = subNameOverride;
    if (engineerNotes     !== undefined) updateSet.engineerNotes    = engineerNotes;

    const [updated] = await db.update(installationTicketsTable)
      .set(updateSet)
      .where(eq(installationTicketsTable.id, id)).returning();

    /* إذا كانت نقطة بث وسيطة → تحقق هل اكتملت كل النقاط */
    if (t.isRelayPoint && t.parentTicketId) {
      const siblings = await db.select().from(installationTicketsTable)
        .where(eq(installationTicketsTable.parentTicketId, t.parentTicketId));

      const allDone = siblings.every(
        s => s.id === id || s.status === "archived" || s.status === "completed"
      );

      if (allDone) {
        await db.update(installationTicketsTable)
          .set({ hasRelayPoints: false, updatedAt: new Date() })
          .where(eq(installationTicketsTable.id, t.parentTicketId));
      }
    }

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
    if (req.body.status !== undefined) updates.status = req.body.status;
    if (req.body.notes !== undefined) updates.notes = req.body.notes;
    if (req.body.transactionId !== undefined) updates.transactionId = req.body.transactionId;

    const [row] = await db.update(purchaseRequestsTable).set(updates)
      .where(eq(purchaseRequestsTable.id, id)).returning();
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "فشل في تحديث طلب الشراء", details: String(error) });
  }
});

/* حذف طلب شراء */
router.delete("/purchase-requests/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(purchaseRequestsTable).where(eq(purchaseRequestsTable.id, id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "فشل في حذف طلب الشراء", details: String(error) });
  }
});

export default router;
