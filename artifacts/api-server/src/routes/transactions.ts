import { Router } from "express";
import { db } from "@workspace/db";
import {
  financialTransactionsTable,
  salesTransactionsTable,
  cashBoxTable,
  debtsTable,
  loansTable,
  expensesTable,
  expenseTemplatesTable,
  obligationsTable,
} from "@workspace/db/schema";
import { requireAuth } from "../lib/auth";
import { eq, desc, sql, and, gte, lte } from "drizzle-orm";

const router = Router();

const CARD_PRICES: Record<number, number> = {
  200: 180, 300: 270, 500: 450, 1000: 900,
  2000: 1800, 3000: 2700, 5000: 5000, 9000: 9000,
};

router.post("/transactions/sell", requireAuth, async (req, res) => {
  try {
    const { cardType, denomination, quantity, amount, paymentType, customerName, notes } = req.body;

    let totalAmount: number;
    let description: string;

    if (amount !== undefined && amount !== null) {
      // Finance Manager flow: direct amount entry
      totalAmount = parseFloat(amount);
      description = `بيع ${cardType === "broadband" ? "باقات برودباند" : "كروت هوتسبوت"} - ${customerName}`;
    } else {
      // Owner flow: denomination + quantity
      const unitPrice = CARD_PRICES[denomination] ?? denomination * 0.9;
      totalAmount = unitPrice * quantity;
      description = `بيع ${quantity} كرت ${denomination} ريال - ${cardType === "broadband" ? "باقات" : "هوتسبوت"}`;
    }

    if (!totalAmount || totalAmount <= 0) {
      return res.status(400).json({ error: "المبلغ غير صحيح" });
    }

    await db.insert(financialTransactionsTable).values({
      type: "sale",
      category: cardType === "broadband" ? "broadband" : "hotspot",
      amount: String(totalAmount),
      description,
      role: req.currentUser!.role,
      personName: customerName ?? req.currentUser!.name,
      referenceId: `SELL-${Date.now()}`,
      paymentType: paymentType === "cash" ? "cash" : "loan",
    });

    if (paymentType === "cash") {
      await db.execute(
        sql`UPDATE cash_box SET balance = balance + ${totalAmount}, updated_at = NOW() WHERE id = 1`
      );
    } else {
      // سلفة → سجّل في جدول الديون (ما يستحق علينا تحصيله)
      await db.insert(debtsTable).values({
        personName: customerName ?? "عميل",
        amount: String(totalAmount),
        paidAmount: "0",
        status: "pending",
        notes: notes ?? description,
        userId: req.currentUser!.id,
      });
    }

    res.json({ success: true, amount: totalAmount });
  } catch (error) {
    res.status(500).json({ error: "فشل في إتمام البيع", details: String(error) });
  }
});

router.post("/transactions/disburse", requireAuth, async (req, res) => {
  try {
    const { expenseType, amount, description, paymentType, personName, notes } = req.body;
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) return res.status(400).json({ error: "المبلغ غير صحيح" });

    const categoryMap: Record<string, string> = {
      daily: "operational", monthly: "operational",
      purchase: "other", salary: "salary",
    };
    const category = categoryMap[expenseType] ?? "operational";
    const desc = description ?? `صرفية - ${expenseType}`;
    const pt = paymentType === "debt" ? "debt" : "cash";

    await db.insert(financialTransactionsTable).values({
      type: "expense",
      category: category as any,
      amount: String(parsedAmount),
      description: desc,
      role: req.currentUser!.role,
      personName: personName ?? req.currentUser!.name,
      referenceId: `EXP-${Date.now()}`,
      paymentType: pt,
    });

    await db.insert(expensesTable).values({
      description: desc,
      amount: String(parsedAmount),
      userId: req.currentUser!.id,
    });

    if (pt === "cash") {
      // صرف نقدي → ينقص من الصندوق وينقص من إجمالي العهدة
      await db.execute(
        sql`UPDATE cash_box SET balance = balance - ${parsedAmount}, updated_at = NOW() WHERE id = 1`
      );
    } else {
      // صرف دين → لا ينقص من الصندوق، يُسجّل كالتزام على الشبكة
      await db.insert(loansTable).values({
        personName: personName ?? desc,
        amount: String(parsedAmount),
        paidAmount: "0",
        status: "pending",
        notes: notes ?? desc,
        userId: req.currentUser!.id,
      });
    }

    res.json({ success: true, amount: parsedAmount });
  } catch (error) {
    res.status(500).json({ error: "فشل في تسجيل الصرفية", details: String(error) });
  }
});

