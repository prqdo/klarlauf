import { sql } from "drizzle-orm";
import { check, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const orders = sqliteTable(
  "orders",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    client: text("client").notNull(),
    project: text("project").notNull(),
    due: text("due").notNull(),
    valueCents: integer("value_cents").notNull(),
    status: text("status", { enum: ["New", "In progress", "Review", "Ready"] })
      .notNull()
      .default("New"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    check("orders_value_positive", sql`${table.valueCents} > 0`),
    check("orders_status_valid", sql`${table.status} IN ('New', 'In progress', 'Review', 'Ready')`),
  ],
);
