import { pgTable, serial, text, numeric, integer, timestamp, pgEnum, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const custodyTypeEnum = pgEnum("custody_type", ["cash", "cards"]);
export const roleEnum = pgEnum("role", ["owner", "finance_manager", "supervisor", "tech_engineer"]);

export const custodyRecordsTable = pgTable("custody_records", {
  id: serial("id").primaryKey(),
  type: custodyTypeEnum("type").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  denomination: integer("denomination"),
  cardCount: integer("card_count"),
  fromRole: roleEnum("from_role").notNull().default("owner"),
  toRole: roleEnum("to_role").notNull(),
  toPersonName: text("to_person_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCustodyRecordSchema = createInsertSchema(custodyRecordsTable).omit({ id: true, createdAt: true });
export type CustodyRecord = typeof custodyRecordsTable.$inferSelect;
export type InsertCustodyRecord = z.infer<typeof insertCustodyRecordSchema>;

/* ─── جدول تجاوزات الرصيد (للمالك فقط) ─── */
export const balanceOverridesTable = pgTable("balance_overrides", {
  key:       varchar("key", { length: 50 }).primaryKey(),
  value:     numeric("value", { precision: 14, scale: 2 }).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});
