import assert from "node:assert/strict";
import { mkdir, mkdtemp, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { after, before, beforeEach, test } from "node:test";
import { fileURLToPath } from "node:url";
import { Miniflare } from "miniflare";

let runtime;
let database;
let databaseDirectory;

const orderDetails = {
  client: "Test client",
  project: "Website update",
  due: "2026-12-01",
  value: 123.45,
};

before(async () => {
  const workDirectory = fileURLToPath(new URL("../work/", import.meta.url));
  await mkdir(workDirectory, { recursive: true });
  databaseDirectory = await mkdtemp(join(workDirectory, "d1-test-"));
  const serverDirectory = fileURLToPath(
    new URL("../dist/server/", import.meta.url),
  );
  const serverFiles = await readdir(serverDirectory, { recursive: true });
  const modules = [
    { type: "ESModule", path: join(serverDirectory, "index.js") },
    ...serverFiles
      .filter((path) => path.endsWith(".js") && path !== "index.js")
      .map((path) => ({ type: "ESModule", path: join(serverDirectory, path) })),
  ];

  runtime = new Miniflare({
    modules,
    compatibilityDate: "2026-05-22",
    compatibilityFlags: ["nodejs_compat"],
    d1Databases: ["DB"],
    d1Persist: databaseDirectory,
  });

  const response = await runtime.dispatchFetch("http://localhost/api/orders");
  assert.equal(response.status, 200, await response.text());
  database = await runtime.getD1Database("DB");
});

beforeEach(async () => {
  await database.prepare("DELETE FROM orders").run();
});

after(async () => {
  await runtime?.dispose();
  if (databaseDirectory)
    await rm(databaseDirectory, { recursive: true, force: true });
});

function request(method, path, payload) {
  return runtime.dispatchFetch(new URL(path, "http://localhost"), {
    method,
    headers: { "content-type": "application/json" },
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
}

async function createOrder() {
  const response = await request("POST", "/api/orders", orderDetails);
  assert.equal(response.status, 201);
  return (await response.json()).order;
}

test("creates an order and retrieves its saved details", async () => {
  const response = await request("POST", "/api/orders", {
    ...orderDetails,
    client: "  Test client  ",
    project: "  Website update  ",
  });
  assert.equal(response.status, 201);
  const { order } = await response.json();
  assert.match(order.id, /^OF-\d+$/);
  assert.deepEqual(order, { ...orderDetails, id: order.id, status: "New" });

  const list = await request("GET", "/api/orders");
  assert.equal(list.status, 200);
  assert.deepEqual((await list.json()).orders, [order]);

  const stored = await database
    .prepare("SELECT value_cents FROM orders")
    .first();
  assert.equal(stored.value_cents, 12345);
});

test("updates the saved details and workflow status of an order", async () => {
  const order = await createOrder();
  const changes = {
    client: "Updated client",
    project: "Revised website",
    due: "2026-12-15",
    value: 250.99,
    status: "Review",
  };

  const response = await request("PATCH", `/api/orders/${order.id}`, changes);
  assert.equal(response.status, 200);
  const updated = (await response.json()).order;
  assert.deepEqual(updated, { ...changes, id: order.id });

  const list = await request("GET", "/api/orders");
  assert.deepEqual((await list.json()).orders, [updated]);
});

test("deletes an order and reports a second deletion as missing", async () => {
  const order = await createOrder();
  const response = await request("DELETE", `/api/orders/${order.id}`);
  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");

  const list = await request("GET", "/api/orders");
  assert.deepEqual((await list.json()).orders, []);
  const repeat = await request("DELETE", `/api/orders/${order.id}`);
  assert.equal(repeat.status, 404);
});

test("rejects incomplete or invalid orders without saving them", async () => {
  const invalidDetails = [
    { client: " " },
    { project: " " },
    { due: "01/12/2026" },
    { value: 0 },
    { value: -10 },
    { value: "123.45" },
  ];

  for (const changes of invalidDetails) {
    const response = await request("POST", "/api/orders", {
      ...orderDetails,
      ...changes,
    });
    assert.equal(response.status, 400, JSON.stringify(changes));
    assert.equal(typeof (await response.json()).error, "string");
  }

  const list = await request("GET", "/api/orders");
  assert.deepEqual((await list.json()).orders, []);
});

test("rejects an invalid status and preserves the previous order", async () => {
  const order = await createOrder();
  const response = await request("PATCH", `/api/orders/${order.id}`, {
    ...orderDetails,
    status: "Unknown",
  });
  assert.equal(response.status, 400);

  const list = await request("GET", "/api/orders");
  assert.deepEqual((await list.json()).orders, [order]);
});

test("returns 404 when updating or deleting an unknown order ID", async () => {
  for (const id of ["invalid", "OF-1044", "OF-999999"]) {
    const update = await request("PATCH", `/api/orders/${id}`, {
      ...orderDetails,
      status: "Ready",
    });
    assert.equal(update.status, 404);

    const remove = await request("DELETE", `/api/orders/${id}`);
    assert.equal(remove.status, 404);
  }
});
