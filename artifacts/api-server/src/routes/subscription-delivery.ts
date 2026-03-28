import { Router } from "express";
import { db } from "@workspace/db";
import { subscriptionDeliveryTable } from "@workspace/db/schema";
import { requireAuth } from "../lib/auth";
import { desc } from "drizzle-orm";

const CARD_PRICES: Record<number, number> = {
  200: 180, 300: 270, 500: 450, 1000: 900,
  2000: 1800, 3000: 2700, 5000: 5000, 9000: 9000,
};

const router = Router();

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

router.post("/subscription-deliveries", requireAuth, async (req, res) => {
  try {
    const { engineerName, cardType, denomination, cardCount, deliveredToName, notes, engineerId, deliveredToFinanceId } = req.body;
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
