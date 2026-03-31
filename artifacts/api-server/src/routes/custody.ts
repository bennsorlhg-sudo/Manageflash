import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { custodyRecordsTable, financialTransactionsTable, cashBoxTable } from "@workspace/db/schema";
import { requireAuth } from "../lib/auth";
import { desc, eq, sql } from "drizzle-orm";

const router: IRouter = Router();

/* ════════════════════════════════════════════════════
   POST /custody/send
   تسجيل نقد أو كروت واردة (تزيد الصندوق / إجمالي الكروت)
════════════════════════════════════════════════════ */
router.post("/custody/send", requireAuth, async (req, res) => {
  try {
    const { agentName, cashAmount, cardsAmount, notes } = req.body as {
      agentName?: string; cashAmount?: number; cardsAmount?: number; notes?: string;
    };

    const cash  = parseFloat(String(cashAmount  ?? 0)) || 0;
    const cards = parseFloat(String(cardsAmount ?? 0)) || 0;
    const name  = (agentName ?? "").trim() || "غير محدد";

    if (cash <= 0 && cards <= 0)
      return res.status(400).json({ error: "أدخل قيمة النقد أو الكروت" });

    await db.transaction(async (tx) => {
      /* ─── نقد: يُضاف للصندوق ─── */
      if (cash > 0) {
        await tx.insert(custodyRecordsTable).values({
          type: "cash", amount: String(cash),
          denomination: null, cardCount: null,
          fromRole: "tech_engineer", toRole: "finance_manager",
          toPersonName: name, notes: notes?.trim() ?? null,
        });
        await tx.execute(
          sql`UPDATE cash_box SET balance = balance + ${cash}, updated_at = NOW() WHERE id = 1`
        );
      }

      /* ─── كروت: تُضاف لإجمالي الكروت ─── */
      if (cards > 0) {
        await tx.insert(custodyRecordsTable).values({
          type: "cards", amount: String(cards),
          denomination: null, cardCount: null,
          fromRole: "tech_engineer", toRole: "finance_manager",
          toPersonName: name, notes: notes?.trim() ?? null,
        });
      }
    });

    res.status(201).json({ success: true, cashAmount: cash, cardsAmount: cards });
  } catch (err) {
    res.status(500).json({ error: "فشل تسجيل العهدة", details: String(err) });
  }
});

/* ════════════════════════════════════════════════════
   POST /custody/receive
   المسؤول المالي يستلم من مندوب (نقد + كروت مرتجعة)
════════════════════════════════════════════════════ */
router.post("/custody/receive", requireAuth, async (req, res) => {
  try {
    const { agentName, cashReceived, cardsReturned, notes } = req.body as {
      agentName: string;
      cashReceived?: number;
      cardsReturned?: number;
      notes?: string;
    };

    if (!agentName?.trim()) return res.status(400).json({ error: "أدخل اسم المندوب" });
    const cash  = parseFloat(String(cashReceived  ?? 0)) || 0;
    const cards = parseFloat(String(cardsReturned ?? 0)) || 0;
    if (cash <= 0 && cards <= 0) return res.status(400).json({ error: "أدخل مبلغ النقد أو قيمة الكروت" });

    const agent = agentName.trim();

    /* ── عملية ذرية: إما كل شيء ينجح أو لا شيء ── */
    const created = await db.transaction(async (tx) => {
      const records: any[] = [];

      /* ─── استلام نقد ─── */
      if (cash > 0) {
        const [cashRec] = await tx.insert(custodyRecordsTable).values({
          type: "cash",
          amount: String(cash),
          denomination: null, cardCount: null,
          fromRole: "tech_engineer",
          toRole: "finance_manager",
          toPersonName: agent,
          notes: notes?.trim() ?? null,
        }).returning();
        records.push(cashRec);

        await tx.execute(
          sql`UPDATE cash_box SET balance = balance + ${cash}, updated_at = NOW() WHERE id = 1`
        );

        await tx.insert(financialTransactionsTable).values({
          type: "sale",
          category: "hotspot",
          amount: String(cash),
          description: `مبيعات نقدية من مندوب: ${agent}`,
          role: req.currentUser!.role,
          personName: agent,
          referenceId: `AGENT-CASH-${Date.now()}`,
          paymentType: "cash",
        });
      }

      /* ─── استلام كروت مرتجعة ─── */
      if (cards > 0) {
        const [cardsRec] = await tx.insert(custodyRecordsTable).values({
          type: "cards",
          amount: String(cards),
          denomination: null, cardCount: null,
          fromRole: "tech_engineer",
          toRole: "finance_manager",
          toPersonName: agent,
          notes: notes?.trim() ?? null,
        }).returning();
        records.push(cardsRec);
      }

      return records;
    });

    res.status(201).json({ records: created, cashReceived: cash, cardsReturned: cards });
  } catch (err) {
    res.status(500).json({ error: "فشل تسجيل الاستلام", details: String(err) });
  }
});

