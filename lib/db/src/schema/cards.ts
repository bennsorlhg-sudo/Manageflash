import { pgTable, serial, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const cardTypeEnum = pgEnum("card_type", ["hotspot", "broadband"]);
export const denominationEnum = pgEnum("denomination", ["200", "300", "500", "1000", "2000", "3000", "5000", "9000"]);

export const CARD_PRICES: Record<string, number> = {
  "200": 180,
  "300": 270,
  "500": 450,
  "1000": 900,
  "2000": 1800,
  "3000": 2700,
  "5000": 5000,
  "9000": 9000,
};

export const hotspotCardsTable = pgTable("hotspot_cards", {
  id: serial("id").primaryKey(),
  serial: text("serial").notNull().unique(),
  denomination: integer("denomination").notNull(),
  batchNumber: text("batch_number"),
  status: text("status").notNull().default("available"),
  assignedTo: text("assigned_to"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const broadbandCardsTable = pgTable("broadband_cards", {
  id: serial("id").primaryKey(),
  serial: text("serial").notNull().unique(),
  denomination: integer("denomination").notNull(),
  batchNumber: text("batch_number"),
  status: text("status").notNull().default("available"),
  assignedTo: text("assigned_to"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertHotspotCardSchema = createInsertSchema(hotspotCardsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBroadbandCardSchema = createInsertSchema(broadbandCardsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type HotspotCard = typeof hotspotCardsTable.$inferSelect;
export type BroadbandCard = typeof broadbandCardsTable.$inferSelect;
export type InsertHotspotCard = z.infer<typeof insertHotspotCardSchema>;
export type InsertBroadbandCard = z.infer<typeof insertBroadbandCardSchema>;