router.post("/transactions/collect", requireAuth, async (req, res) => {
  try {
    const { sourceType, sourceId, amount, notes } = req.body;

    if (sourceType === "debt") {
      const [debt] = await db.select().from(debtsTable).where(eq(debtsTable.id, sourceId)).limit(1);
      if (!debt) return res.status(404).json({ error: "الدين غير موجود" });

      const newPaid = parseFloat(debt.paidAmount) + parseFloat(amount);
      const status = newPaid >= parseFloat(debt.amount) ? "paid" : "partial";

      await db.update(debtsTable)
        .set({ paidAmount: String(newPaid), status: status as any, updatedAt: new Date() })
        .where(eq(debtsTable.id, sourceId));
    } else if (sourceType === "loan") {
      const [loan] = await db.select().from(loansTable).where(eq(loansTable.id, sourceId)).limit(1);
      if (!loan) return res.status(404).json({ error: "القرض غير موجود" });

      const newPaid = parseFloat(loan.paidAmount) + parseFloat(amount);
      const status = newPaid >= parseFloat(loan.amount) ? "paid" : "partial";

      await db.update(loansTable)
        .set({ paidAmount: String(newPaid), status: status as any, updatedAt: new Date() })
        .where(eq(loansTable.id, sourceId));
    }

    await db.execute(
      sql`UPDATE cash_box SET balance = balance + ${amount}, updated_at = NOW() WHERE id = 1`
    );

    res.json({ success: true, amount });
  } catch (error) {
    res.status(500).json({ error: "فشل في التحصيل", details: String(error) });
  }
});

router.get("/transactions", requireAuth, async (req, res) => {
  try {
    const { type, from, to, limit: limitStr = "50" } = req.query as any;
    const limit = Math.min(parseInt(limitStr), 200);

    let conditions: any[] = [];
    if (type) conditions.push(eq(financialTransactionsTable.type, type));
    if (from) conditions.push(gte(financialTransactionsTable.createdAt, new Date(from)));
    if (to) conditions.push(lte(financialTransactionsTable.createdAt, new Date(to)));

    const rows = await db.select().from(financialTransactionsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(financialTransactionsTable.createdAt))
      .limit(limit);

    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "فشل في جلب المعاملات", details: String(error) });
  }
});

router.get("/debts", requireAuth, async (req, res) => {
  try {
    const rows = await db.select().from(debtsTable)
      .orderBy(desc(debtsTable.createdAt));
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "فشل في جلب الديون" });
  }
});

router.post("/debts", requireAuth, async (req, res) => {
  try {
    const { personName, amount, notes } = req.body;
    const [row] = await db.insert(debtsTable).values({
      personName, amount: String(amount), paidAmount: "0",
      status: "pending", notes, userId: req.currentUser!.id,
    }).returning();
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "فشل في إضافة الدين" });
  }
});

router.put("/debts/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates: any = { updatedAt: new Date() };
    if (req.body.paidAmount !== undefined) updates.paidAmount = String(req.body.paidAmount);
    if (req.body.status) updates.status = req.body.status;
    if (req.body.notes !== undefined) updates.notes = req.body.notes;

    const [row] = await db.update(debtsTable).set(updates).where(eq(debtsTable.id, id)).returning();
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "فشل في تحديث الدين" });
  }
});

router.get("/loans", requireAuth, async (req, res) => {
  try {
    const rows = await db.select().from(loansTable).orderBy(desc(loansTable.createdAt));
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "فشل في جلب القروض" });
  }
});

router.post("/loans", requireAuth, async (req, res) => {
  try {
    const { personName, amount, notes } = req.body;
    const [row] = await db.insert(loansTable).values({
      personName, amount: String(amount), paidAmount: "0",
      status: "pending", notes, userId: req.currentUser!.id,
    }).returning();
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "فشل في إضافة القرض" });
  }
});

