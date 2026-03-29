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
    });

    if (paymentType === "cash") {
      await db.execute(
        sql`UPDATE cash_box SET balance = balance + ${totalAmount}, updated_at = NOW() WHERE id = 1`
      );
    } else {
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
    const { expenseType, amount, description, paymentType, notes } = req.body;

    const categoryMap: Record<string, string> = {
      daily: "operational", monthly: "operational",
      purchase: "other", salary: "salary",
    };
    const category = categoryMap[expenseType] ?? "operational";

    await db.insert(financialTransactionsTable).values({
      type: "expense",
      category: category as any,
      amount: String(amount),
      description: description ?? `صرفية - ${expenseType}`,
      role: req.currentUser!.role,
      personName: req.currentUser!.name,
      referenceId: `EXP-${Date.now()}`,
    });

    await db.insert(expensesTable).values({
      description: description ?? `صرفية - ${expenseType}`,
      amount: String(amount),
      userId: req.currentUser!.id,
    });

    if (paymentType === "cash") {
      await db.execute(
        sql`UPDATE cash_box SET balance = balance - ${amount}, updated_at = NOW() WHERE id = 1`
      );
    }

    res.json({ success: true, amount });
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

export default router;
