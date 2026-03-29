import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { custodyRecordsTable } from "@workspace/db/schema";
import { requireAuth } from "../lib/auth";
import { desc, eq, sql } from "drizzle-orm";

const router: IRouter = Router();

/* ─── POST /custody — تسجيل عهدة جديدة ─── */
router.post("/custody", requireAuth, async (req, res) => {
  try {
    const {
      type,
      amount,
      personName,
      toPersonName,
      notes,
    } = req.body as {
      type: "cash" | "cards";
      amount?: number;
      personName?: string;
      toPersonName?: string;
      notes?: string;
    };

    if (!type) { res.status(400).json({ error: "type مطلوب" }); return; }

    const finalAmount = parseFloat(String(amount ?? 0));
    if (!finalAmount || finalAmount <= 0) {
      res.status(400).json({ error: "أدخل قيمة صحيحة" }); return;
    }

    const recipientName = personName ?? toPersonName ?? null;

    const fromRole = req.currentUser!.role as any;
    const toRole = fromRole === "owner" ? "finance_manager" : "tech_engineer";

    const [record] = await db.insert(custodyRecordsTable).values({
      type,
      amount: String(finalAmount),
      denomination: null,
      cardCount: null,
      fromRole,
      toRole,
      toPersonName: recipientName,
      notes: notes ?? null,
    }).returning();

    // إذا كانت نقدية → أضف للصندوق
    if (type === "cash") {
      await db.execute(
        sql`UPDATE cash_box SET balance = balance + ${finalAmount}, updated_at = NOW() WHERE id = 1`
      );
    }

    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ error: "فشل في تسجيل العهدة", details: String(error) });
  }
});

/* ─── GET /custody/summary — ملخص العهدة ─── */
router.get("/custody/summary", requireAuth, async (_req, res) => {
  try {
    const result = await db.execute(
      sql`SELECT
        COALESCE(SUM(amount::numeric), 0) AS total,
        COALESCE(SUM(CASE WHEN type = 'cards' THEN amount::numeric ELSE 0 END), 0) AS cards_total,
        COALESCE(SUM(CASE WHEN type = 'cash' THEN amount::numeric ELSE 0 END), 0) AS cash_total
      FROM custody_records`
    );

    const row: any = (result as any).rows?.[0] ?? (Array.isArray(result) ? result[0] : result);

    res.json({
      total: parseFloat(row?.total ?? "0"),
      cardsTotal: parseFloat(row?.cards_total ?? "0"),
      cashTotal: parseFloat(row?.cash_total ?? "0"),
    });
  } catch (error) {
    res.status(500).json({ error: "فشل في جلب ملخص العهدة", details: String(error) });
  }
});

/* ─── GET /custody — قائمة العهدة ─── */
router.get("/custody", requireAuth, async (_req, res) => {
  try {
    const records = await db
      .select()
      .from(custodyRecordsTable)
      .orderBy(desc(custodyRecordsTable.createdAt));
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: "فشل في جلب سجلات العهدة", details: String(error) });
  }
});

export default router;
