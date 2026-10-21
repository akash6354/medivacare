import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import { apiBlob } from "./api.js";
import { BrandMark } from "./Brand.jsx";
import "./admin.css";
import "./prescriptions.css";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const transitions = {
  placed: ["confirmed", "cancelled"],
  confirmed: ["processing", "cancelled"],
  processing: ["shipped", "cancelled"],
  shipped: ["out_for_delivery", "returned"],
  out_for_delivery: ["delivered", "returned"],
  delivered: ["returned"],
};

function title(value) {
  return value.replaceAll("_", " ");
}

function AdminFrame({ children }) {
  const { customer } = useAuth();
  return (
    <div className="admin-page">
      <header className="admin-header">
        <BrandMark />
        <nav aria-label="Administration">{customer?.role === "admin" && <><Link to="/admin/orders">Orders</Link><Link to="/admin/catalog">Products</Link><Link to="/admin/customers">Customers</Link><Link to="/admin/payments">Payments</Link></>}{["admin", "pharmacist"].includes(customer?.role) && <Link to="/admin/prescriptions">Prescription review</Link>}{["admin", "support"].includes(customer?.role) && <Link to="/admin/support">Support inbox</Link>}<Link to="/catalog">Customer site</Link></nav>
        <span className="admin-access-label">STAFF CONSOLE</span>
      </header>
      <main className="admin-main">{children}</main>
      <footer className="admin-footer">Prescription documents are restricted to the customer and authorized pharmacy staff.</footer>
    </div>
  );
}

function Message({ children, error = false }) {
  return children ? <p className={`admin-message${error ? " admin-message--error" : ""}`} role={error ? "alert" : "status"}>{children}</p> : null;
}

