import { pgTable, text, serial, timestamp, pgEnum, integer, decimal } from "drizzle-orm/pg-core";
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
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const salesPointsTable = pgTable("sales_points", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull(),
  managerId: integer("manager_id"),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertHotspotPointSchema = createInsertSchema(hotspotPointsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertBroadbandPointSchema = createInsertSchema(broadbandPointsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export const insertSalesPointSchema = createInsertSchema(salesPointsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertHotspotPoint = z.infer<typeof insertHotspotPointSchema>;
export type HotspotPoint = typeof hotspotPointsTable.$inferSelect;
export type InsertBroadbandPoint = z.infer<typeof insertBroadbandPointSchema>;
export type BroadbandPoint = typeof broadbandPointsTable.$inferSelect;
export type InsertSalesPoint = z.infer<typeof insertSalesPointSchema>;
export type SalesPoint = typeof salesPointsTable.$inferSelect;
export type PointStatus = "active" | "active_incomplete" | "ready" | "empty" | "stopped";
