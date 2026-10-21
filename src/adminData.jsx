import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import { BrandMark } from "./Brand.jsx";
import "./admin.css";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

export function AdminDataPage({ section }) {
  const { session, customer, api } = useAuth();
  const [rows, setRows] = useState([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!session) return;
    const url = section === "customers" ? `/admin/customers${query.trim() ? `?query=${encodeURIComponent(query.trim())}` : ""}` : "/admin/payments";
    setLoading(true);
    api(url).then(setRows).catch((reason) => setError(reason.message || "Admin report could not be loaded.")).finally(() => setLoading(false));
  }, [session, api, section, query]);
  if (!session) return <Navigate to={`/login?next=%2Fadmin%2F${section}`} replace />;
  if (customer?.role !== "admin") return <Navigate to="/catalog" replace />;
  const payments = section === "payments";
  return <div className="admin-page"><header className="admin-header"><BrandMark /><nav><Link to="/admin/orders">Orders</Link><Link to="/admin/catalog">Products</Link><Link to="/admin/customers">Customers</Link><Link to="/admin/payments">Payments</Link><Link to="/admin/support">Support</Link><Link to="/catalog">Customer site</Link></nav><span className="admin-access-label">STAFF CONSOLE</span></header><main className="admin-main"><div className="admin-heading"><div><span className="admin-kicker">ADMINISTRATION</span><h1>{payments ? "Payments" : "Customers"}</h1><p>{payments ? "Saved order payment states and provider references." : "Customer accounts and their saved order counts."}</p></div></div>{!payments && <label className="admin-report-search">Search customers<input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name, email, or phone" /></label>}{error && <p className="admin-message admin-message--error" role="alert">{error}</p>}{loading ? <div className="admin-loading" aria-label="Loading report" /> : rows.length === 0 ? <section className="admin-panel admin-empty"><strong>No records found.</strong></section> : <div className="admin-report-list">{payments ? rows.map((row) => <article className="admin-panel" key={row.order_number}><div className="report-line"><strong>{row.order_number}</strong><span>{row.payment_method.toUpperCase()} · {row.payment_status.replaceAll("_", " ")}</span><b>{money.format(Number(row.amount))}</b></div><p>{row.customer_name} · {row.customer_email}</p><small>Order: {row.order_status.replaceAll("_", " ")} · Razorpay order: {row.provider_order_id || "—"} · Payment: {row.provider_payment_id || "—"}{row.attempt_status ? ` · Attempt: ${row.attempt_status}` : ""}</small></article>) : rows.map((row) => <article className="admin-panel report-line" key={row.id}><div><strong>{row.full_name}</strong><p>{row.email} · {row.phone}</p></div><span>{row.order_count} orders</span><small>Joined {new Date(row.created_at).toLocaleDateString()}</small></article>)}</div>}</main></div>;
}