/* ════════════════════════════════════════════════════
   GET /custody/agents
   قائمة المندوبين المفتوحين (عهدهم غير مغلقة)
════════════════════════════════════════════════════ */
router.get("/custody/agents", requireAuth, async (_req, res) => {
  try {
    /* إجمالي ما أُرسل لكل مندوب (finance_manager → tech_engineer) */
    const sentResult = await db.execute(sql`
      SELECT to_person_name AS agent_name,
             COALESCE(SUM(amount::numeric), 0) AS total_sent
      FROM custody_records
      WHERE from_role = 'finance_manager'
        AND to_role   = 'tech_engineer'
        AND type      = 'cards'
        AND to_person_name IS NOT NULL
      GROUP BY to_person_name
    `);

    /* إجمالي ما استُلم من كل مندوب (tech_engineer → finance_manager) */
    const receivedResult = await db.execute(sql`
      SELECT to_person_name AS agent_name,
             COALESCE(SUM(amount::numeric), 0) AS total_received
      FROM custody_records
      WHERE from_role = 'tech_engineer'
        AND to_role   = 'finance_manager'
        AND to_person_name IS NOT NULL
      GROUP BY to_person_name
    `);

    const sentRows:     any[] = (sentResult     as any).rows ?? (Array.isArray(sentResult)     ? sentResult     : []);
    const receivedRows: any[] = (receivedResult as any).rows ?? (Array.isArray(receivedResult) ? receivedResult : []);

    /* ادمج النتيجتين */
    const receivedMap: Record<string, number> = {};
    receivedRows.forEach((r: any) => {
      receivedMap[r.agent_name] = parseFloat(r.total_received ?? "0");
    });

    const agents = sentRows
      .map((s: any) => {
        const totalSent     = parseFloat(s.total_sent ?? "0");
        const totalReceived = receivedMap[s.agent_name] ?? 0;
        const remaining     = totalSent - totalReceived;
        return { agentName: s.agent_name, totalSent, totalReceived, remaining };
      })
      .filter(a => a.remaining > 0.01)           /* فقط العهد المفتوحة */
      .sort((a, b) => b.remaining - a.remaining); /* أكبر مبلغ أولاً  */

    res.json(agents);
  } catch (err) {
    res.status(500).json({ error: "فشل جلب قائمة العهد", details: String(err) });
  }
});

