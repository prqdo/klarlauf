import { env } from "cloudflare:workers";

export const orderStatuses = ["New", "In progress", "Review", "Ready"] as const;
export type OrderStatus = (typeof orderStatuses)[number];

export type Order = {
  id: string;
  client: string;
  project: string;
  due: string;
  value: number;
  status: OrderStatus;
};

type OrderRow = {
  id: number;
  client: string;
  project: string;
  due: string;
  value_cents: number;
  status: OrderStatus;
};

const createOrdersTableSql = `
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    client TEXT NOT NULL,
    project TEXT NOT NULL,
    due TEXT NOT NULL,
    value_cents INTEGER NOT NULL CHECK (value_cents > 0),
    status TEXT NOT NULL DEFAULT 'New' CHECK (status IN ('New', 'In progress', 'Review', 'Ready')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )
`;

const createStatusIndexSql = `
  CREATE INDEX IF NOT EXISTS idx_orders_status_created
  ON orders(status, created_at DESC)
`;

const seedOrders = [
  ["Moin Records", "Artist press kit", "2026-08-19", 76000, "Ready"],
  ["Küstenrad", "Product page system", "2026-08-21", 234000, "Review"],
  ["Förde Print Studio", "Campaign asset set", "2026-08-20", 92000, "In progress"],
  ["Nordlicht Café", "Landing page refresh", "2026-08-22", 148000, "New"],
] as const;

let databaseReady: Promise<void> | undefined;

function getD1(): D1Database {
  if (!env.DB) throw new Error("The Klarlauf database binding is unavailable.");
  return env.DB;
}

async function initializeDatabase() {
  if (!databaseReady) {
    databaseReady = (async () => {
      const db = getD1();
      await db.batch([
        db.prepare(createOrdersTableSql),
        db.prepare(createStatusIndexSql),
      ]);

      const count = await db.prepare("SELECT COUNT(*) AS total FROM orders").first<{ total: number }>();
      if ((count?.total ?? 0) === 0) {
        await db.batch(
          seedOrders.map((order) =>
            db.prepare(
              "INSERT INTO orders (client, project, due, value_cents, status) VALUES (?, ?, ?, ?, ?)",
            ).bind(...order),
          ),
        );
      }

      await db.prepare("PRAGMA optimize").run();
    })();
  }
  return databaseReady;
}

function toOrder(row: OrderRow): Order {
  return {
    id: `OF-${1044 + row.id}`,
    client: row.client,
    project: row.project,
    due: row.due,
    value: row.value_cents / 100,
    status: row.status,
  };
}

export async function listOrders(): Promise<Order[]> {
  await initializeDatabase();
  const result = await getD1()
    .prepare("SELECT id, client, project, due, value_cents, status FROM orders ORDER BY created_at DESC, id DESC")
    .all<OrderRow>();
  return result.results.map(toOrder);
}

export async function insertOrder(input: Omit<Order, "id" | "status">): Promise<Order> {
  await initializeDatabase();
  const row = await getD1()
    .prepare(
      "INSERT INTO orders (client, project, due, value_cents, status) VALUES (?, ?, ?, ?, 'New') RETURNING id, client, project, due, value_cents, status",
    )
    .bind(input.client, input.project, input.due, Math.round(input.value * 100))
    .first<OrderRow>();

  if (!row) throw new Error("The database did not return the created order.");
  return toOrder(row);
}

function toDatabaseId(publicId: string) {
  const match = /^OF-(\d+)$/.exec(publicId);
  if (!match) return null;

  const databaseId = Number(match[1]) - 1044;
  return Number.isInteger(databaseId) && databaseId > 0 ? databaseId : null;
}

export async function updateOrder(
  publicId: string,
  input: Omit<Order, "id">,
): Promise<Order | null> {
  await initializeDatabase();
  const databaseId = toDatabaseId(publicId);
  if (!databaseId) return null;

  const row = await getD1()
    .prepare(
      "UPDATE orders SET client = ?, project = ?, due = ?, value_cents = ?, status = ? WHERE id = ? RETURNING id, client, project, due, value_cents, status",
    )
    .bind(
      input.client,
      input.project,
      input.due,
      Math.round(input.value * 100),
      input.status,
      databaseId,
    )
    .first<OrderRow>();

  return row ? toOrder(row) : null;
}

export async function deleteOrder(publicId: string): Promise<boolean> {
  await initializeDatabase();
  const databaseId = toDatabaseId(publicId);
  if (!databaseId) return false;

  const result = await getD1()
    .prepare("DELETE FROM orders WHERE id = ?")
    .bind(databaseId)
    .run();

  return (result.meta.changes ?? 0) > 0;
}
