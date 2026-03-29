import { Router } from "express";
import { db } from "@workspace/db";
import { subscriptionDeliveryTable, cashBoxTable } from "@workspace/db/schema";
import { requireAuth } from "../lib/auth";
import { desc, sql } from "drizzle-orm";

const router = Router();

/* ────────────────────────────────────────────────────
   GET /subscription-deliveries — كل السجلات
──────────────────────────────────────────────────── */
router.get("/subscription-deliveries", requireAuth, async (req, res) => {
  try {
    const rows = await db.select().from(subscriptionDeliveryTable)
      .orderBy(desc(subscriptionDeliveryTable.createdAt))
      .limit(100);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "فشل في جلب التسليمات", details: String(error) });
  }
});

/* ────────────────────────────────────────────────────
   POST /subscription-deliveries/to-finance
   المشرف يسلّم مبلغ نقدي لقيمة الاشتراكات للمسؤول المالي
──────────────────────────────────────────────────── */
router.post("/subscription-deliveries/to-finance", requireAuth, async (req, res) => {
  try {
    const { amount, notes } = req.body as { amount: number; notes?: string };
    const user = req.currentUser!;

    const parsedAmount = parseFloat(String(amount ?? 0));
    if (!parsedAmount || parsedAmount <= 0)
      return res.status(400).json({ error: "أدخل مبلغاً صحيحاً" });

    /* 1. سجّل التسليم */
    const [row] = await db.insert(subscriptionDeliveryTable).values({
      engineerName: user.name ?? "المشرف",
      engineerId: user.id,
      cardType: "cash_delivery",
      denomination: 0,
      cardCount: 0,
      totalValue: String(parsedAmount),
      deliveredToName: "المسؤول المالي",
      notes: notes?.trim() ?? null,
    }).returning();

    /* 2. أضف للصندوق النقدي للمسؤول المالي */
    await db.execute(
      sql`UPDATE cash_box SET balance = balance + ${parsedAmount}, updated_at = NOW() WHERE id = 1`
    );

    res.status(201).json({ ...row, amount: parsedAmount });
  } catch (error) {
    res.status(500).json({ error: "فشل في تسجيل التسليم", details: String(error) });
  }
});

/* ────────────────────────────────────────────────────
   POST /subscription-deliveries — مسار قديم (كروت)
──────────────────────────────────────────────────── */
router.post("/subscription-deliveries", requireAuth, async (req, res) => {
  try {
    const { engineerName, cardType, denomination, cardCount, deliveredToName, notes, engineerId, deliveredToFinanceId } = req.body;

    const CARD_PRICES: Record<number, number> = {
      200: 180, 300: 270, 500: 450, 1000: 900,
      2000: 1800, 3000: 2700, 5000: 5000, 9000: 9000,
    };
    const unitPrice = CARD_PRICES[denomination] ?? denomination * 0.9;
    const totalValue = unitPrice * cardCount;

    const [row] = await db.insert(subscriptionDeliveryTable).values({
      engineerId, engineerName,
      cardType: cardType ?? "hotspot",
      denomination, cardCount,
      totalValue: String(totalValue),
      deliveredToFinanceId, deliveredToName,
      notes,
    }).returning();

    res.json({ ...row, totalValue });
  } catch (error) {
    res.status(500).json({ error: "فشل في تسجيل التسليم", details: String(error) });
  }
});

export default router;
