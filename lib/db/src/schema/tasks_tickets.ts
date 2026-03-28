import { pgTable, text, serial, timestamp, pgEnum, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const taskStatusEnum = pgEnum("task_status", [
  "pending",
  "in_progress",
  "completed",
  "cancelled",
]);

export const taskPriorityEnum = pgEnum("task_priority", [
  "low",
  "medium",
  "high",
  "urgent",
]);

export const ticketTypeEnum = pgEnum("ticket_type", [
  "repair",
  "installation",
  "support",
]);

export const taskTargetRoleEnum = pgEnum("task_target_role", [
  "finance_manager",
  "supervisor",
  "tech_engineer",
]);

export const tasksTable = pgTable("tasks", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: taskStatusEnum("status").notNull().default("pending"),
  priority: taskPriorityEnum("priority").notNull().default("medium"),
  assignedToId: integer("assigned_to_id"),
  createdById: integer("created_by_id"),
  targetRole: taskTargetRoleEnum("target_role"),
  targetPersonName: text("target_person_name"),
  assignedByRole: text("assigned_by_role").default("owner"),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const ticketsTable = pgTable("tickets", {
  id: serial("id").primaryKey(),
  type: ticketTypeEnum("type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  status: taskStatusEnum("status").notNull().default("pending"),
  priority: taskPriorityEnum("priority").notNull().default("medium"),
  assignedToId: integer("assigned_to_id"),
  createdById: integer("created_by_id").notNull(),
  locationOrPointId: integer("location_or_point_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertTaskSchema = createInsertSchema(tasksTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertTicketSchema = createInsertSchema(ticketsTable).omit({ id: true, createdAt: true, updatedAt: true });

export type Task = typeof tasksTable.$inferSelect;
export type Ticket = typeof ticketsTable.$inferSelect;
export type InsertTask = z.infer<typeof insertTaskSchema>;
export type InsertTicket = z.infer<typeof insertTicketSchema>;
