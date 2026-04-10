import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  financialTransactionsTable,
  debtsTable,
  loansTable,
  balanceOverridesTable,
} from "@workspace/db/schema";
import { custodyRecordsTable } from "@workspace/db/schema";
import { sql, sum, eq } from "drizzle-orm";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

/* ═══════════════════════════════════════════════════════════
   دالة مشتركة: تحسب القيم الديناميكية من قاعدة البيانات
   (بدون أي تعديلات يدوية)
═══════════════════════════════════════════════════════════ */
async function computeDynamic() {
  const [debtRows, loanRows, custodyRows, txRows] = await Promise.all([
    db.select().from(debtsTable),
    db.select().from(loansTable),
    db.select().from(custodyRecordsTable),
    db.select({
      type:        financialTransactionsTable.type,
      category:    financialTransactionsTable.category,
      paymentType: financialTransactionsTable.paymentType,
      amount:      financialTransactionsTable.amount,
      referenceId: financialTransactionsTable.referenceId,
    }).from(financialTransactionsTable),
  ]);

  /* ── الصندوق النقدي ── */
  const cashFromOwner = custodyRows
    .filter(r => r.fromRole === "owner" && r.toRole === "finance_manager" && r.type === "cash")
    .reduce((s, r) => s + parseFloat(r.amount), 0);

  const cashFromAgents = custodyRows
    .filter(r => r.fromRole === "tech_engineer" && r.toRole === "finance_manager" && r.type === "cash")
    .reduce((s, r) => s + parseFloat(r.amount), 0);

  const cashSales = txRows
    .filter(r => r.type === "sale"
      && (r.paymentType === "cash" || r.paymentType === "collect")
      && !String(r.referenceId ?? "").startsWith("CUSTODY-RECV"))
    .reduce((s, r) => s + parseFloat(r.amount), 0);

  const cashExpenses = txRows
    .filter(r => r.type === "expense" && (r.paymentType === "cash" || r.paymentType === "loan_payment"))
    .reduce((s, r) => s + parseFloat(r.amount), 0);

  const cashBalance = Math.max(0, cashFromOwner + cashFromAgents + cashSales - cashExpenses);

  /* ── السلف والديون ── */
  const totalLoans = debtRows
    .filter(d => d.status !== "paid")
    .reduce((s, d) => s + Math.max(0, parseFloat(d.amount) - parseFloat(d.paidAmount ?? "0")), 0);

  const totalOwed = loanRows
    .filter(l => l.status !== "paid")
    .reduce((s, l) => s + Math.max(0, parseFloat(l.amount) - parseFloat(l.paidAmount ?? "0")), 0);

  /* ── الكروت ── */
  const cardsFromOwner = custodyRows
    .filter(r => r.fromRole === "owner" && r.toRole === "finance_manager" && r.type === "cards")
    .reduce((s, r) => s + parseFloat(r.amount), 0);

  const cardsSentToAgents = custodyRows
    .filter(r => r.fromRole === "finance_manager" && r.toRole === "tech_engineer" && r.type === "cards")
    .reduce((s, r) => s + parseFloat(r.amount), 0);

  const cardsReturnedFromAgents = custodyRows
    .filter(r => r.fromRole === "tech_engineer" && r.toRole === "finance_manager" && r.type === "cards")
    .reduce((s, r) => s + parseFloat(r.amount), 0);

  const cardSalesAmount = txRows
    .filter(r => r.type === "sale" && r.category === "hotspot"
      && !String(r.referenceId ?? "").startsWith("CUSTODY-RECV"))
    .reduce((s, r) => s + parseFloat(r.amount), 0);

  const cardsValue = Math.max(0,
    cardsFromOwner + cardsReturnedFromAgents - cardsSentToAgents - cardSalesAmount
  );

  /* ── عهدة المندوبين ── */
  const sentToAgents       = custodyRows
    .filter(r => r.fromRole === "finance_manager" && r.toRole === "tech_engineer")
    .reduce((s, r) => s + parseFloat(r.amount), 0);
  const returnedFromAgents = custodyRows
    .filter(r => r.fromRole === "tech_engineer" && r.toRole === "finance_manager")
    .reduce((s, r) => s + parseFloat(r.amount), 0);
  const agentCustody = Math.max(0, sentToAgents - returnedFromAgents);

  const broadbandSales = txRows
    .filter(r => r.type === "sale")
    .reduce((s, r) => s + parseFloat(r.amount), 0);

  return { cashBalance, cardsValue, totalLoans, totalOwed, agentCustody, broadbandSales };
}

