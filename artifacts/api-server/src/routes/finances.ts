import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  financialTransactionsTable,
  debtsTable,
  loansTable,
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
      debtRows,
      loanRows,
      custodyRows,
      txRows,
    ] = await Promise.all([
      db.select().from(debtsTable),
      db.select().from(loansTable),
      db.select().from(custodyRecordsTable),
      db.select({
        type:        financialTransactionsTable.type,
        category:    financialTransactionsTable.category,
        paymentType: financialTransactionsTable.paymentType,
        amount:      financialTransactionsTable.amount,
      }).from(financialTransactionsTable),
    ]);

    /* ─── الصندوق النقدي: يُحسَب ديناميكياً من السجلات الفعلية ─── */
    /* نقد من المالك للمدير المالي */
    const cashFromOwner = custodyRows
      .filter(r => r.fromRole === "owner" && r.toRole === "finance_manager" && r.type === "cash")
      .reduce((s, r) => s + parseFloat(r.amount), 0);
    /* نقد من المندوبين للمدير المالي (تحصيل) */
    const cashFromAgents = custodyRows
      .filter(r => r.fromRole === "tech_engineer" && r.toRole === "finance_manager" && r.type === "cash")
      .reduce((s, r) => s + parseFloat(r.amount), 0);
    /* مبيعات نقدية */
    const cashSales = txRows
      .filter(r => r.type === "sale" && r.paymentType === "cash")
      .reduce((s, r) => s + parseFloat(r.amount), 0);
    /* مصروفات نقدية */
    const cashExpenses = txRows
      .filter(r => r.type === "expense" && (r.paymentType === "cash" || r.paymentType === "loan_payment"))
      .reduce((s, r) => s + parseFloat(r.amount), 0);

    const cashBalance = Math.max(0, cashFromOwner + cashFromAgents + cashSales - cashExpenses);

    /* السلف: عملاء يدينون لنا */
    const totalLoans = debtRows
      .filter(d => d.status !== "paid")
      .reduce((s, d) => s + Math.max(0, parseFloat(d.amount) - parseFloat(d.paidAmount ?? "0")), 0);

    /* الديون: نحن ندين لجهات */
    const totalOwed = loanRows
      .filter(l => l.status !== "paid")
      .reduce((s, l) => s + Math.max(0, parseFloat(l.amount) - parseFloat(l.paidAmount ?? "0")), 0);

    /* إجمالي ما سلّمه المالك للمدير المالي (نقد + كروت) */
    const custodyFromOwner = custodyRows
      .filter(r => r.fromRole === "owner" && r.toRole === "finance_manager")
      .reduce((s, r) => s + parseFloat(r.amount), 0);

    /* إجمالي المصروفات المدفوعة (تُنقَص من العهدة) */
    const totalExpensesPaid = txRows
      .filter(r => r.type === "expense")
      .reduce((s, r) => s + parseFloat(r.amount), 0);

    /* مبيعات البرودباند تضاف للعهدة (إيراد جديد يتحمّل مسؤوليته المدير المالي) */
    const broadbandSalesRevenue = txRows
      .filter(r => r.type === "sale" && r.category === "broadband")
      .reduce((s, r) => s + parseFloat(r.amount), 0);

    /*
     * إجمالي العهدة المتبقية = ما سلّمه المالك + مبيعات برودباند − ما صُرف
     * - الصرف استنزاف من العهدة
     * - مبيعات البرودباند إيراد جديد يُضاف للعهدة (المالك يستحقه)
     * - مبيعات الكروت لا تُغيِّر العهدة (الكرت يتحوّل لنقد أو سلفة ضمن العهدة)
     */
    const totalCustody = Math.max(0, custodyFromOwner + broadbandSalesRevenue - totalExpensesPaid);

    /* كروت من المالك للمدير المالي */
    const cardsFromOwner = custodyRows
      .filter(r => r.fromRole === "owner" && r.toRole === "finance_manager" && r.type === "cards")
      .reduce((s, r) => s + parseFloat(r.amount), 0);
    /* كروت أرسلها المدير المالي للمندوبين */
    const cardsSentToAgents = custodyRows
      .filter(r => r.fromRole === "finance_manager" && r.toRole === "tech_engineer" && r.type === "cards")
      .reduce((s, r) => s + parseFloat(r.amount), 0);
    /* كروت مرتجعة من المندوبين */
    const cardsReturnedFromAgents = custodyRows
      .filter(r => r.fromRole === "tech_engineer" && r.toRole === "finance_manager" && r.type === "cards")
      .reduce((s, r) => s + parseFloat(r.amount), 0);
    /* مبيعات الكروت (هوتسبوت) — تُنقَص من رصيد الكروت لأن الكرت خرج */
    const cardSalesAmount = txRows
      .filter(r => r.type === "sale" && r.category === "hotspot")
      .reduce((s, r) => s + parseFloat(r.amount), 0);

    /*
     * قيمة الكروت المتاحة لدى المدير المالي:
     * = كروت من المالك + مُرتجَعة من المندوبين − أُرسِلت للمندوبين − بِيعَت للعملاء
     */
    const cardsValue = cardsFromOwner + cardsReturnedFromAgents - cardsSentToAgents - cardSalesAmount;

    /* العهد الكلية عند المندوبين (نقد + كروت) */
    const sentToAgents     = custodyRows
      .filter(r => r.fromRole === "finance_manager" && r.toRole === "tech_engineer")
      .reduce((s, r) => s + parseFloat(r.amount), 0);
    const returnedFromAgents = custodyRows
      .filter(r => r.fromRole === "tech_engineer" && r.toRole === "finance_manager")
      .reduce((s, r) => s + parseFloat(r.amount), 0);
    const agentCustody = Math.max(0, sentToAgents - returnedFromAgents);

    /* إجمالي المبيعات من سجل المعاملات */
    const broadbandSales = txRows
      .filter(r => r.type === "sale")
      .reduce((s, r) => s + parseFloat(r.amount), 0);

    res.json({
      cashBalance,
      totalLoans,
      totalOwed,
      totalDebts: totalOwed,   /* alias — finance screen يقرأ totalDebts */
      totalCustody,
      cardsValue: Math.max(0, cardsValue),
      agentCustody,
      broadbandSales,
    });
  } catch (error) {
    res.status(500).json({ error: "فشل في جلب الملخص المالي", details: String(error) });
  }
});

export default router;
