import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { custodyRecordsTable, hotspotCardsTable, broadbandCardsTable, salesPointsTable, financialTransactionsTable, CARD_PRICES } from "@workspace/db/schema";
import { sql, sum, count } from "drizzle-orm";

const router: IRouter = Router();

router.get("/dashboard/summary", async (_req, res) => {
  try {
    const [hotspotCount] = await db.select({ count: count() }).from(hotspotCardsTable);
    const [broadbandCount] = await db.select({ count: count() }).from(broadbandCardsTable);
    const [salesPointsCount] = await db.select({ count: count() }).from(salesPointsTable);

    const custodyIn = await db
      .select({ total: sum(custodyRecordsTable.amount) })
      .from(custodyRecordsTable)
      .where(sql`${custodyRecordsTable.toRole} = 'finance_manager' AND ${custodyRecordsTable.type} = 'cash'`);

    const salesTotal = await db
      .select({ total: sum(financialTransactionsTable.amount) })
      .from(financialTransactionsTable)
      .where(sql`${financialTransactionsTable.type} = 'sale'`);

    const expenseTotal = await db
      .select({ total: sum(financialTransactionsTable.amount) })
      .from(financialTransactionsTable)
      .where(sql`${financialTransactionsTable.type} = 'expense'`);

    const loanTotal = await db
      .select({ total: sum(financialTransactionsTable.amount) })
      .from(financialTransactionsTable)
      .where(sql`${financialTransactionsTable.type} = 'loan'`);

    const cashBalance = parseFloat(salesTotal[0]?.total ?? "0") - parseFloat(expenseTotal[0]?.total ?? "0");
    const totalCustody = parseFloat(custodyIn[0]?.total ?? "0");
    const totalLoans = parseFloat(loanTotal[0]?.total ?? "0");

    const hotspotCards = await db.select().from(hotspotCardsTable);
    const broadbandCards = await db.select().from(broadbandCardsTable);

    let totalCardValue = 0;
    for (const card of hotspotCards) {
      totalCardValue += CARD_PRICES[String(card.denomination)] ?? 0;
    }
    for (const card of broadbandCards) {
      totalCardValue += CARD_PRICES[String(card.denomination)] ?? 0;
    }

    res.json({
      ownerName: "فهد الهندي - مالك الشبكة",
      cashBalance,
      totalCustody,
      totalLoans,
      totalCardValue,
      totalSalesPoints: salesPointsCount?.count ?? 0,
      hotspotCount: hotspotCount?.count ?? 0,
      broadbandCount: broadbandCount?.count ?? 0,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch dashboard summary", details: String(error) });
  }
});

router.get("/card-prices", (_req, res) => {
  res.json({ prices: CARD_PRICES });
});

export default router;