/* ───────────────────────────────────────────────────────────
   GET /finances/report
─────────────────────────────────────────────────────────── */
router.get("/finances/report", async (req, res) => {
  try {
    const { period = "month", from, to } = req.query as { period?: string; from?: string; to?: string };

    const now = new Date();
    let fromDate: Date;
    let toDate: Date = now;

    if (period === "day") {
      fromDate = new Date(now); fromDate.setHours(0, 0, 0, 0);
    } else if (period === "week") {
      fromDate = new Date(now); fromDate.setDate(now.getDate() - 7);
    } else if (period === "custom" && from && to) {
      fromDate = new Date(from); toDate = new Date(to);
    } else {
      fromDate = new Date(now); fromDate.setDate(1); fromDate.setHours(0, 0, 0, 0);
    }

    const fromStr = fromDate.toISOString();
    const toStr   = toDate.toISOString();

    const [salesTotal, expenseTotal, hotspotSales, broadbandSales,
           operationalExpenses, salaryExpenses, otherExpenses] = await Promise.all([
      db.select({ total: sum(financialTransactionsTable.amount) }).from(financialTransactionsTable)
        .where(sql`${financialTransactionsTable.type} = 'sale' AND ${financialTransactionsTable.createdAt} >= ${fromStr}::timestamp AND ${financialTransactionsTable.createdAt} <= ${toStr}::timestamp`),
      db.select({ total: sum(financialTransactionsTable.amount) }).from(financialTransactionsTable)
        .where(sql`${financialTransactionsTable.type} = 'expense' AND ${financialTransactionsTable.createdAt} >= ${fromStr}::timestamp AND ${financialTransactionsTable.createdAt} <= ${toStr}::timestamp`),
      db.select({ total: sum(financialTransactionsTable.amount) }).from(financialTransactionsTable)
        .where(sql`${financialTransactionsTable.type} = 'sale' AND ${financialTransactionsTable.category} = 'hotspot' AND ${financialTransactionsTable.createdAt} >= ${fromStr}::timestamp AND ${financialTransactionsTable.createdAt} <= ${toStr}::timestamp`),
      db.select({ total: sum(financialTransactionsTable.amount) }).from(financialTransactionsTable)
        .where(sql`${financialTransactionsTable.type} = 'sale' AND ${financialTransactionsTable.category} = 'broadband' AND ${financialTransactionsTable.createdAt} >= ${fromStr}::timestamp AND ${financialTransactionsTable.createdAt} <= ${toStr}::timestamp`),
      db.select({ total: sum(financialTransactionsTable.amount) }).from(financialTransactionsTable)
        .where(sql`${financialTransactionsTable.type} = 'expense' AND ${financialTransactionsTable.category} = 'operational' AND ${financialTransactionsTable.createdAt} >= ${fromStr}::timestamp AND ${financialTransactionsTable.createdAt} <= ${toStr}::timestamp`),
      db.select({ total: sum(financialTransactionsTable.amount) }).from(financialTransactionsTable)
        .where(sql`${financialTransactionsTable.type} = 'expense' AND ${financialTransactionsTable.category} = 'salary' AND ${financialTransactionsTable.createdAt} >= ${fromStr}::timestamp AND ${financialTransactionsTable.createdAt} <= ${toStr}::timestamp`),
      db.select({ total: sum(financialTransactionsTable.amount) }).from(financialTransactionsTable)
        .where(sql`${financialTransactionsTable.type} = 'expense' AND ${financialTransactionsTable.category} = 'other' AND ${financialTransactionsTable.createdAt} >= ${fromStr}::timestamp AND ${financialTransactionsTable.createdAt} <= ${toStr}::timestamp`),
    ]);

    const totalSalesAmt   = parseFloat(salesTotal[0]?.total   ?? "0");
    const totalExpensesAmt = parseFloat(expenseTotal[0]?.total ?? "0");

    res.json({
      period,
      from: fromDate.toISOString().split("T")[0],
      to:   toDate.toISOString().split("T")[0],
      totalSales: totalSalesAmt,
      totalExpenses: totalExpensesAmt,
      profit: totalSalesAmt - totalExpensesAmt,
      salesBreakdown: {
        hotspot:   parseFloat(hotspotSales[0]?.total        ?? "0"),
        broadband: parseFloat(broadbandSales[0]?.total      ?? "0"),
      },
      expenseBreakdown: {
        operational: parseFloat(operationalExpenses[0]?.total ?? "0"),
        salary:      parseFloat(salaryExpenses[0]?.total      ?? "0"),
        other:       parseFloat(otherExpenses[0]?.total       ?? "0"),
      },
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch financial report", details: String(error) });
  }
});

/* ───────────────────────────────────────────────────────────
   POST /owner/balance
   المالك يُدخل القيمة الفعلية بعد الجرد.
   النظام يحسب الفرق (delta = الفعلي − المحسوب) ويخزّنه.
   عند عمليات البيع اللاحقة: finalValue = dynamic + delta
   مثال: محسوب=40000، فعلي=30000 → delta=−10000
         بعد بيع 5000: dynamic=35000 → final=35000+(−10000)=25000 ✓
─────────────────────────────────────────────────────────── */
router.post("/owner/balance", requireAuth, async (req, res) => {
  try {
    const { key, value } = req.body as { key: string; value: number };
    const ALLOWED = ["cash_balance", "cards_value"];
    if (!ALLOWED.includes(key)) return res.status(400).json({ error: "مفتاح غير مسموح" });
    if (typeof value !== "number" || isNaN(value) || value < 0)
      return res.status(400).json({ error: "قيمة غير صحيحة" });

    /* احسب القيمة الحالية الديناميكية لحساب الفرق */
    const dynamic = await computeDynamic();
    const currentDynamic = key === "cash_balance" ? dynamic.cashBalance : dynamic.cardsValue;
    const delta = value - currentDynamic; /* يمكن أن يكون سالباً */

    await db
      .insert(balanceOverridesTable)
      .values({ key, value: String(delta), updatedAt: new Date() })
      .onConflictDoUpdate({
        target: balanceOverridesTable.key,
        set: { value: String(delta), updatedAt: new Date() },
      });

    res.json({ ok: true, key, requestedValue: value, currentDynamic, delta });
  } catch (error) {
    res.status(500).json({ error: "فشل في حفظ القيمة", details: String(error) });
  }
});

/* ───────────────────────────────────────────────────────────
   DELETE /owner/balance/:key — حذف تعديل (يعود للحساب التلقائي)
─────────────────────────────────────────────────────────── */
router.delete("/owner/balance/:key", requireAuth, async (req, res) => {
  try {
    await db.delete(balanceOverridesTable).where(eq(balanceOverridesTable.key, req.params.key));
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ error: "فشل في الحذف", details: String(error) });
  }
});

