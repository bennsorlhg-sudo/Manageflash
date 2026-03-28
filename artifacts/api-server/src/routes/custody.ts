import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { custodyRecordsTable, CARD_PRICES } from "@workspace/db/schema";
import { desc } from "drizzle-orm";

const router: IRouter = Router();

router.post("/custody", async (req, res) => {
  try {
    const { type, amount, denomination, cardCount, toRole, toPersonName, notes } = req.body as {
      type: "cash" | "cards";
      amount?: number;
      denomination?: number;
      cardCount?: number;
      toRole: "finance_manager" | "supervisor" | "tech_engineer";
      toPersonName?: string;
      notes?: string;
    };

    if (!type || !toRole) {
      res.status(400).json({ error: "type and toRole are required" });
      return;
    }

    let finalAmount: number;

    if (type === "cash") {
      if (!amount || amount <= 0) {
        res.status(400).json({ error: "amount is required for cash custody" });
        return;
      }
      finalAmount = amount;
    } else {
      if (!denomination || !cardCount || cardCount <= 0) {
        res.status(400).json({ error: "denomination and cardCount are required for card custody" });
        return;
      }
      const pricePerCard = CARD_PRICES[String(denomination)];
      if (!pricePerCard) {
        res.status(400).json({ error: `Invalid denomination: ${denomination}. Valid values: ${Object.keys(CARD_PRICES).join(", ")}` });
        return;
      }
      finalAmount = pricePerCard * cardCount;
    }

    const [record] = await db.insert(custodyRecordsTable).values({
      type,
      amount: String(finalAmount),
      denomination: denomination ?? null,
      cardCount: cardCount ?? null,
      fromRole: "owner",
      toRole,
      toPersonName: toPersonName ?? null,
      notes: notes ?? null,
    }).returning();

    res.status(201).json(record);
  } catch (error) {
    res.status(500).json({ error: "Failed to create custody record", details: String(error) });
  }
});

router.get("/custody", async (_req, res) => {
  try {
    const records = await db.select().from(custodyRecordsTable).orderBy(desc(custodyRecordsTable.createdAt));
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch custody records", details: String(error) });
  }
});

export default router;
