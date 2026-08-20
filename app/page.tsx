"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { copy, flowStages, statuses, type Language, type OrderStatus, type StatusFilter } from "./copy";

type Order = { id: string; client: string; project: string; due: string; value: number; status: OrderStatus };

function formatDueDate(value: string, language: Language) {
  return new Date(`${value}T12:00:00`).toLocaleDateString(language === "de" ? "de-DE" : "en-GB", { day: "2-digit", month: "short" });
}

export default function Home() {
  const [language, setLanguage] = useState<Language>("en");
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeStatus, setActiveStatus] = useState<StatusFilter>("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [formError, setFormError] = useState("");
  const [apiStatus, setApiStatus] = useState<"loading" | "ready" | "saving" | "error">("loading");
  const [apiError, setApiError] = useState("");
  const t = copy[language];

  const todayLabel = useMemo(() => new Intl.DateTimeFormat(language === "de" ? "de-DE" : "en-GB", {
    weekday: "long", day: "2-digit", month: "long", year: "numeric",
  }).format(new Date()), [language]);

  const visibleOrders = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase();
    return orders.filter((order) => {
      const matchesStatus = activeStatus === "All" || order.status === activeStatus;
      const matchesSearch = !normalizedQuery || [order.id, order.client, order.project].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
      return matchesStatus && matchesSearch;
    });
  }, [activeStatus, orders, searchQuery]);
  const totalValue = orders.reduce((sum, order) => sum + order.value, 0);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    const controller = new AbortController();
    async function loadOrders() {
      try {
        const response = await fetch("/api/orders", { signal: controller.signal });
        const payload = (await response.json()) as { orders?: Order[]; error?: string };
        if (!response.ok || !payload.orders) throw new Error(t.errors.load);
        setOrders(payload.orders);
        setApiError("");
        setApiStatus("ready");
      } catch (error) {
        if (controller.signal.aborted) return;
        setApiError(error instanceof Error ? error.message : t.errors.load);
        setApiStatus("error");
      }
    }
    void loadOrders();
    return () => controller.abort();
  }, [t.errors.load]);

  async function createOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const client = String(data.get("client") ?? "").trim();
    const project = String(data.get("project") ?? "").trim();
    const due = String(data.get("due") ?? "");
    const value = Number(data.get("value"));
    if (!client || !project || !due || !Number.isFinite(value) || value <= 0) {
      setFormError(t.errors.createFields);
      return;
    }

    setApiStatus("saving");
    try {
      const response = await fetch("/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ client, project, due, value }) });
      const payload = (await response.json()) as { order?: Order; error?: string };
      if (!response.ok || !payload.order) throw new Error(t.errors.create);
      setOrders((currentOrders) => [payload.order!, ...currentOrders]);
      setActiveStatus("All");
      setFormError(""); setApiError(""); setApiStatus("ready"); setIsCreateOpen(false);
      form.reset();
    } catch (error) {
      const message = error instanceof Error ? error.message : t.errors.create;
      setFormError(message); setApiError(message); setApiStatus("error");
    }
  }

  async function updateSelectedOrder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrder) return;
    const data = new FormData(event.currentTarget);
    const client = String(data.get("client") ?? "").trim();
    const project = String(data.get("project") ?? "").trim();
    const due = String(data.get("due") ?? "");
    const value = Number(data.get("value"));
    const status = String(data.get("status") ?? "") as OrderStatus;
    if (!client || !project || !due || !Number.isFinite(value) || value <= 0 || !flowStages.includes(status)) {
      setFormError(t.errors.updateFields);
      return;
    }

    setApiStatus("saving");
    try {
      const response = await fetch(`/api/orders/${selectedOrder.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ client, project, due, value, status }) });
      const payload = (await response.json()) as { order?: Order; error?: string };
      if (!response.ok || !payload.order) throw new Error(t.errors.update);
      setOrders((currentOrders) => currentOrders.map((order) => order.id === payload.order!.id ? payload.order! : order));
      setSelectedOrder(null); setFormError(""); setApiError(""); setApiStatus("ready");
    } catch (error) {
      const message = error instanceof Error ? error.message : t.errors.update;
      setFormError(message); setApiError(message); setApiStatus("error");
    }
  }

  async function removeSelectedOrder() {
    if (!selectedOrder || !window.confirm(t.confirmDelete(selectedOrder.id, selectedOrder.client))) return;
    setApiStatus("saving");
    try {
      const response = await fetch(`/api/orders/${selectedOrder.id}`, { method: "DELETE" });
      if (!response.ok) {
        throw new Error(t.errors.remove);
      }
      setOrders((currentOrders) => currentOrders.filter((order) => order.id !== selectedOrder.id));
      setSelectedOrder(null); setFormError(""); setApiError(""); setApiStatus("ready");
    } catch (error) {
      const message = error instanceof Error ? error.message : t.errors.remove;
      setFormError(message); setApiError(message); setApiStatus("error");
    }
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label={t.homeLabel}><span>KLAR</span><span>LAUF</span></a>
        <p className="systemLabel">{t.systemLabel}</p>
        <div className="topbarMeta">
          <button className="languageSwitch" onClick={() => setLanguage((current) => current === "en" ? "de" : "en")} type="button" aria-label={t.languageButtonLabel}>{t.languageButton}</button>
          <span className="databaseState"><span className={`liveDot${apiStatus === "error" ? " liveDot--error" : ""}`} />{t.database[apiStatus]}</span>
        </div>
      </header>

      <section className="workspace" id="top">
        <div className="workspaceHeader">
          <div><p className="eyebrow">{todayLabel}</p><h1>{t.ordersTitle}</h1></div>
          <div className="workspaceActions">
            <div className="headerMetric"><span>{t.active}</span><strong>{orders.length}</strong></div>
            <div className="headerMetric"><span>{t.pipeline}</span><strong>€{totalValue.toLocaleString(language === "de" ? "de-DE" : "en-GB")}</strong></div>
            <button className="addOrder" onClick={() => setIsCreateOpen(true)} type="button"><span>+</span> {t.createNew}</button>
          </div>
        </div>

        <div className="flowRoute" aria-label={t.stagesLabel}>
          {flowStages.map((stage, index) => {
            const count = orders.filter((order) => order.status === stage).length;
            return <div className="flowStage" key={stage}><span>0{index + 1}</span><strong>{t.status[stage]}</strong><small>{count} {count === 1 ? t.order : t.orders}</small></div>;
          })}
        </div>

        <section className="workboard" aria-labelledby="queue-title">
          <div className="boardHeader">
            <div><p className="eyebrow">{t.liveQueue}</p><h2 id="queue-title">{t.queueTitle}</h2></div>
            <div className="boardTools">
              <label className="orderSearch"><span>{t.searchLabel}</span><input onChange={(event) => setSearchQuery(event.target.value)} placeholder={t.searchPlaceholder} type="search" value={searchQuery} /></label>
              <div className="filters" aria-label={t.filtersLabel}>{statuses.map((status) => <button className={activeStatus === status ? "active" : ""} key={status} onClick={() => setActiveStatus(status)} type="button">{t.status[status]} <span>{status === "All" ? orders.length : orders.filter((order) => order.status === status).length}</span></button>)}</div>
            </div>
          </div>

          {apiStatus === "loading" && <p className="queueMessage">{t.loadingOrders}</p>}
          {apiStatus === "error" && <p className="queueMessage queueMessage--error" role="alert">{apiError}</p>}
          {apiStatus !== "loading" && visibleOrders.length === 0 && <p className="queueMessage">{searchQuery ? t.noResults(searchQuery) : t.noOrders}</p>}
          <div className="ticketGrid">
            {visibleOrders.map((order) => (
              <article className={`ticket ticket--${order.status.toLowerCase().replace(" ", "-")}`} key={order.id}>
                <div className="ticketTop"><span>{order.id}</span><div className="status"><i />{t.status[order.status]}</div></div>
                <div className="ticketIdentity"><p>{t.clientOrder}</p><h3>{order.client}</h3><span>{order.project}</span></div>
                <div className="ticketMeta"><div><span>{t.dueDate}</span><strong>{formatDueDate(order.due, language)}</strong></div><div><span>{t.orderValue}</span><strong>€{order.value.toLocaleString(language === "de" ? "de-DE" : "en-GB")}</strong></div></div>
                <div className="ticketRoute" aria-label={`${t.status[order.status]} ${t.progress}`}>{flowStages.map((stage, index) => <i className={index <= flowStages.indexOf(order.status) ? "passed" : ""} key={stage} />)}</div>
                <button className="orderOpen" onClick={() => { setFormError(""); setSelectedOrder(order); }} type="button" aria-label={`${t.openOrder} ${order.id}`}>{t.openOrder} <span>↗</span></button>
              </article>
            ))}
          </div>
        </section>
      </section>

      {isCreateOpen && (
        <div className="modalBackdrop">
          <button aria-label={t.closeCreate} className="modalDismiss" onClick={() => setIsCreateOpen(false)} type="button" />
          <section aria-labelledby="create-order-title" aria-modal="true" className="orderModal" role="dialog">
            <div className="modalHeader"><div><p className="eyebrow">{t.newEntry}</p><h2 id="create-order-title">{t.createOrder}</h2></div><button aria-label={t.closeForm} className="modalClose" onClick={() => setIsCreateOpen(false)} type="button">×</button></div>
            <form className="orderForm" onSubmit={createOrder}>
              <label>{t.client}<input name="client" placeholder={t.clientPlaceholder} type="text" /></label>
              <label>{t.project}<input name="project" placeholder={t.projectPlaceholder} type="text" /></label>
              <div className="formRow"><label>{t.dueDate}<input name="due" type="date" /></label><label>{t.orderValue} (€)<input min="1" name="value" placeholder="1500" step="1" type="number" /></label></div>
              {formError && <p className="formError" role="alert">{formError}</p>}
              <div className="formActions"><button className="cancelButton" onClick={() => setIsCreateOpen(false)} type="button">{t.cancel}</button><button className="submitOrder" disabled={apiStatus === "saving"} type="submit">{apiStatus === "saving" ? t.saving : t.addToQueue}</button></div>
            </form>
          </section>
        </div>
      )}

      {selectedOrder && (
        <div className="modalBackdrop">
          <button aria-label={t.closeEdit} className="modalDismiss" onClick={() => setSelectedOrder(null)} type="button" />
          <section aria-labelledby="edit-order-title" aria-modal="true" className="orderModal" role="dialog">
            <div className="modalHeader"><div><p className="eyebrow">{selectedOrder.id}</p><h2 id="edit-order-title">{t.editOrder}</h2></div><button aria-label={t.closeForm} className="modalClose" onClick={() => setSelectedOrder(null)} type="button">×</button></div>
            <form className="orderForm" onSubmit={updateSelectedOrder}>
              <label>{t.client}<input defaultValue={selectedOrder.client} name="client" type="text" /></label>
              <label>{t.project}<input defaultValue={selectedOrder.project} name="project" type="text" /></label>
              <div className="formRow"><label>{t.dueDate}<input defaultValue={selectedOrder.due} name="due" type="date" /></label><label>{t.orderValue} (€)<input defaultValue={selectedOrder.value} min="1" name="value" step="1" type="number" /></label></div>
              <label>{t.statusLabel}<select defaultValue={selectedOrder.status} name="status">{flowStages.map((status) => <option key={status} value={status}>{t.status[status]}</option>)}</select></label>
              {formError && <p className="formError" role="alert">{formError}</p>}
              <div className="formActions formActions--edit"><button className="deleteButton" disabled={apiStatus === "saving"} onClick={removeSelectedOrder} type="button">{t.deleteOrder}</button><button className="submitOrder" disabled={apiStatus === "saving"} type="submit">{apiStatus === "saving" ? t.saving : t.saveChanges}</button></div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}