/* ════════════════════════════════════════════════════
   GET /custody/summary — ملخص سريع
════════════════════════════════════════════════════ */
router.get("/custody/summary", requireAuth, async (_req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT
        COALESCE(SUM(amount::numeric), 0) AS total,
        COALESCE(SUM(CASE WHEN type = 'cards' THEN amount::numeric ELSE 0 END), 0) AS cards_total,
        COALESCE(SUM(CASE WHEN type = 'cash'  THEN amount::numeric ELSE 0 END), 0) AS cash_total
      FROM custody_records
    `);
    const row: any = (result as any).rows?.[0] ?? (Array.isArray(result) ? result[0] : result);
    res.json({
      total:      parseFloat(row?.total       ?? "0"),
      cardsTotal: parseFloat(row?.cards_total ?? "0"),
      cashTotal:  parseFloat(row?.cash_total  ?? "0"),
    });
  } catch (err) {
    res.status(500).json({ error: "فشل جلب ملخص العهدة", details: String(err) });
  }
});

/* ════════════════════════════════════════════════════
   GET /custody — كل السجلات (للمراجعة)
════════════════════════════════════════════════════ */
router.get("/custody", requireAuth, async (_req, res) => {
  try {
    const records = await db
      .select()
      .from(custodyRecordsTable)
      .orderBy(desc(custodyRecordsTable.createdAt))
      .limit(200);
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: "فشل جلب سجلات العهدة", details: String(err) });
  }
});

/* ════════════════════════════════════════════════════
   POST /custody — مسار قديم (للتوافق مع المالك)
════════════════════════════════════════════════════ */
router.post("/custody", requireAuth, async (req, res) => {
  try {
    const { type, amount, personName, toPersonName, notes } = req.body as any;
    if (!type) return res.status(400).json({ error: "type مطلوب" });
    const finalAmount = parseFloat(String(amount ?? 0));
    if (!finalAmount || finalAmount <= 0) return res.status(400).json({ error: "أدخل قيمة صحيحة" });

    const recipientName = personName ?? toPersonName ?? null;
    const fromRole = req.currentUser!.role as any;
    const toRole = fromRole === "owner" ? "finance_manager" : "tech_engineer";

    /* ── الخطوة 1: سجّل العهدة + حدّث الصندوق (عملية ذرية) ── */
    const result = await db.transaction(async (tx) => {
      const [record] = await tx.insert(custodyRecordsTable).values({
        type, amount: String(finalAmount), denomination: null, cardCount: null,
        fromRole, toRole, toPersonName: recipientName, notes: notes ?? null,
      }).returning();

      if (type === "cash") {
        await tx.execute(
          sql`UPDATE cash_box SET balance = balance + ${finalAmount}, updated_at = NOW() WHERE id = 1`
        );
      }

      return record;
    });

    /* ── الخطوة 2: سجّل في المعاملات المالية (خارج الـ transaction — لا يُلغي الصندوق إن فشل) ── */
    if (type === "cash") {
      try {
        await db.insert(financialTransactionsTable).values({
          type:        "custody_in",
          category:    "other",
          amount:      String(finalAmount),
          description: `عهدة نقد من ${fromRole === "owner" ? "المالك" : "المسؤول المالي"}`,
          role:        fromRole,
          personName:  req.currentUser!.name ?? fromRole,
          referenceId: `CUSTODY-CASH-${Date.now()}`,
          paymentType: "cash",
        });
      } catch { /* لا يُلغي نجاح العهدة */ }
    }

    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: "فشل في تسجيل العهدة", details: String(err) });
  }
});

/* ════════════════════════════════════════════════════
   GET /custody/owner-log
   سجل العهد التي أضافها المالك للمسؤول المالي فقط
════════════════════════════════════════════════════ */
router.get("/custody/owner-log", requireAuth, async (_req, res) => {
  try {
    const records = await db.execute(sql`
      SELECT * FROM custody_records
      WHERE from_role = 'owner'
      ORDER BY created_at DESC
      LIMIT 500
    `);
    const rows: any[] = (records as any).rows ?? (Array.isArray(records) ? records : []);

    const totResult = await db.execute(sql`
      SELECT
        COALESCE(SUM(amount::numeric), 0)                                          AS total,
        COALESCE(SUM(CASE WHEN type = 'cash'  THEN amount::numeric ELSE 0 END), 0) AS cash_total,
        COALESCE(SUM(CASE WHEN type = 'cards' THEN amount::numeric ELSE 0 END), 0) AS cards_total
      FROM custody_records WHERE from_role = 'owner'
    `);
    const tot: any = (totResult as any).rows?.[0] ?? (Array.isArray(totResult) ? totResult[0] : {});

    res.json({
      records: rows,
      total:      parseFloat(tot?.total       ?? "0"),
      cashTotal:  parseFloat(tot?.cash_total  ?? "0"),
      cardsTotal: parseFloat(tot?.cards_total ?? "0"),
    });
  } catch (err) {
    res.status(500).json({ error: "فشل جلب سجل العهدة", details: String(err) });
  }
});

/* ════════════════════════════════════════════════════
   DELETE /custody/:id
   حذف عهدة وعكس تأثيرها على الصندوق
════════════════════════════════════════════════════ */
router.delete("/custody/:id", requireAuth, async (req, res) => {
  try {
    const recordId = parseInt(req.params.id);
    if (!recordId) return res.status(400).json({ error: "معرف غير صحيح" });

    const found = await db.execute(sql`SELECT * FROM custody_records WHERE id = ${recordId}`);
    const rows: any[] = (found as any).rows ?? (Array.isArray(found) ? found : []);
    if (!rows.length) return res.status(404).json({ error: "السجل غير موجود" });

    const record = rows[0];
    const amount = parseFloat(record.amount ?? "0");

    await db.transaction(async (tx) => {
      if (record.type === "cash" && record.from_role === "owner") {
        await tx.execute(
          sql`UPDATE cash_box SET balance = balance - ${amount}, updated_at = NOW() WHERE id = 1`
        );
        await tx.execute(sql`
          DELETE FROM financial_transactions
          WHERE id = (
            SELECT id FROM financial_transactions
            WHERE type = 'custody_in' AND payment_type = 'cash'
              AND amount::numeric = ${amount}
              AND created_at >= ${record.created_at}::timestamptz - interval '30 seconds'
              AND created_at <= ${record.created_at}::timestamptz + interval '30 seconds'
            ORDER BY created_at LIMIT 1
          )
        `);
      }
      await tx.execute(sql`DELETE FROM custody_records WHERE id = ${recordId}`);
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "فشل حذف العهدة", details: String(err) });
  }
});

/* ════════════════════════════════════════════════════
   PUT /custody/:id
   تعديل مبلغ عهدة مع عكس الفرق على الصندوق
════════════════════════════════════════════════════ */
router.put("/custody/:id", requireAuth, async (req, res) => {
  try {
    const recordId = parseInt(req.params.id);
    if (!recordId) return res.status(400).json({ error: "معرف غير صحيح" });

    const { amount: newAmountRaw, notes } = req.body as { amount: number; notes?: string };
    const newAmount = parseFloat(String(newAmountRaw ?? 0));
    if (!newAmount || newAmount <= 0) return res.status(400).json({ error: "أدخل قيمة صحيحة" });

    const found = await db.execute(sql`SELECT * FROM custody_records WHERE id = ${recordId}`);
    const rows: any[] = (found as any).rows ?? (Array.isArray(found) ? found : []);
    if (!rows.length) return res.status(404).json({ error: "السجل غير موجود" });

    const record = rows[0];
    const oldAmount = parseFloat(record.amount ?? "0");
    const diff = newAmount - oldAmount;

    await db.transaction(async (tx) => {
      if (record.type === "cash" && record.from_role === "owner" && Math.abs(diff) > 0.001) {
        await tx.execute(
          sql`UPDATE cash_box SET balance = balance + ${diff}, updated_at = NOW() WHERE id = 1`
        );
        await tx.execute(sql`
          UPDATE financial_transactions SET amount = ${String(newAmount)}
          WHERE id = (
            SELECT id FROM financial_transactions
            WHERE type = 'custody_in' AND payment_type = 'cash'
              AND amount::numeric = ${oldAmount}
              AND created_at >= ${record.created_at}::timestamptz - interval '30 seconds'
              AND created_at <= ${record.created_at}::timestamptz + interval '30 seconds'
            ORDER BY created_at LIMIT 1
          )
        `);
      }
      const newNotes = notes?.trim() ?? null;
      await tx.execute(sql`
        UPDATE custody_records SET amount = ${String(newAmount)}, notes = ${newNotes}
        WHERE id = ${recordId}
      `);
    });

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "فشل تعديل العهدة", details: String(err) });
  }
});

export default router;