router.put("/loans/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates: any = { updatedAt: new Date() };
    if (req.body.paidAmount !== undefined) updates.paidAmount = String(req.body.paidAmount);
    if (req.body.status) updates.status = req.body.status;
    if (req.body.notes !== undefined) updates.notes = req.body.notes;

    const [row] = await db.update(loansTable).set(updates).where(eq(loansTable.id, id)).returning();
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "فشل في تحديث القرض" });
  }
});

router.get("/expenses", requireAuth, async (req, res) => {
  try {
    const rows = await db.select().from(expensesTable).orderBy(desc(expensesTable.createdAt)).limit(100);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "فشل في جلب المصروفات" });
  }
});

router.post("/expenses", requireAuth, async (req, res) => {
  try {
    const { description, amount } = req.body;
    const [row] = await db.insert(expensesTable).values({
      description, amount: String(amount), userId: req.currentUser!.id,
    }).returning();
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "فشل في إضافة المصروف" });
  }
});

router.delete("/expenses/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    await db.delete(expensesTable).where(eq(expensesTable.id, id));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "فشل في حذف المصروف" });
  }
});

router.get("/expense-templates", requireAuth, async (req, res) => {
  try {
    const rows = await db.select().from(expenseTemplatesTable).orderBy(expenseTemplatesTable.name);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "فشل في جلب القوالب" });
  }
});

router.post("/expense-templates", requireAuth, async (req, res) => {
  try {
    const { name, amount, category } = req.body;
    const [row] = await db.insert(expenseTemplatesTable).values({ name, amount: amount ? String(amount) : null, category }).returning();
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "فشل في إضافة القالب" });
  }
});

router.delete("/expense-templates/:id", requireAuth, async (req, res) => {
  try {
    await db.delete(expenseTemplatesTable).where(eq(expenseTemplatesTable.id, parseInt(req.params.id)));
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "فشل في حذف القالب" });
  }
});

router.get("/obligations", requireAuth, async (req, res) => {
  try {
    const rows = await db.select().from(obligationsTable).orderBy(obligationsTable.dueDay);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: "فشل في جلب الالتزامات" });
  }
});

router.post("/obligations", requireAuth, async (req, res) => {
  try {
    const { name, amount, dueDay, notes } = req.body;
    const [row] = await db.insert(obligationsTable).values({ name, amount: String(amount), dueDay, notes }).returning();
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "فشل في إضافة الالتزام" });
  }
});

router.put("/obligations/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const updates: any = { updatedAt: new Date() };
    if (req.body.isPaid !== undefined) updates.isPaid = req.body.isPaid ? 1 : 0;
    if (req.body.name) updates.name = req.body.name;
    if (req.body.amount !== undefined) updates.amount = String(req.body.amount);

    const [row] = await db.update(obligationsTable).set(updates).where(eq(obligationsTable.id, id)).returning();
    res.json(row);
  } catch (error) {
    res.status(500).json({ error: "فشل في تحديث الالتزام" });
  }
});

router.get("/cash-box", requireAuth, async (req, res) => {
  try {
    const [box] = await db.select().from(cashBoxTable).limit(1);
    res.json({ balance: parseFloat(box?.balance ?? "0") });
  } catch (error) {
    res.status(500).json({ error: "فشل في جلب الصندوق" });
  }
});

