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

    let linkedLoanId: number | undefined;

    if (pt === "debt") {
      // أنشئ سجل الدين أولاً لنحتفظ بمعرّفه
      const [loan] = await db.insert(loansTable).values({
        personName: personName ?? desc,
        amount: String(parsedAmount),
        paidAmount: "0",
        status: "pending",
        notes: notes ?? desc,
        userId: req.currentUser!.id,
      }).returning();
      linkedLoanId = loan.id;
    }

    await db.insert(financialTransactionsTable).values({
      type: "expense",
      category: category as any,
      amount: String(parsedAmount),
      description: desc,
      role: req.currentUser!.role,
      personName: personName ?? req.currentUser!.name,
      referenceId: `EXP-${Date.now()}`,
      paymentType: pt,
      linkedLoanId: linkedLoanId ?? null,
    });

    await db.insert(expensesTable).values({
      description: desc,
      amount: String(parsedAmount),
      userId: req.currentUser!.id,
    });

    if (pt === "cash") {
      await db.execute(
        sql`UPDATE cash_box SET balance = balance - ${parsedAmount}, updated_at = NOW() WHERE id = 1`
      );
    }

    res.json({ success: true, amount: parsedAmount });
  } catch (error) {
    res.status(500).json({ error: "فشل في تسجيل الصرفية", details: String(error) });
  }
});

/* ─────────────────────────────────────────────
   DELETE /transactions/:id
   حذف معاملة مالية مع عكس أثرها المحاسبي
─────────────────────────────────────────────── */
router.delete("/transactions/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [tx] = await db.select().from(financialTransactionsTable)
      .where(eq(financialTransactionsTable.id, id)).limit(1);
    if (!tx) return res.status(404).json({ error: "المعاملة غير موجودة" });

    const amt = parseFloat(tx.amount);

    if (tx.type === "expense") {
      if (tx.paymentType === "cash") {
        /* نقدي: نُعيد المبلغ للصندوق */
        await db.execute(
          sql`UPDATE cash_box SET balance = balance + ${amt}, updated_at = NOW() WHERE id = 1`
        );
      } else if (tx.paymentType === "debt" && tx.linkedLoanId) {
        /* دين: نحذف سجل الدين المرتبط */
        await db.delete(loansTable).where(eq(loansTable.id, tx.linkedLoanId));
      }
    }

    await db.delete(financialTransactionsTable)
      .where(eq(financialTransactionsTable.id, id));

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "فشل في حذف المعاملة", details: String(error) });
  }
});

