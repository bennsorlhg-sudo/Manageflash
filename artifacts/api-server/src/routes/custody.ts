import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { custodyRecordsTable, financialTransactionsTable, cashBoxTable } from "@workspace/db/schema";
import { requireAuth } from "../lib/auth";
import { desc, eq, sql } from "drizzle-orm";

const router: IRouter = Router();

/* ════════════════════════════════════════════════════
   POST /custody/send
   المسؤول المالي يُسلّم كروتًا لمندوب
════════════════════════════════════════════════════ */
router.post("/custody/send", requireAuth, async (req, res) => {
  try {
    const { agentName, amount, notes } = req.body as {
      agentName: string; amount: number; notes?: string;
    };

    if (!agentName?.trim()) return res.status(400).json({ error: "أدخل اسم المندوب" });
    const parsedAmount = parseFloat(String(amount ?? 0));
    if (!parsedAmount || parsedAmount <= 0) return res.status(400).json({ error: "أدخل قيمة صحيحة" });

    /* سجّل حركة إرسال عهدة (finance_manager → tech_engineer) */
    const [record] = await db.insert(custodyRecordsTable).values({
      type: "cards",
      amount: String(parsedAmount),
      denomination: null,
      cardCount: null,
      fromRole: "finance_manager",
      toRole: "tech_engineer",
      toPersonName: agentName.trim(),
      notes: notes?.trim() ?? null,
    }).returning();

    res.status(201).json(record);
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
      .filter(a => a.remaining > 0.01); /* فقط العهد المفتوحة */

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

    /* ── عملية ذرية: إما كل شيء ينجح أو لا شيء ── */
    const result = await db.transaction(async (tx) => {
      const [record] = await tx.insert(custodyRecordsTable).values({
        type, amount: String(finalAmount), denomination: null, cardCount: null,
        fromRole, toRole, toPersonName: recipientName, notes: notes ?? null,
      }).returning();

      if (type === "cash") {
        /* سجّل في المعاملات المالية (يضيفه للسجل المحاسبي) */
        await tx.insert(financialTransactionsTable).values({
          type:        "custody_in",
          category:    "other",
          amount:      String(finalAmount),
          description: `عهدة نقد من ${fromRole === "owner" ? "المالك" : "المسؤول المالي"}`,
          role:        fromRole,
          personName:  req.currentUser!.name ?? fromRole,
          referenceId: `CUSTODY-CASH-${Date.now()}`,
          paymentType: "cash",
        });

        /* حدّث الصندوق للتوافق مع الكود القديم */
        await tx.execute(
          sql`UPDATE cash_box SET balance = balance + ${finalAmount}, updated_at = NOW() WHERE id = 1`
        );
      }

      return record;
    });

    res.status(201).json(result);
  } catch (err) {
    res.status(500).json({ error: "فشل في تسجيل العهدة", details: String(err) });
  }
});

export default router;