/* ─────────────────────────────────────────────
   GET /finances/summary
   يحسب الـ 6 بطاقات للمسؤول المالي بدقة
─────────────────────────────────────────────── */
router.get("/finances/summary", requireAuth, async (_req, res) => {
  try {
    /* 1. الصندوق النقدي */
    const [cashRow] = await db.select({ bal: cashBoxTable.balance }).from(cashBoxTable).limit(1);
    const cashBalance = parseFloat(cashRow?.bal ?? "0");

    /* 2-4. حسابات من custody_records + financial_transactions */
    const summaryResult = await db.execute(sql`
      SELECT
        /* نقد استُلم من المالك */
        COALESCE(SUM(CASE WHEN from_role = 'owner' AND type = 'cash' THEN amount::numeric ELSE 0 END), 0) AS owner_cash,
        /* كروت استُلمت من المالك */
        COALESCE(SUM(CASE WHEN from_role = 'owner' AND type = 'cards' THEN amount::numeric ELSE 0 END), 0) AS owner_cards,
        /* كروت مسلّمة للمندوبين (ما أُرسل) */
        COALESCE(SUM(CASE WHEN from_role = 'finance_manager' AND type = 'cards' THEN amount::numeric ELSE 0 END), 0) AS agent_sent,
        /* ما استُلم من المندوبين (نقد + كروت مرتجعة) */
        COALESCE(SUM(CASE WHEN from_role = 'tech_engineer' AND to_role = 'finance_manager' THEN amount::numeric ELSE 0 END), 0) AS agent_received
      FROM custody_records
    `);

    const txResult = await db.execute(sql`
      SELECT
        /* مبيعات برودباند الكلية */
        COALESCE(SUM(CASE WHEN type = 'sale' AND category = 'broadband' THEN amount::numeric ELSE 0 END), 0) AS broadband_sales,
        /* مبيعات الكروت الكلية */
        COALESCE(SUM(CASE WHEN type = 'sale' AND category = 'hotspot' THEN amount::numeric ELSE 0 END), 0) AS hotspot_sales,
        /* الصرف النقدي فقط */
        COALESCE(SUM(CASE WHEN type = 'expense' AND payment_type = 'cash' THEN amount::numeric ELSE 0 END), 0) AS cash_expenses
      FROM financial_transactions
    `);

    const cr: any = (summaryResult as any).rows?.[0] ?? (Array.isArray(summaryResult) ? summaryResult[0] : {});
    const tx: any = (txResult as any).rows?.[0] ?? (Array.isArray(txResult) ? txResult[0] : {});

    const ownerCash      = parseFloat(cr.owner_cash     ?? "0");
    const ownerCards     = parseFloat(cr.owner_cards    ?? "0");
    const agentSent      = parseFloat(cr.agent_sent     ?? "0");
    const agentReceived  = parseFloat(cr.agent_received ?? "0");
    /* العهدة الفعلية عند المندوبين = ما أُرسل − ما استُلم */
    const agentCustody   = Math.max(0, agentSent - agentReceived);
    const broadbandSales = parseFloat(tx.broadband_sales ?? "0");
    const hotspotSales   = parseFloat(tx.hotspot_sales   ?? "0");
    const cashExpenses   = parseFloat(tx.cash_expenses   ?? "0");

    /* 5. السلف — debts table (مبالغ يستحق تحصيلها) */
    const loansResult = await db.execute(sql`
      SELECT COALESCE(SUM((amount::numeric - paid_amount::numeric)), 0) AS total
      FROM debts WHERE status != 'paid'
    `);
    const loansRow: any = (loansResult as any).rows?.[0] ?? (Array.isArray(loansResult) ? loansResult[0] : {});
    const totalLoans = parseFloat(loansRow.total ?? "0");

    /* 6. الديون — loans table (التزامات مالية على الشبكة) */
    const debtsResult = await db.execute(sql`
      SELECT COALESCE(SUM((amount::numeric - paid_amount::numeric)), 0) AS total
      FROM loans WHERE status != 'paid'
    `);
    const debtsRow: any = (debtsResult as any).rows?.[0] ?? (Array.isArray(debtsResult) ? debtsResult[0] : {});
    const totalDebts = parseFloat(debtsRow.total ?? "0");

    /* حسابات مشتقة */
    const totalCustody = ownerCash + ownerCards + broadbandSales - cashExpenses;
    const cardsValue   = ownerCards - hotspotSales - agentCustody;

    res.json({
      totalCustody:  Math.max(0, totalCustody),
      cashBalance,
      cardsValue:    Math.max(0, cardsValue),
      agentCustody,
      totalLoans,
      totalDebts,
    });
  } catch (error) {
    res.status(500).json({ error: "فشل في حساب الملخص المالي", details: String(error) });
  }
});

export default router;
