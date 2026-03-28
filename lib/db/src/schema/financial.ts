import { pgTable, text, serial, timestamp, pgEnum, integer, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const transactionTypeEnum = pgEnum("transaction_type", [
  "income",
  "expense",
]);

export const financialTxTypeEnum = pgEnum("financial_tx_type", [
  "sale",
  "expense",
  "custody_in",
  "custody_out",
  "loan",
]);

export const financialTxCategoryEnum = pgEnum("financial_tx_category", [
  "hotspot",
  "broadband",
  "operational",
  "salary",
  "other",
]);

export const debtStatusEnum = pgEnum("debt_status", [
  "pending",
  "partial",
  "paid",
]);

export const cardInventoryTable = pgTable("card_inventory", {
  id: serial("id").primaryKey(),
  cardType: text("card_type").notNull(),
  denomination: numeric("denomination", { precision: 10, scale: 2 }).notNull(),
  quantity: integer("quantity").notNull().default(0),
  salesPointId: integer("sales_point_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const cashBoxTable = pgTable("cash_box", {
  id: serial("id").primaryKey(),
  balance: numeric("balance", { precision: 12, scale: 2 }).notNull().default("0"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const salesTransactionsTable = pgTable("sales_transactions", {
  id: serial("id").primaryKey(),
  type: transactionTypeEnum("type").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  description: text("description"),
  userId: integer("user_id").notNull(),
  salesPointId: integer("sales_point_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const expensesTable = pgTable("expenses", {
  id: serial("id").primaryKey(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const debtsTable = pgTable("debts", {
  id: serial("id").primaryKey(),
  personName: text("person_name").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  status: debtStatusEnum("status").notNull().default("pending"),
  notes: text("notes"),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const loansTable = pgTable("loans", {
  id: serial("id").primaryKey(),
  personName: text("person_name").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  paidAmount: numeric("paid_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  status: debtStatusEnum("status").notNull().default("pending"),
  notes: text("notes"),
  userId: integer("user_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const custodiesTable = pgTable("custodies", {
  id: serial("id").primaryKey(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  userId: integer("user_id").notNull(),
  status: debtStatusEnum("status").notNull().default("pending"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const purchaseRequestsTable = pgTable("purchase_requests", {
  id: serial("id").primaryKey(),
  description: text("description").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }),
  requestedById: integer("requested_by_id").notNull(),
  status: text("status").notNull().default("pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const financialTransactionsTable = pgTable("financial_transactions", {
  id: serial("id").primaryKey(),
  type: financialTxTypeEnum("type").notNull(),
  category: financialTxCategoryEnum("category"),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  description: text("description"),
  role: text("role").notNull(),
  personName: text("person_name"),
  referenceId: text("reference_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertCardInventorySchema = createInsertSchema(cardInventoryTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSalesTransactionSchema = createInsertSchema(salesTransactionsTable).omit({ id: true, createdAt: true });
export const insertExpenseSchema = createInsertSchema(expensesTable).omit({ id: true, createdAt: true });
export const insertDebtSchema = createInsertSchema(debtsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertLoanSchema = createInsertSchema(loansTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertCustodySchema = createInsertSchema(custodiesTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPurchaseRequestSchema = createInsertSchema(purchaseRequestsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertFinancialTransactionSchema = createInsertSchema(financialTransactionsTable).omit({ id: true, createdAt: true });

export type CardInventory = typeof cardInventoryTable.$inferSelect;
export type SalesTransaction = typeof salesTransactionsTable.$inferSelect;
export type Expense = typeof expensesTable.$inferSelect;
export type Debt = typeof debtsTable.$inferSelect;
export type Loan = typeof loansTable.$inferSelect;
export type Custody = typeof custodiesTable.$inferSelect;
export type PurchaseRequest = typeof purchaseRequestsTable.$inferSelect;
export type FinancialTransaction = typeof financialTransactionsTable.$inferSelect;
export type InsertFinancialTransaction = z.infer<typeof insertFinancialTransactionSchema>;
