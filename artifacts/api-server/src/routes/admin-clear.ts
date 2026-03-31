import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

/* مؤقت — يُحذَف بعد الاستخدام مباشرة */
router.post("/admin/clear-data", async (req, res) => {
  const { secret } = req.body as { secret?: string };
  if (secret !== "FLASHNET_CLEAR_2025") {
    return res.status(403).json({ error: "Forbidden" });
  }
  try {
    await db.execute(sql`
      TRUNCATE TABLE
        financial_transactions,
        custody_records,
        custodies,
        debts,
        loans,
        tasks,
        field_tasks,
        repair_tickets,
        installation_tickets,
        purchase_requests,
        sales_transactions,
        expenses,
        expense_templates,
        obligations,
        subscription_deliveries,
        sales_point_loans,
        card_inventory,
        tickets
      RESTART IDENTITY CASCADE
    `);
    await db.execute(sql`UPDATE cash_box SET balance = 0, updated_at = NOW()`);
    res.json({ success: true, message: "تم مسح كل البيانات التشغيلية" });
  } catch (err) {
    res.status(500).json({ error: String(err) });
  }
});

export default router;
