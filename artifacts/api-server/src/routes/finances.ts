import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  financialTransactionsTable,
  cashBoxTable,
  debtsTable,
  loansTable,
  cardInventoryTable,
} from "@workspace/db/schema";
import { custodyRecordsTable } from "@workspace/db/schema";
import { sql, sum, eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

router.get("/finances/report", async (req, res) => {
  try {
    const { period = "month", from, to } = req.query as { period?: string; from?: string; to?: string };

    const now = new Date();
    let fromDate: Date;
    let toDate: Date = now;

    if (period === "day") {
      fromDate = new Date(now);
      fromDate.setHours(0, 0, 0, 0);
    } else if (period === "week") {
      fromDate = new Date(now);
      fromDate.setDate(now.getDate() - 7);
    } else if (period === "custom" && from && to) {
      fromDate = new Date(from);
      toDate = new Date(to);
    } else {
      fromDate = new Date(now);
      fromDate.setDate(1);
      fromDate.setHours(0, 0, 0, 0);
    }

    const fromStr = fromDate.toISOString();
    const toStr = toDate.toISOString();

    const salesTotal = await db
      .select({ total: sum(financialTransactionsTable.amount) })
      .from(financialTransactionsTable)
      .where(sql`${financialTransactionsTable.type} = 'sale' AND ${financialTransactionsTable.createdAt} >= ${fromStr}::timestamp AND ${financialTransactionsTable.createdAt} <= ${toStr}::timestamp`);

    const expenseTotal = await db
      .select({ total: sum(financialTransactionsTable.amount) })
      .from(financialTransactionsTable)
      .where(sql`${financialTransactionsTable.type} = 'expense' AND ${financialTransactionsTable.createdAt} >= ${fromStr}::timestamp AND ${financialTransactionsTable.createdAt} <= ${toStr}::timestamp`);

    const hotspotSales = await db
      .select({ total: sum(financialTransactionsTable.amount) })
      .from(financialTransactionsTable)
      .where(sql`${financialTransactionsTable.type} = 'sale' AND ${financialTransactionsTable.category} = 'hotspot' AND ${financialTransactionsTable.createdAt} >= ${fromStr}::timestamp AND ${financialTransactionsTable.createdAt} <= ${toStr}::timestamp`);

    const broadbandSales = await db
      .select({ total: sum(financialTransactionsTable.amount) })
      .from(financialTransactionsTable)
      .where(sql`${financialTransactionsTable.type} = 'sale' AND ${financialTransactionsTable.category} = 'broadband' AND ${financialTransactionsTable.createdAt} >= ${fromStr}::timestamp AND ${financialTransactionsTable.createdAt} <= ${toStr}::timestamp`);

    const operationalExpenses = await db
      .select({ total: sum(financialTransactionsTable.amount) })
      .from(financialTransactionsTable)
      .where(sql`${financialTransactionsTable.type} = 'expense' AND ${financialTransactionsTable.category} = 'operational' AND ${financialTransactionsTable.createdAt} >= ${fromStr}::timestamp AND ${financialTransactionsTable.createdAt} <= ${toStr}::timestamp`);

    const salaryExpenses = await db
      .select({ total: sum(financialTransactionsTable.amount) })
      .from(financialTransactionsTable)
      .where(sql`${financialTransactionsTable.type} = 'expense' AND ${financialTransactionsTable.category} = 'salary' AND ${financialTransactionsTable.createdAt} >= ${fromStr}::timestamp AND ${financialTransactionsTable.createdAt} <= ${toStr}::timestamp`);

    const otherExpenses = await db
      .select({ total: sum(financialTransactionsTable.amount) })
      .from(financialTransactionsTable)
      .where(sql`${financialTransactionsTable.type} = 'expense' AND ${financialTransactionsTable.category} = 'other' AND ${financialTransactionsTable.createdAt} >= ${fromStr}::timestamp AND ${financialTransactionsTable.createdAt} <= ${toStr}::timestamp`);

    const totalSales = parseFloat(salesTotal[0]?.total ?? "0");
    const totalExpenses = parseFloat(expenseTotal[0]?.total ?? "0");
    const profit = totalSales - totalExpenses;

    res.json({
      period,
      from: fromDate.toISOString().split("T")[0],
      to: toDate.toISOString().split("T")[0],
      totalSales,
      totalExpenses,
      profit,
      salesBreakdown: {
        hotspot: parseFloat(hotspotSales[0]?.total ?? "0"),
        broadband: parseFloat(broadbandSales[0]?.total ?? "0"),
      },
      expenseBreakdown: {
        operational: parseFloat(operationalExpenses[0]?.total ?? "0"),
        salary: parseFloat(salaryExpenses[0]?.total ?? "0"),
        other: parseFloat(otherExpenses[0]?.total ?? "0"),
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch financial report", details: String(error) });
  }
});

/* ───────────────────────────────────────────────────────────
   GET /finances/summary
   ملخص مالي شامل — يُستخدَم في شاشة المراجعة للمشرف
─────────────────────────────────────────────────────────── */
router.get("/finances/summary", requireAuth, async (_req, res) => {
  try {
    const [
      cashBoxRows,
      debtRows,
      loanRows,
      custodyRows,
      inventoryRows,
    ] = await Promise.all([
      db.select().from(cashBoxTable).limit(1),
      db.select().from(debtsTable),
      db.select().from(loansTable),
      db.select().from(custodyRecordsTable),
      db.select().from(cardInventoryTable),
    ]);

    const cashBalance = parseFloat(cashBoxRows[0]?.balance ?? "0");

    /* السلف: عملاء يدينون لنا */
    const totalLoans = debtRows
      .filter(d => d.status !== "paid")
      .reduce((s, d) => s + Math.max(0, parseFloat(d.amount) - parseFloat(d.paidAmount ?? "0")), 0);

    /* الديون: نحن ندين لجهات */
    const totalOwed = loanRows
      .filter(l => l.status !== "paid")
      .reduce((s, l) => s + Math.max(0, parseFloat(l.amount) - parseFloat(l.paidAmount ?? "0")), 0);

    /* الأمانة الكلية: مجموع الأمانات الممنوحة للمدير المالي */
    const totalCustody = custodyRows
      .filter(r => r.toRole === "finance_manager")
      .reduce((s, r) => s + parseFloat(r.amount), 0);

    /* قيمة الكروت في المخزون */
    const cardsValue = inventoryRows
      .reduce((s, r) => s + parseFloat(r.denomination) * r.quantity, 0);

    /* أمانة العميل (المدير المالي) = أمانته الأولية - ما صرفه نقداً */
    const agentCustody = totalCustody;

    res.json({
      cashBalance,
      totalLoans,
      totalOwed,
      totalCustody,
      cardsValue,
      agentCustody,
    });
  } catch (error) {
    res.status(500).json({ error: "فشل في جلب الملخص المالي", details: String(error) });
  }
});

export default router;
