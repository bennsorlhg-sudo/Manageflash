import { pgTable, text, serial, timestamp, pgEnum, integer, numeric, boolean } from "drizzle-orm/pg-core";
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
  entityType: text("entity_type").default("other"),  /* hotspot | broadband | sales_point | other */
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
  entityType: text("entity_type").default("other"),  /* broadband | sales_point | supplier | other */
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
  quantity: integer("quantity"),
  unit: text("unit"),
  priority: text("priority").notNull().default("medium"),
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
  paymentType: text("payment_type"),
  linkedLoanId: integer("linked_loan_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const expenseTemplatesTable = pgTable("expense_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }),
  category: text("category").notNull().default("operational"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const obligationsTable = pgTable("obligations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  dueDay: integer("due_day"),
  isPaid: integer("is_paid").notNull().default(0),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const repairTicketsTable = pgTable("repair_tickets", {
  id: serial("id").primaryKey(),
  serviceNumber: text("service_number").notNull(),
  clientName: text("client_name"),
  clientPhone: text("client_phone"),
  serviceType: text("service_type").notNull().default("hotspot_internal"),
  problemDescription: text("problem_description"),
  location: text("location"),
  status: text("status").notNull().default("pending"),
  priority: text("priority").notNull().default("normal"),
  assignedToId: integer("assigned_to_id"),
  assignedToName: text("assigned_to_name"),
  locationUrl: text("location_url"),
  notes: text("notes"),
  createdById: integer("created_by_id"),
  createdByName: text("created_by_name"),
  deletedById: integer("deleted_by_id"),
  deletedByName: text("deleted_by_name"),
  deletedAt: timestamp("deleted_at"),
  startedAt: timestamp("started_at"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const installationTicketsTable = pgTable("installation_tickets", {
  id: serial("id").primaryKey(),
  clientName: text("client_name"),
  clientPhone: text("client_phone"),
  serviceType: text("service_type").notNull().default("hotspot_internal"),
  locationUrl: text("location_url"),
  address: text("address"),
  notes: text("notes"),
  status: text("status").notNull().default("new"),
  assignedToId: integer("assigned_to_id"),
  assignedToName: text("assigned_to_name"),
  scheduledAt: timestamp("scheduled_at"),
  completedAt: timestamp("completed_at"),
  archivedAt: timestamp("archived_at"),
  archiveNotes: text("archive_notes"),
  createdById: integer("created_by_id"),
  /* ─── حقول التجهيز ─── */
  subscriptionFee: numeric("subscription_fee", { precision: 10, scale: 2 }),
  deviceName: text("device_name"),
  deviceSerial: text("device_serial"),
  subscriptionName: text("subscription_name"),
  internetFee: numeric("internet_fee", { precision: 10, scale: 2 }),
  contractImageUrl: text("contract_image_url"),
  engineerNotes: text("engineer_notes"),
  /* ─── نقاط البث الوسيطة ─── */
  relayPointsJson: text("relay_points_json"),
  hasRelayPoints: boolean("has_relay_points").default(false),
  /* ─── ربط بالجدول الفرعي ─── */
  parentTicketId: integer("parent_ticket_id"),
  isRelayPoint: boolean("is_relay_point").default(false),
  sequenceOrder: integer("sequence_order").default(0),
  /* مقوي داخلي هوتسبوت ضمن نفس التذكرة (برودباند داخلي) */
  hasBooster:            boolean("has_booster").default(false),
  boosterDeviceName:     text("booster_device_name"),
  boosterDeviceSerial:   text("booster_device_serial"),
  boosterSubscriptionFee: text("booster_subscription_fee"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const subscriptionDeliveryTable = pgTable("subscription_deliveries", {
  id: serial("id").primaryKey(),
  engineerId: integer("engineer_id"),
  engineerName: text("engineer_name").notNull(),
  cardType: text("card_type").notNull().default("hotspot"),
  denomination: integer("denomination").notNull(),
  cardCount: integer("card_count").notNull(),
  totalValue: numeric("total_value", { precision: 12, scale: 2 }).notNull(),
  deliveredToFinanceId: integer("delivered_to_finance_id"),
  deliveredToName: text("delivered_to_name"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertExpenseTemplateSchema = createInsertSchema(expenseTemplatesTable).omit({ id: true, createdAt: true });
export const insertObligationSchema = createInsertSchema(obligationsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertRepairTicketSchema = createInsertSchema(repairTicketsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInstallationTicketSchema = createInsertSchema(installationTicketsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertSubscriptionDeliverySchema = createInsertSchema(subscriptionDeliveryTable).omit({ id: true, createdAt: true });

export type ExpenseTemplate = typeof expenseTemplatesTable.$inferSelect;
export type Obligation = typeof obligationsTable.$inferSelect;
export type RepairTicket = typeof repairTicketsTable.$inferSelect;
export type InstallationTicket = typeof installationTicketsTable.$inferSelect;
export type SubscriptionDelivery = typeof subscriptionDeliveryTable.$inferSelect;

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
