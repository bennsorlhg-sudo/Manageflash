import bcrypt from "bcryptjs";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";
import { sql } from "drizzle-orm";
import { logger } from "./logger";

const DEFAULT_USERS = [
  { name: "فهد الهندي", phone: "771163358", role: "owner" as const, password: "123456" },
  { name: "ريان رضوان", phone: "776218710", role: "finance_manager" as const, password: "123456" },
  { name: "محمد هاشم الزبود", phone: "772424239", role: "supervisor" as const, password: "123456" },
  { name: "خالد وليد", phone: "737214609", role: "tech_engineer" as const, password: "123456" },
];

async function runMigration(statement: string) {
  try {
    await db.execute(sql.raw(statement));
  } catch (err: any) {
    if (!String(err).includes("already exists")) {
      logger.warn({ statement, err: String(err) }, "Migration warning (non-fatal)");
    }
  }
}

/* ── ترقية تلقائية آمنة للأعمدة الجديدة ── */
export async function runSafeMigrations() {
  await runMigration(`ALTER TABLE debts ADD COLUMN IF NOT EXISTS entity_type TEXT DEFAULT 'other'`);
  await runMigration(`ALTER TABLE loans ADD COLUMN IF NOT EXISTS entity_type TEXT DEFAULT 'other'`);
  await runMigration(`ALTER TABLE repair_tickets ADD COLUMN IF NOT EXISTS contract_image_url TEXT`);
  await runMigration(`ALTER TABLE repair_tickets ADD COLUMN IF NOT EXISTS completion_photo_url TEXT`);
  await runMigration(`ALTER TABLE repair_tickets ADD COLUMN IF NOT EXISTS completion_photo_approved boolean DEFAULT false`);
  await runMigration(`ALTER TABLE installation_tickets ADD COLUMN IF NOT EXISTS completion_photo_url TEXT`);
  await runMigration(`ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS items_photo_url TEXT`);
  await runMigration(`ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS invoice_photo_url TEXT`);
  await runMigration(`ALTER TABLE purchase_requests ADD COLUMN IF NOT EXISTS transaction_id INTEGER`);
  await runMigration(`ALTER TABLE hotspot_points ADD COLUMN IF NOT EXISTS installed_by_name TEXT`);
  await runMigration(`ALTER TABLE hotspot_points ADD COLUMN IF NOT EXISTS install_date TIMESTAMP`);
  await runMigration(`ALTER TABLE broadband_points ADD COLUMN IF NOT EXISTS installed_by_name TEXT`);
  await runMigration(`ALTER TABLE broadband_points ADD COLUMN IF NOT EXISTS install_date TIMESTAMP`);
  await runMigration(`ALTER TABLE broadband_points ADD COLUMN IF NOT EXISTS modem_fee NUMERIC(10,2)`);
  logger.info("Safe column migrations complete");
}

export async function seedIfEmpty() {
  try {
    const result = await db.execute(sql`SELECT COUNT(*) as count FROM users`);
    const count = Number((result.rows[0] as any)?.count ?? 0);

    if (count > 0) {
      logger.info({ count }, "Database already has users, skipping seed");
      return;
    }

    logger.info("Seeding default users...");

    for (const u of DEFAULT_USERS) {
      const hash = await bcrypt.hash(u.password, 10);
      await db.insert(usersTable).values({
        name: u.name,
        phone: u.phone,
        role: u.role,
        passwordHash: hash,
        isActive: true,
      });
    }

    await db.execute(sql`
      INSERT INTO cash_box (balance) VALUES (0)
      ON CONFLICT DO NOTHING
    `);

    logger.info("Seeding complete — 4 users created");
  } catch (err) {
    logger.error({ err }, "Seed failed (non-fatal)");
  }
}
