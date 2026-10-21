import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import { BrandMark } from "./Brand.jsx";
import "./admin.css";

function CatalogRow({ product, api, onUpdated }) {
  const [stock, setStock] = useState(product.stock_quantity);
  const [threshold, setThreshold] = useState(product.low_stock_threshold ?? 5);
  const [price, setPrice] = useState(product.selling_price);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function save(values) {
    setBusy(true); setError("");
    try { onUpdated(await api(`/admin/catalog/products/${product.id}`, { method: "PATCH", body: values })); }
    catch (reason) { setError(reason.message || "Product update failed."); }
    finally { setBusy(false); }
  }
  return <article className="admin-panel catalog-admin-row"><div className="catalog-admin-name"><strong>{product.name}</strong><span>{product.active_ingredients.map((item) => item.name).join(", ") || "No composition listed"} · SKU {product.sku || product.id.slice(0, 8)}</span><small>{product.category} · {product.dosage_form} · {product.manufacturer}</small></div><label>Price<input type="number" min="0.01" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} /></label><label>Stock<input type="number" min="0" value={stock} onChange={(e) => setStock(e.target.value)} /></label><label>Low stock at<input type="number" min="0" value={threshold} onChange={(e) => setThreshold(e.target.value)} /></label><button disabled={busy} onClick={() => save({ selling_price: Number(price), mrp: Number(product.mrp), stock_quantity: Number(stock), low_stock_threshold: Number(threshold) })}>{busy ? "Saving…" : "Save"}</button><button className="catalog-toggle" disabled={busy} onClick={() => save({ is_active: !product.is_active })}>{product.is_active ? "Deactivate" : "Activate"}</button>{error && <p className="simple-error" role="alert">{error}</p>}</article>;
}

export function AdminCatalogPage() {
  const { session, customer, api } = useAuth();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [form, setForm] = useState({ name: "", sku: "", category_id: "", description: "Synthetic demo product", dosage_form: "Tablet", manufacturer: "Demo manufacturer", pack_quantity: 10, pack_unit: "tablets", mrp: "", selling_price: "", stock_quantity: 0, low_stock_threshold: 5, prescription_required: false, ingredients: [] });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!session) return;
    Promise.all([api("/admin/catalog/products"), api("/catalog/categories")]).then(([rows, cats]) => { setProducts(rows); setCategories(cats); if (cats[0]) setForm((current) => ({ ...current, category_id: cats[0].id })); }).catch((reason) => setError(reason.message || "Catalog administration could not be loaded."));
  }, [session, api]);
  if (!session) return <Navigate to="/login?next=%2Fadmin%2Fcatalog" replace />;
  if (customer?.role !== "admin") return <Navigate to="/catalog" replace />;
  function edit(key, value) { setForm((current) => ({ ...current, [key]: value })); }
  async function create(event) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const created = await api("/admin/catalog/products", { method: "POST", body: { ...form, pack_quantity: Number(form.pack_quantity), mrp: Number(form.mrp), selling_price: Number(form.selling_price), stock_quantity: Number(form.stock_quantity), low_stock_threshold: Number(form.low_stock_threshold) } });
      setProducts((current) => [...current, created].sort((a, b) => a.name.localeCompare(b.name))); setNotice("Product added to the synthetic catalog."); setForm((current) => ({ ...current, name: "", sku: "", mrp: "", selling_price: "" }));
    } catch (reason) { setError(reason.message || "Product could not be added."); }
    finally { setBusy(false); }
  }
  function replace(updated) { setProducts((current) => current.map((item) => item.id === updated.id ? updated : item)); }
  return <div className="admin-page"><header className="admin-header"><BrandMark /><nav><Link to="/admin/orders">Orders</Link><Link to="/admin/catalog">Products</Link><Link to="/admin/customers">Customers</Link><Link to="/admin/payments">Payments</Link><Link to="/admin/support">Support</Link><Link to="/catalog">Customer site</Link></nav><span className="admin-access-label">STAFF CONSOLE</span></header><main className="admin-main"><div className="admin-heading"><div><span className="admin-kicker">CATALOG AND STOCK</span><h1>Product administration</h1><p>Update demo prices and stock, or add a synthetic listing.</p></div></div>{error && <p className="admin-message admin-message--error" role="alert">{error}</p>}{notice && <p className="admin-message" role="status">{notice}</p>}
    <section className="admin-panel catalog-create"><h2>Add a product</h2><form onSubmit={create}><label>Product name<input required minLength="2" maxLength="200" value={form.name} onChange={(e) => edit("name", e.target.value)} /></label><label>SKU<input required minLength="2" maxLength="80" value={form.sku} onChange={(e) => edit("sku", e.target.value)} /></label><label>Category<select required value={form.category_id} onChange={(e) => edit("category_id", e.target.value)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>MRP<input required type="number" min="0.01" step="0.01" value={form.mrp} onChange={(e) => edit("mrp", e.target.value)} /></label><label>Selling price<input required type="number" min="0.01" step="0.01" value={form.selling_price} onChange={(e) => edit("selling_price", e.target.value)} /></label><label>Initial stock<input required type="number" min="0" value={form.stock_quantity} onChange={(e) => edit("stock_quantity", e.target.value)} /></label><button disabled={busy || categories.length === 0}>{busy ? "Saving…" : "Add listing"}</button></form>{categories.length === 0 && <p>Add a category with an existing catalog product before creating listings.</p>}</section>
    <h2>Listings and inventory</h2><div className="catalog-admin-list">{products.map((product) => <CatalogRow key={product.id} product={product} api={api} onUpdated={replace} />)}</div>
  </main></div>;
}
