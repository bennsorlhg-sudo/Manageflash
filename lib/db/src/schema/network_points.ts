import { pgTable, text, serial, timestamp, pgEnum, integer, decimal, numeric, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const pointStatusEnum = pgEnum("point_status", [
  "active",
  "active_incomplete",
  "ready",
  "empty",
  "stopped",
]);

export const hotspotPointsTable = pgTable("hotspot_points", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  status: pointStatusEnum("status").notNull().default("empty"),
  supervisorId: integer("supervisor_id"),
  notes: text("notes"),
  // Core fields
  hotspotType: text("hotspot_type").default("internal"),   // "internal" | "external"
  flashNumber: integer("flash_number"),                    // e.g. 1, 3, 5
  deviceName: text("device_name"),                         // e.g. "LG", "Huawei"
  clientName: text("client_name"),
  clientPhone: text("client_phone"),
  subscriptionFee: numeric("subscription_fee", { precision: 10, scale: 2 }),
  ipAddress: text("ip_address"),
  isClientOwned: boolean("is_client_owned").default(false),
  locationUrl: text("location_url"),                       // Google Maps URL
  // External hotspot archiving fields
  installPhoto: text("install_photo"),                     // base64 image from tech engineer
  installedByName: text("installed_by_name"),              // tech engineer name
  installDate: timestamp("install_date"),                  // installation date
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const broadbandPointsTable = pgTable("broadband_points", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  status: pointStatusEnum("status").notNull().default("empty"),
  supervisorId: integer("supervisor_id"),
  speed: text("speed"),
  notes: text("notes"),
  // New fields
  flashNumber: integer("flash_number"),
  subscriptionName: text("subscription_name"),
  deviceName: text("device_name"),
  clientName: text("client_name"),
  clientPhone: text("client_phone"),
  subscriptionFee: numeric("subscription_fee", { precision: 10, scale: 2 }),
  locationUrl: text("location_url"),
  isClientOwned: boolean("is_client_owned").default(false),
  installedByName: text("installed_by_name"),
  installDate: timestamp("install_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const salesPointsTable = pgTable("sales_points", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  managerId: integer("manager_id"),
  ownerName: text("owner_name").notNull().default(""),
  phoneNumber: text("phone_number").notNull().default(""),
  oldDebt: numeric("old_debt", { precision: 12, scale: 2 }).default("0"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const salesPointLoansTable = pgTable("sales_point_loans", {
  id: serial("id").primaryKey(),
  salesPointId: integer("sales_point_id").notNull(),
  direction: text("direction").notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  notes: text("notes"),
  recordedAt: timestamp("recorded_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertHotspotPointSchema = createInsertSchema(hotspotPointsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export const insertBroadbandPointSchema = createInsertSchema(broadbandPointsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export const insertSalesPointSchema = createInsertSchema(salesPointsTable).omit({
  id: true, createdAt: true, updatedAt: true,
});
export const insertSalesPointLoanSchema = createInsertSchema(salesPointLoansTable).omit({
  id: true, createdAt: true, recordedAt: true,
});

export type InsertHotspotPoint = z.infer<typeof insertHotspotPointSchema>;
export type HotspotPoint = typeof hotspotPointsTable.$inferSelect;
export type InsertBroadbandPoint = z.infer<typeof insertBroadbandPointSchema>;
export type BroadbandPoint = typeof broadbandPointsTable.$inferSelect;
export type InsertSalesPoint = z.infer<typeof insertSalesPointSchema>;
export type SalesPoint = typeof salesPointsTable.$inferSelect;
export type InsertSalesPointLoan = z.infer<typeof insertSalesPointLoanSchema>;
export type SalesPointLoan = typeof salesPointLoansTable.$inferSelect;
export type PointStatus = "active" | "active_incomplete" | "ready" | "empty" | "stopped";