/* ───────────────────────────────────────────────────────────
   GET /finances/summary
   القيمة النهائية = المحسوبة ديناميكياً + فرق التعديل اليدوي
   هذا يضمن أن عمليات البيع تؤثر على الأرقام حتى بعد الجرد
─────────────────────────────────────────────────────────── */
router.get("/finances/summary", requireAuth, async (_req, res) => {
  try {
    const [dynamic, overrideRows] = await Promise.all([
      computeDynamic(),
      db.select().from(balanceOverridesTable),
    ]);

    /* فروق التعديل (delta) — تُضاف على القيمة الديناميكية */
    const deltas: Record<string, number> = {};
    for (const row of overrideRows) deltas[row.key] = parseFloat(row.value);

    /* القيم النهائية = ديناميكي + فرق التعديل */
    const finalCash  = Math.max(0, dynamic.cashBalance + (deltas["cash_balance"] ?? 0));
    const finalCards = Math.max(0, dynamic.cardsValue  + (deltas["cards_value"]  ?? 0));

    /* العهدة الرئيسية = الكروت الفعلي + الصندوق النقدي + السلف */
    const finalCustody = finalCash + finalCards + dynamic.totalLoans;

    res.json({
      cashBalance:  finalCash,
      totalLoans:   dynamic.totalLoans,
      totalOwed:    dynamic.totalOwed,
      totalDebts:   dynamic.totalOwed,
      totalCustody: finalCustody,
      cardsValue:   finalCards,
      agentCustody: dynamic.agentCustody,
      broadbandSales: dynamic.broadbandSales,
    });
  } catch (error) {
    res.status(500).json({ error: "فشل في جلب الملخص المالي", details: String(error) });
  }
});

export default router;
