import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import {
  financialTransactionsTable,
  debtsTable,
  loansTable,
  balanceOverridesTable,
} from "@workspace/db/schema";
import { custodyRecordsTable } from "@workspace/db/schema";
import { requireAuth } from "../lib/auth";

const router: IRouter = Router();

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

  const cashSales = txRows
    .filter(r => r.type === "sale"
      && (r.paymentType === "cash" || r.paymentType === "collect")
      && !String(r.referenceId ?? "").startsWith("CUSTODY-RECV"))
    .reduce((s, r) => s + parseFloat(r.amount), 0);

  const cashExpenses = txRows
    .filter(r => r.type === "expense" && (r.paymentType === "cash" || r.paymentType === "loan_payment"))
    .reduce((s, r) => s + parseFloat(r.amount), 0);

  const cashBalance = Math.max(0, cashSales - cashExpenses);

  const totalLoans = debtRows
    .filter(d => d.status !== "paid")
    .reduce((s, d) => s + Math.max(0, parseFloat(d.amount) - parseFloat(d.paidAmount ?? "0")), 0);

  const totalOwed = loanRows
    .filter(l => l.status !== "paid")
    .reduce((s, l) => s + Math.max(0, parseFloat(l.amount) - parseFloat(l.paidAmount ?? "0")), 0);

  const agentCustody = custodyRows
    .filter(r => r.fromRole === "tech_engineer")
    .reduce((s, r) => s + parseFloat(r.amount), 0);

  const broadbandSales = txRows
    .filter(r => r.type === "sale")
    .reduce((s, r) => s + parseFloat(r.amount), 0);

  return { cashBalance, totalLoans, totalOwed, agentCustody, broadbandSales };
}

/* ───────────────────────────────────────────────────────────
   GET /finances/summary
─────────────────────────────────────────────────────────── */
router.get("/finances/summary", requireAuth, async (_req, res) => {
  try {
    const [dynamic, overrideRows] = await Promise.all([
      computeDynamic(),
      db.select().from(balanceOverridesTable),
    ]);

    const deltas: Record<string, number> = {};
    for (const row of overrideRows) deltas[row.key] = parseFloat(row.value);

    const finalCash = Math.max(0, dynamic.cashBalance + (deltas["cash_balance"] ?? 0));

    res.json({
      cashBalance:    finalCash,
      totalLoans:     dynamic.totalLoans,
      totalOwed:      dynamic.totalOwed,
      totalDebts:     dynamic.totalOwed,
      totalCustody:   finalCash + dynamic.totalLoans,
      agentCustody:   dynamic.agentCustody,
      broadbandSales: dynamic.broadbandSales,
    });
  } catch (error) {
    res.status(500).json({ error: "فشل في جلب الملخص المالي", details: String(error) });
  }
});

export default router;
