"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

type OrderStatus = "New" | "In progress" | "Review" | "Ready";

type Order = {
  id: string;
  client: string;
  project: string;
  due: string;
  value: number;
  status: OrderStatus;
};

const statuses: Array<"All" | OrderStatus> = ["All", "New", "In progress", "Review", "Ready"];
const flowStages: OrderStatus[] = ["New", "In progress", "Review", "Ready"];

function formatDueDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

export default function Home() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeStatus, setActiveStatus] = useState<(typeof statuses)[number]>("All");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [apiStatus, setApiStatus] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [apiError, setApiError] = useState("");
  const visibleOrders = useMemo(
    () => activeStatus === "All" ? orders : orders.filter((order) => order.status === activeStatus),
    [activeStatus, orders],
  );
  const totalValue = orders.reduce((sum, order) => sum + order.value, 0);

  useEffect(() => {
    const controller = new AbortController();
    async function loadOrders() {
      try {
        const response = await fetch("/api/orders", { signal: controller.signal });
        const payload = (await response.json()) as { orders?: Order[]; error?: string };
        if (!response.ok || !payload.orders) throw new Error(payload.error ?? "Could not load orders.");
        setOrders(payload.orders);
        setApiError("");
        setApiStatus("ready");
      } catch (error) {
        if (controller.signal.aborted) return;
        setApiError(error instanceof Error ? error.message : "Could not load orders.");
        setApiStatus("error");
      }
    }
    void loadOrders();
    return () => controller.abort();
  }, []);

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const client = String(data.get("client") ?? "").trim();
    const project = String(data.get("project") ?? "").trim();
    const due = String(data.get("due") ?? "");
    const value = Number(data.get("value"));

    if (!client || !project || !due || !Number.isFinite(value) || value <= 0) {
      setFormError("Complete every field and enter a value above €0.");
      return;
    }

    setApiStatus("saving");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ client, project, due, value }),
      });
      const payload = (await response.json()) as { order?: Order; error?: string };
      if (!response.ok || !payload.order) throw new Error(payload.error ?? "Could not create the order.");

      setOrders((currentOrders) => [payload.order!, ...currentOrders]);
      setActiveStatus("All");
      setFormError("");
      setApiError("");
      setApiStatus("ready");
      setIsCreateOpen(false);
      form.reset();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not create the order.";
      setFormError(message);
      setApiError(message);
      setApiStatus("error");
    }
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="OrderFlow home"><span>ORDER</span><span>FLOW</span></a>
        <p className="systemLabel">Studio operations / desk 01</p>
        <div className="topbarMeta">
          <span className={`liveDot${apiStatus === "error" ? " liveDot--error" : ""}`} />
          {apiStatus === "loading" ? "Loading database" : apiStatus === "saving" ? "Saving order" : apiStatus === "error" ? "Database unavailable" : "Database connected"}
        </div>
      </header>

      <section className="workspace" id="top">
        <div className="workspaceHeader">
          <div>
            <p className="eyebrow">Wednesday · 19 August 2026</p>
            <h1>Orders</h1>
          </div>
          <div className="workspaceActions">
            <div className="headerMetric">
              <span>Active</span>
              <strong>{orders.length}</strong>
            </div>
            <div className="headerMetric">
              <span>Pipeline</span>
              <strong>€{totalValue.toLocaleString("en")}</strong>
            </div>
            <button className="addOrder" onClick={() => setIsCreateOpen(true)} type="button"><span>+</span> Create new order</button>
          </div>
        </div>

        <div className="flowRoute" aria-label="Order stages">
          {flowStages.map((stage, index) => (
            <div className="flowStage" key={stage}>
              <span>0{index + 1}</span>
              <strong>{stage}</strong>
              <small>{orders.filter((order) => order.status === stage).length} order</small>
            </div>
          ))}
        </div>

        <section className="workboard" aria-labelledby="queue-title">
          <div className="boardHeader">
            <div><p className="eyebrow">Live queue</p><h2 id="queue-title">Orders in motion</h2></div>
            <div className="filters" aria-label="Filter orders by status">
              {statuses.map((status) => (
                <button
                  className={activeStatus === status ? "active" : ""}
                  key={status}
                  onClick={() => setActiveStatus(status)}
                  type="button"
                >
                  {status} <span>{status === "All" ? orders.length : orders.filter((order) => order.status === status).length}</span>
                </button>
              ))}
            </div>
          </div>

          {apiStatus === "loading" && <p className="queueMessage">Loading orders from the database…</p>}
          {apiStatus === "error" && <p className="queueMessage queueMessage--error" role="alert">{apiError}</p>}
          {apiStatus !== "loading" && visibleOrders.length === 0 && <p className="queueMessage">No orders match this view.</p>}
          <div className="ticketGrid">
            {visibleOrders.map((order) => (
              <article className={`ticket ticket--${order.status.toLowerCase().replace(" ", "-")}`} key={order.id}>
                <div className="ticketTop"><span>{order.id}</span><div className="status"><i />{order.status}</div></div>
                <div className="ticketIdentity"><p>Client order</p><h3>{order.client}</h3><span>{order.project}</span></div>
                <div className="ticketMeta"><div><span>Due date</span><strong>{formatDueDate(order.due)}</strong></div><div><span>Order value</span><strong>€{order.value.toLocaleString("en")}</strong></div></div>
                <div className="ticketRoute" aria-label={`${order.status} progress`}>
                  {flowStages.map((stage, index) => <i className={index <= flowStages.indexOf(order.status) ? "passed" : ""} key={stage} />)}
                </div>
                <button className="orderOpen" type="button" aria-label={`Open ${order.id}`}>Open order <span>↗</span></button>
              </article>
            ))}
          </div>
        </section>
      </section>

      {isCreateOpen && (
        <div className="modalBackdrop" onMouseDown={() => setIsCreateOpen(false)}>
          <section
            aria-labelledby="create-order-title"
            aria-modal="true"
            className="orderModal"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="modalHeader">
              <div>
                <p className="eyebrow">New entry</p>
                <h2 id="create-order-title">Create order</h2>
              </div>
              <button aria-label="Close form" className="modalClose" onClick={() => setIsCreateOpen(false)} type="button">×</button>
            </div>
            <form className="orderForm" onSubmit={createOrder}>
              <label>Client<input autoFocus name="client" placeholder="e.g. Nordlicht Café" type="text" /></label>
              <label>Project<input name="project" placeholder="e.g. Landing page refresh" type="text" /></label>
              <div className="formRow">
                <label>Due date<input name="due" type="date" /></label>
                <label>Order value (€)<input min="1" name="value" placeholder="1500" step="1" type="number" /></label>
              </div>
              {formError && <p className="formError" role="alert">{formError}</p>}
              <div className="formActions">
                <button className="cancelButton" onClick={() => setIsCreateOpen(false)} type="button">Cancel</button>
                <button className="submitOrder" disabled={apiStatus === "saving"} type="submit">{apiStatus === "saving" ? "Saving…" : "Add to queue"}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