/* ─────────────────────────────────────────────
   PUT /transactions/:id
   تعديل معاملة مالية مع تعديل الأثر بالفرق
─────────────────────────────────────────────── */
router.put("/transactions/:id", requireAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const [tx] = await db.select().from(financialTransactionsTable)
      .where(eq(financialTransactionsTable.id, id)).limit(1);
    if (!tx) return res.status(404).json({ error: "المعاملة غير موجودة" });

    const { amount, description, paymentType, personName } = req.body;
    const oldAmt = parseFloat(tx.amount);
    const newAmt = parseFloat(amount) || oldAmt;
    const oldPt  = tx.paymentType ?? "cash";
    const newPt  = paymentType ?? oldPt;

    /* حساب الأثر على الصندوق */
    if (tx.type === "expense") {
      if (oldPt === "cash" && newPt === "cash") {
        /* نقد → نقد: عدّل الفرق */
        const diff = newAmt - oldAmt;
        if (diff !== 0) {
          await db.execute(
            sql`UPDATE cash_box SET balance = balance - ${diff}, updated_at = NOW() WHERE id = 1`
          );
        }
      } else if (oldPt === "cash" && newPt === "debt") {
        /* نقد → دين: أعد المبلغ القديم للصندوق وأنشئ دين جديد */
        await db.execute(
          sql`UPDATE cash_box SET balance = balance + ${oldAmt}, updated_at = NOW() WHERE id = 1`
        );
        /* حذف الدين القديم إن وجد */
        if (tx.linkedLoanId) await db.delete(loansTable).where(eq(loansTable.id, tx.linkedLoanId));
        /* إنشاء دين جديد */
        const [newLoan] = await db.insert(loansTable).values({
          personName: personName ?? tx.personName ?? tx.description ?? "غير محدد",
          amount: String(newAmt),
          paidAmount: "0",
          status: "pending",
          notes: description ?? tx.description ?? "",
          userId: req.currentUser!.id,
        }).returning();
        await db.update(financialTransactionsTable)
          .set({ linkedLoanId: newLoan.id })
          .where(eq(financialTransactionsTable.id, id));
      } else if (oldPt === "debt" && newPt === "cash") {
        /* دين → نقد: احذف الدين وانقص من الصندوق */
        if (tx.linkedLoanId) await db.delete(loansTable).where(eq(loansTable.id, tx.linkedLoanId));
        await db.execute(
          sql`UPDATE cash_box SET balance = balance - ${newAmt}, updated_at = NOW() WHERE id = 1`
        );
      } else if (oldPt === "debt" && newPt === "debt") {
        /* دين → دين: عدّل المبلغ في سجل الدين */
        if (tx.linkedLoanId) {
          await db.update(loansTable)
            .set({ amount: String(newAmt), updatedAt: new Date() })
            .where(eq(loansTable.id, tx.linkedLoanId));
        }
      }
    }

    /* حدّث المعاملة */
    const [updated] = await db.update(financialTransactionsTable).set({
      amount: String(newAmt),
      description: description ?? tx.description,
      paymentType: newPt,
      personName: personName ?? tx.personName,
    }).where(eq(financialTransactionsTable.id, id)).returning();

    res.json(updated);
  } catch (error) {
    res.status(500).json({ error: "فشل في تعديل المعاملة", details: String(error) });
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

      /* سداد دين: ينقص من الصندوق (نحن ندفع للجهة) */
      await db.execute(
        sql`UPDATE cash_box SET balance = balance - ${amount}, updated_at = NOW() WHERE id = 1`
      );
      return res.json({ success: true, amount });
    }

    /* تحصيل سلفة: يزيد الصندوق (نحن نستلم من العميل) */
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
        /* نقد استُلم من المالك → يزيد الصندوق */
        COALESCE(SUM(CASE WHEN from_role = 'owner' AND type = 'cash'  THEN amount::numeric ELSE 0 END), 0) AS owner_cash,
        /* كروت استُلمت من المالك → تزيد إجمالي الكروت */
        COALESCE(SUM(CASE WHEN from_role = 'owner' AND type = 'cards' THEN amount::numeric ELSE 0 END), 0) AS owner_cards,
        /* كروت مسلّمة للمندوبين */
        COALESCE(SUM(CASE WHEN from_role = 'finance_manager' AND type = 'cards' THEN amount::numeric ELSE 0 END), 0) AS agent_sent,
        /* كروت مرتجعة من المندوبين (نوع = cards فقط) */
        COALESCE(SUM(CASE WHEN from_role = 'tech_engineer' AND to_role = 'finance_manager' AND type = 'cards' THEN amount::numeric ELSE 0 END), 0) AS agent_returned_cards,
        /* نقد مستلم من المندوبين (نوع = cash فقط) */
        COALESCE(SUM(CASE WHEN from_role = 'tech_engineer' AND to_role = 'finance_manager' AND type = 'cash'  THEN amount::numeric ELSE 0 END), 0) AS agent_returned_cash
      FROM custody_records
    `);

    const txResult = await db.execute(sql`
      SELECT
        /* مبيعات برودباند (نقد أو سلفة) */
        COALESCE(SUM(CASE WHEN type = 'sale' AND category = 'broadband' THEN amount::numeric ELSE 0 END), 0) AS broadband_sales,
        /* مبيعات الكروت النقدية (ينقص من إجمالي الكروت) */
        COALESCE(SUM(CASE WHEN type = 'sale' AND category = 'hotspot'   THEN amount::numeric ELSE 0 END), 0) AS hotspot_sales
      FROM financial_transactions
    `);

    const cr: any = (summaryResult as any).rows?.[0] ?? (Array.isArray(summaryResult) ? summaryResult[0] : {});
    const tx: any = (txResult    as any).rows?.[0] ?? (Array.isArray(txResult)    ? txResult[0]    : {});

    const ownerCash           = parseFloat(cr.owner_cash           ?? "0");
    const ownerCards          = parseFloat(cr.owner_cards          ?? "0");
    const agentSent           = parseFloat(cr.agent_sent           ?? "0");
    const agentReturnedCards  = parseFloat(cr.agent_returned_cards ?? "0");
    const agentReturnedCash   = parseFloat(cr.agent_returned_cash  ?? "0");
    const hotspotSales        = parseFloat(tx.hotspot_sales        ?? "0");
    const broadbandSales      = parseFloat(tx.broadband_sales      ?? "0");

    /*
     * إجمالي العهدة = ما أعطاه المالك للمسؤول المالي (نقد + كروت)
     */
    const totalCustody = ownerCash + ownerCards;

    /*
     * العهدة الفعلية عند المندوبين = ما أُرسل − (نقد مسترد + كروت مرتجعة)
     */
    const agentCustody = Math.max(0, agentSent - agentReturnedCash - agentReturnedCards);

    /*
     * إجمالي الكروت الموجودة لدى المسؤول المالي:
     *   = كروت من المالك
     *   + كروت مرتجعة من المندوبين
     *   − كروت أُرسلت للمندوبين
     *   − مبيعات هوتسبوت (كروت بيعت مباشرة)
     */
    const cardsValue = ownerCards + agentReturnedCards - agentSent - hotspotSales;

    /* 5. السلف — debts table (مبالغ يستحق تحصيلها من العملاء) */
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

    res.json({
      totalCustody,
      cashBalance,
      cardsValue:   Math.max(0, cardsValue),
      agentCustody,
      broadbandSales,
      totalLoans,
      totalDebts,
    });
  } catch (error) {
    res.status(500).json({ error: "فشل في حساب الملخص المالي", details: String(error) });
  }
});

export default router;