function OrderControls({ order, api, onUpdated }) {
  const rawChoices = transitions[order.status] ?? [];
  const choices = order.delivery ? rawChoices.filter((choice) => !["shipped", "out_for_delivery", "delivered", "returned"].includes(choice)) : rawChoices;
  const [nextStatus, setNextStatus] = useState(choices[0] ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => setNextStatus(choices[0] ?? ""), [order.status, order.delivery?.status]);

  async function updateStatus(event) {
    event.preventDefault();
    if (!nextStatus) return;
    setBusy(true);
    setError("");
    try {
      const updated = await api(`/admin/orders/${encodeURIComponent(order.order_number)}/status`, { method: "PATCH", body: { status: nextStatus } });
      onUpdated(updated);
    } catch (reason) {
      setError(reason.message || "The order status could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  async function recordCollection() {
    setBusy(true);
    setError("");
    try {
      const updated = await api(`/admin/orders/${encodeURIComponent(order.order_number)}/cod-payment/collect`, { method: "POST" });
      onUpdated(updated);
    } catch (reason) {
      setError(reason.message || "Cash collection could not be recorded.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-panel admin-order-actions" aria-label="Order actions">
      <span className="admin-kicker">FULFILLMENT ACTIONS</span>
      <h2>Update this order</h2>
      {choices.length > 0 ? (
        <form className="admin-status-form" onSubmit={updateStatus}>
          <label htmlFor="next-order-status">Move to</label>
          <select id="next-order-status" value={nextStatus} onChange={(event) => setNextStatus(event.target.value)}>
            {choices.map((choice) => <option key={choice} value={choice}>{title(choice)}</option>)}
          </select>
          <button type="submit" disabled={busy}>{busy ? "Saving…" : "Save status"}</button>
        </form>
      ) : <p className="admin-muted">This order has no further fulfillment transitions.</p>}
      {order.payment_method === "cod" && order.status === "delivered" && order.payment_status === "pending" && (
        <button className="admin-collect-button" type="button" disabled={busy} onClick={recordCollection}>{busy ? "Saving…" : `Record ${money.format(Number(order.total))} cash collected`}</button>
      )}
      <Message error>{error}</Message>
      <p className="admin-muted">Payment status changes only after verified online confirmation or recorded COD collection.</p>
    </section>
  );
}

function DeliveryControls({ order, api, onUpdated }) {
  const [carrier, setCarrier] = useState("");
  const [courier, setCourier] = useState("");
  const [phone, setPhone] = useState("");
  const [next, setNext] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const delivery = order.delivery;
  const nextChoices = { assigned: ["picked_up"], picked_up: ["in_transit"], in_transit: ["out_for_delivery", "failed", "returned"], out_for_delivery: ["delivered", "failed", "returned"], failed: ["out_for_delivery", "returned"] }[delivery?.status] ?? [];
  async function refreshOrder() {
    const updated = await api(`/admin/orders/${encodeURIComponent(order.order_number)}`);
    onUpdated(updated);
  }
  async function assign(event) {
    event.preventDefault(); setBusy(true); setError("");
    try { await api(`/admin/orders/${encodeURIComponent(order.order_number)}/delivery`, { method: "POST", body: { carrier_name: carrier, courier_name: courier, courier_phone: phone } }); await refreshOrder(); }
    catch (reason) { setError(reason.message || "Delivery could not be assigned."); } finally { setBusy(false); }
  }
  async function update(event) {
    event.preventDefault(); setBusy(true); setError("");
    try { await api(`/admin/orders/${encodeURIComponent(order.order_number)}/delivery/status`, { method: "PATCH", body: { status: next, note: note || null } }); await refreshOrder(); setNote(""); }
    catch (reason) { setError(reason.message || "Tracking could not be updated."); } finally { setBusy(false); }
  }
  return <section className="admin-panel"><span className="admin-kicker">DELIVERY TRACKING</span><h2>{delivery ? `${delivery.carrier_name} · ${title(delivery.status)}` : "Assign a courier"}</h2>
    {!delivery && order.status === "processing" ? <form className="delivery-form" onSubmit={assign}><label>Carrier<input required minLength="2" maxLength="100" value={carrier} onChange={(e) => setCarrier(e.target.value)} /></label><label>Courier name<input required minLength="2" maxLength="120" value={courier} onChange={(e) => setCourier(e.target.value)} /></label><label>Courier phone<input required type="tel" pattern="\+?[1-9][0-9]{7,14}" value={phone} onChange={(e) => setPhone(e.target.value)} /></label><button disabled={busy}>{busy ? "Saving…" : "Assign delivery"}</button></form> : null}
    {delivery && <><p className="admin-muted">Tracking code: <strong>{delivery.tracking_number}</strong> · {delivery.courier_name}</p><ol className="delivery-events">{delivery.events.map((event) => <li key={event.id}><strong>{title(event.status)}</strong><span>{new Date(event.created_at).toLocaleString()}</span>{event.note && <small>{event.note}</small>}</li>)}</ol>{nextChoices.length > 0 && <form className="delivery-form" onSubmit={update}><label>Update status<select required value={next} onChange={(e) => setNext(e.target.value)}><option value="">Choose status</option>{nextChoices.map((status) => <option key={status} value={status}>{title(status)}</option>)}</select></label><label>Update note<input maxLength="300" value={note} onChange={(e) => setNote(e.target.value)} /></label><button disabled={busy || !next}>{busy ? "Saving…" : "Save tracking update"}</button></form>}</>}
    <Message error>{error}</Message>
  </section>;
}

function AdminOrderDetail({ order, api, onUpdated }) {
  const [history, setHistory] = useState([]);
  const [historyError, setHistoryError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    api(`/admin/orders/${encodeURIComponent(order.order_number)}/history`, { signal: controller.signal })
      .then(setHistory)
      .catch((reason) => { if (reason.name !== "AbortError") setHistoryError(reason.message || "Order history could not be loaded."); });
    return () => controller.abort();
  }, [api, order.order_number, order.status, order.payment_status]);

  return (
    <>
      <div className="admin-detail-heading"><div><span className="admin-kicker">ORDER DETAIL · {order.order_number}</span><h1>{order.customer_name}</h1><p>{order.customer_email} · {order.customer_phone}</p></div><span className={`admin-status admin-status--${order.status}`}>{title(order.status)}</span></div>
      <div className="admin-detail-grid">
        <section className="admin-panel admin-lines">
          <div className="admin-panel-heading"><div><span className="admin-kicker">ORDER ITEMS</span><h2>Items and totals</h2></div><span>{new Date(order.created_at).toLocaleString()}</span></div>
          {order.items.map((item) => <div className="admin-line" key={item.id ?? item.product_sku}><div><strong>{item.product_name}</strong><span>{item.dosage_form} · {item.pack_quantity} {item.pack_unit} × {item.quantity}</span></div><b>{money.format(Number(item.line_total))}</b></div>)}
          <dl className="admin-totals"><div><dt>Subtotal</dt><dd>{money.format(Number(order.subtotal))}</dd></div><div><dt>Discount</dt><dd>−{money.format(Number(order.discount))}</dd></div><div><dt>Delivery</dt><dd>{money.format(Number(order.delivery_fee))}</dd></div><div className="admin-total"><dt>Total</dt><dd>{money.format(Number(order.total))}</dd></div></dl>
        </section>
        <section className="admin-panel">
          <span className="admin-kicker">DELIVERY AND PAYMENT</span><h2>Customer and delivery</h2>
          <address>{order.recipient_name}<br />{order.recipient_phone}<br />{order.address_line1}{order.address_line2 ? `, ${order.address_line2}` : ""}<br />{order.city}, {order.state} {order.postal_code}</address>
          <dl className="admin-facts"><div><dt>Payment</dt><dd>{title(order.payment_method)} · {title(order.payment_status)}</dd></div>{order.razorpay_order_id && <div><dt>Razorpay order</dt><dd>{order.razorpay_order_id}</dd></div>}{order.razorpay_payment_id && <div><dt>Razorpay payment</dt><dd>{order.razorpay_payment_id}</dd></div>}</dl>
        </section>
      </div>
      <div className="admin-detail-grid admin-detail-grid--lower">
        <OrderControls key={`${order.order_number}-${order.status}-${order.payment_status}`} order={order} api={api} onUpdated={onUpdated} />
        <DeliveryControls order={order} api={api} onUpdated={onUpdated} />
        <section className="admin-panel"><span className="admin-kicker">AUDIT HISTORY</span><h2>Staff actions</h2><Message error>{historyError}</Message>{history.length === 0 && !historyError ? <p className="admin-muted">No staff actions have been recorded yet.</p> : <ol className="admin-history">{history.map((entry) => <li key={entry.id}><strong>{title(entry.action)}</strong><span>{entry.actor_name} · {new Date(entry.created_at).toLocaleString()}</span><small>{Object.entries(entry.details).map(([key, value]) => `${title(key)}: ${title(value)}`).join(" · ")}</small></li>)}</ol>}</section>
      </div>
    </>
  );
}

export function AdminOrdersPage() {
  const { session, api } = useAuth();
  const { orderNumber } = useParams();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState(null);
  const [orders, setOrders] = useState([]);
  const [order, setOrder] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const queryString = useMemo(() => {
    const params = new URLSearchParams({ page: String(page), page_size: "20" });
    if (status) params.set("status", status);
    if (search) params.set("query", search);
    return params.toString();
  }, [page, status, search]);

  useEffect(() => {
    if (!session || session.customer.role !== "admin") return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    const load = orderNumber
      ? api(`/admin/orders/${encodeURIComponent(orderNumber)}`, { signal: controller.signal }).then(setOrder)
      : Promise.all([
        api(`/admin/dashboard`, { signal: controller.signal }).then(setDashboard),
        api(`/admin/orders?${queryString}`, { signal: controller.signal }).then((result) => { setOrders(result.items); setTotal(result.total); }),
      ]).then(() => setOrder(null));
    load.catch((reason) => { if (reason.name !== "AbortError") setError(reason.message || "The administrator order data could not be loaded."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [session, api, orderNumber, queryString]);

  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(orderNumber ? `/admin/orders/${orderNumber}` : "/admin/orders")}`} replace />;
  if (session.customer.role !== "admin") return <AdminFrame><section className="admin-panel admin-denied"><span className="admin-kicker">RESTRICTED AREA</span><h1>Administrator access required</h1><p>Your account cannot view customer order records.</p><Link to="/account">Return to your account</Link></section></AdminFrame>;

  function updatedOrder(updated) {
    setOrder(updated);
    setOrders((current) => current.map((item) => item.order_number === updated.order_number ? updated : item));
  }

  function searchOrders(event) {
    event.preventDefault();
    setPage(1);
    setSearch(searchText.trim());
  }

  return (
    <AdminFrame>
      {orderNumber ? <div className="admin-back-row"><button type="button" onClick={() => navigate("/admin/orders")}>← All orders</button></div> : (
        <>
          <div className="admin-heading"><div><span className="admin-kicker">OPERATIONS</span><h1>Order management</h1><p>Find customer orders and manage their fulfillment state.</p></div><span className="admin-role-badge">Protected administrator view</span></div>
          <div className="admin-metrics" aria-label="Order summary"><div><span>Total orders</span><strong>{dashboard?.total_orders ?? "—"}</strong></div><div><span>Active orders</span><strong>{dashboard?.active_orders ?? "—"}</strong></div><div><span>Awaiting payment</span><strong>{dashboard?.awaiting_payment ?? "—"}</strong></div><div><span>Captured sales</span><strong>{dashboard ? money.format(Number(dashboard.captured_sales)) : "—"}</strong></div></div>
          <form className="admin-filters" onSubmit={searchOrders}><label htmlFor="admin-order-search">Search orders<input id="admin-order-search" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Order number, customer name, email or phone" /></label><label htmlFor="admin-order-status">Status<select id="admin-order-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}><option value="">All statuses</option>{["pending_payment", "placed", "awaiting_prescription_review", "confirmed", "processing", "shipped", "out_for_delivery", "delivered", "cancelled", "returned"].map((value) => <option key={value} value={value}>{title(value)}</option>)}</select></label><button type="submit">Search</button></form>
        </>
      )}
      <Message error>{error}</Message>
      {loading ? <div className="admin-loading" aria-label="Loading orders" /> : error ? null : orderNumber ? order ? <AdminOrderDetail key={order.id} order={order} api={api} onUpdated={updatedOrder} /> : <p className="admin-muted">Order not found.</p> : orders.length === 0 ? <section className="admin-panel admin-empty"><strong>No orders match those filters.</strong><span>New customer orders will appear here after checkout.</span></section> : (
        <>
          <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Order</th><th>Customer</th><th>Placed</th><th>Payment</th><th>Order status</th><th>Total</th></tr></thead><tbody>{orders.map((item) => <tr key={item.id}><td><Link to={`/admin/orders/${encodeURIComponent(item.order_number)}`}>{item.order_number}</Link></td><td><strong>{item.customer_name}</strong><span>{item.customer_email}</span><small>{item.customer_phone}</small></td><td>{new Date(item.created_at).toLocaleDateString()}</td><td>{title(item.payment_method)}<small>{title(item.payment_status)}</small></td><td><span className={`admin-status admin-status--${item.status}`}>{title(item.status)}</span></td><td>{money.format(Number(item.total))}</td></tr>)}</tbody></table></div>
          <div className="admin-pagination"><span>{total} orders · page {page}</span><div><button type="button" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button><button type="button" disabled={page * 20 >= total} onClick={() => setPage((value) => value + 1)}>Next</button></div></div>
        </>
      )}
    </AdminFrame>
  );
}

export function AdminPrescriptionPage() {
  const { session, api } = useAuth();
  const [status, setStatus] = useState("pending");
  const [items, setItems] = useState([]);
  const [notes, setNotes] = useState({});
  const [history, setHistory] = useState({});
  const [busyId, setBusyId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!session || !["admin", "pharmacist"].includes(session.customer.role)) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api(`/admin/prescriptions?status=${status}`, { signal: controller.signal })
      .then((page) => setItems(page.items))
      .catch((reason) => { if (reason.name !== "AbortError") setError(reason.message || "Prescription submissions could not be loaded."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [session, api, status]);

  if (!session) return <Navigate to={`/login?next=${encodeURIComponent("/admin/prescriptions")}`} replace />;
  if (!["admin", "pharmacist"].includes(session.customer.role)) return <AdminFrame><section className="admin-panel admin-denied"><span className="admin-kicker">RESTRICTED AREA</span><h1>Pharmacy staff access required</h1><p>Your account cannot review prescription documents.</p><Link to="/account">Return to your account</Link></section></AdminFrame>;

  async function downloadDocument(item) {
    setError("");
    try {
      const blob = await apiBlob(`/prescriptions/${item.id}/file`, { token: session.accessToken });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `prescription-${item.id}.${item.media_type === "application/pdf" ? "pdf" : item.media_type === "image/png" ? "png" : "jpg"}`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (reason) {
      setError(reason.message || "Prescription file could not be downloaded.");
    }
  }

  async function review(item, nextStatus) {
    setBusyId(item.id);
    setError("");
    setMessage("");
    try {
      const updated = await api(`/admin/prescriptions/${item.id}/review`, {
        method: "PATCH",
        body: { status: nextStatus, note: notes[item.id] ?? "" },
      });
      setItems((current) => status === "all" || updated.status === status
        ? current.map((entry) => entry.id === item.id ? updated : entry)
        : current.filter((entry) => entry.id !== item.id));
      setMessage(`Prescription ${nextStatus}.`);
      setNotes((current) => ({ ...current, [item.id]: "" }));
    } catch (reason) {
      setError(reason.message || "Prescription review could not be saved.");
    } finally {
      setBusyId("");
    }
  }

  async function toggleHistory(item) {
    if (history[item.id]) {
      setHistory((current) => ({ ...current, [item.id]: null }));
      return;
    }
    try {
      const rows = await api(`/admin/prescriptions/${item.id}/history`);
      setHistory((current) => ({ ...current, [item.id]: rows }));
    } catch (reason) {
      setError(reason.message || "Review history could not be loaded.");
    }
  }

  return (
    <AdminFrame>
      <div className="admin-heading"><div><span className="admin-kicker">PHARMACY OPERATIONS</span><h1>Prescription review</h1><p>Review private prescription documents submitted for synthetic catalog listings.</p></div><span className="admin-role-badge">Restricted staff access</span></div>
      <div className="admin-filters admin-prescription-filters"><label htmlFor="prescription-status-filter">Show submissions<select id="prescription-status-filter" value={status} onChange={(event) => setStatus(event.target.value)}><option value="pending">Awaiting review</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="all">All submissions</option></select></label></div>
      <Message error>{error}</Message><Message>{message}</Message>
      {loading ? <div className="admin-loading" aria-label="Loading prescription submissions" /> : error ? null : items.length === 0 ? <section className="admin-panel admin-empty"><strong>No submissions in this view.</strong><span>New customer uploads will appear here.</span></section> : <div className="prescription-review-list">
        {items.map((item) => <article className="admin-panel prescription-review-card" key={item.id}>
          <div className="prescription-review-heading"><div><span className="admin-kicker">{item.product_name}</span><h2>{item.customer_name}</h2><p>{item.customer_email} · {item.customer_phone}</p></div><span className={`prescription-status prescription-status--${item.status}`}>{item.status}</span></div>
          <dl className="admin-facts"><div><dt>Submitted</dt><dd>{new Date(item.created_at).toLocaleString()}</dd></div><div><dt>File</dt><dd>{item.media_type} · {(item.file_size / 1024).toFixed(0)} KB</dd></div>{item.review_note && <div><dt>Review note</dt><dd>{item.review_note}</dd></div>}</dl>
          <div className="prescription-review-actions"><button type="button" onClick={() => downloadDocument(item)}>Download private document</button><button type="button" onClick={() => toggleHistory(item)}>{history[item.id] ? "Hide review history" : "Review history"}</button></div>
          {history[item.id] && <ol className="admin-history prescription-audit-history">{history[item.id].length === 0 ? <li><span>No review actions recorded.</span></li> : history[item.id].map((entry) => <li key={entry.id}><strong>{entry.previous_status} → {entry.status}</strong><span>{entry.reviewer_name} · {new Date(entry.created_at).toLocaleString()}</span>{entry.note && <small>{entry.note}</small>}</li>)}</ol>}
          {item.status === "pending" && <div className="prescription-decision"><label htmlFor={`review-note-${item.id}`}>Review note <textarea id={`review-note-${item.id}`} maxLength={500} value={notes[item.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [item.id]: event.target.value }))} placeholder="Required when rejecting" /></label><div><button type="button" disabled={busyId === item.id} onClick={() => review(item, "approved")}>{busyId === item.id ? "Saving…" : "Approve"}</button><button className="prescription-reject-button" type="button" disabled={busyId === item.id || !(notes[item.id] ?? "").trim()} onClick={() => review(item, "rejected")}>Reject</button></div></div>}
        </article>)}
      </div>}
    </AdminFrame>
  );
}
