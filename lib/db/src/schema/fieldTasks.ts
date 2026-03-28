import { pgTable, serial, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const fieldTasksTable = pgTable("field_tasks", {
  id: serial("id").primaryKey(),
  taskType: varchar("task_type", { length: 100 }).notNull(),
  serviceNumber: varchar("service_number", { length: 100 }).notNull(),
  clientName: varchar("client_name", { length: 200 }),
  location: text("location").notNull(),
  phoneNumber: varchar("phone_number", { length: 50 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("new"),
  assignedEngineerName: varchar("assigned_engineer_name", { length: 200 }),
  notes: text("notes"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
});

export const insertFieldTaskSchema = createInsertSchema(fieldTasksTable).omit({
  id: true,
  createdAt: true,
  startedAt: true,
  completedAt: true,
});
export type InsertFieldTask = z.infer<typeof insertFieldTaskSchema>;
export type FieldTask = typeof fieldTasksTable.$inferSelect;
