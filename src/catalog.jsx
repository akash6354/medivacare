import { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BrandMark } from "./Brand.jsx";
import { useAuth } from "./AuthContext.jsx";
import { useCart } from "./CartContext.jsx";
import "./catalog.css";
import "./prescriptions.css";

const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");
const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

function CatalogHeader() {
  const { cart } = useCart();
  const { session } = useAuth();
  return (
    <header className="catalog-header">
      <div className="catalog-header-inner">
        <BrandMark />
        <nav aria-label="Main navigation">
          <Link to="/">Home</Link>
          <Link className="catalog-nav-active" to="/catalog">Medicine catalog</Link>
          {session && <Link to="/prescriptions">Prescriptions</Link>}
        </nav>
        <span className="catalog-demo-note"><span /> Synthetic demo catalog</span>
        <Link className="catalog-account-link" to="/cart">Cart ({cart.item_count})</Link>
        <Link className="catalog-account-link" to="/account">My account</Link>
      </div>
    </header>
  );
}

function CatalogFrame({ children }) {
  return (
    <div className="catalog-page">
      <CatalogHeader />
      <main className="catalog-main">{children}</main>
      <footer className="catalog-footer">
        <BrandMark />
        <span>All listings are fictional demonstrations, not real medicines.</span>
      </footer>
    </div>
  );
}

function ProductCard({ product }) {
  return (
    <article className="medicine-card">
      <div className="medicine-card-art" aria-hidden="true"><span className="demo-capsule"><i /></span></div>
      <div className="medicine-card-body">
        <div className="medicine-card-flags">
          <span className="synthetic-tag">Synthetic demo</span>
          {!product.in_stock && <span className="stock-tag stock-tag--out">Out of stock</span>}
          {product.prescription_required && <span className="rx-tag">Prescription review required</span>}
        </div>
        <Link className="medicine-name" to={`/catalog/${product.slug}`}>{product.name}</Link>
        <span className="medicine-form">{product.dosage_form} · {product.pack_quantity} {product.pack_unit}</span>
        <p className="medicine-ingredients">
          {product.active_ingredients.map((item) => `${item.name} ${item.strength_amount} ${item.strength_unit}`).join(" + ")}
        </p>
        <div className="medicine-price-row">
          <div><strong>{money.format(Number(product.selling_price))}</strong><del>{money.format(Number(product.mrp))}</del></div>
          <span>{money.format(Number(product.unit_price))} / {product.pack_unit.replace(/s$/, "")}</span>
        </div>
        <Link className="medicine-details-link" to={`/catalog/${product.slug}`}>View demonstration details <span>→</span></Link>
      </div>
    </article>
  );
}

export function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchText, setSearchText] = useState(searchParams.get("q") ?? "");
  const [catalog, setCatalog] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const queryString = useMemo(() => searchParams.toString(), [searchParams]);
  const currentPage = Number(searchParams.get("page") ?? 1);

  useEffect(() => setSearchText(searchParams.get("q") ?? ""), [searchParams]);

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBase}/catalog/categories`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("Categories could not be loaded");
        return response.json();
      })
      .then(setCategories)
      .catch((reason) => {
        if (reason.name !== "AbortError") setCategories([]);
      });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`${apiBase}/catalog${queryString ? `?${queryString}` : ""}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Catalog could not be loaded. Check that the API is running.");
        return response.json();
      })
      .then(setCatalog)
      .catch((reason) => {
        if (reason.name !== "AbortError") setError(reason.message || "Catalog could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [queryString]);

  function updateFilter(key, value) {
    const next = new URLSearchParams(searchParams);
    next.delete("page");
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next);
  }

  function submitSearch(event) {
    event.preventDefault();
    const next = new URLSearchParams(searchParams);
    next.delete("page");
    if (searchText.trim()) next.set("q", searchText.trim());
    else next.delete("q");
    setSearchParams(next);
  }

  function goToPage(page) {
    const next = new URLSearchParams(searchParams);
    next.set("page", String(page));
    setSearchParams(next);
  }

  return (
    <CatalogFrame>
      <div className="catalog-heading-row">
        <div>
          <div className="eyebrow"><span className="eyebrow-line" /> MEDICINE INFORMATION</div>
          <h1>Explore the demo catalog</h1>
          <p>Search fictional listings by name or sample active ingredient.</p>
        </div>
        <span className="catalog-data-label"><span>i</span> Synthetic data for demonstration only</span>
      </div>

      <form className="catalog-search" onSubmit={submitSearch} role="search">
        <label className="visually-hidden" htmlFor="catalog-search-input">Search name or active ingredient</label>
        <span aria-hidden="true">⌕</span>
        <input id="catalog-search-input" value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="Search medicine name or sample active ingredient" />
        <button type="submit">Search</button>
      </form>

      <div className="catalog-controls">
        <label>Category
          <select value={searchParams.get("category") ?? ""} onChange={(event) => updateFilter("category", event.target.value)}>
            <option value="">All categories</option>
            {categories.map((category) => <option key={category.id} value={category.slug}>{category.name}</option>)}
          </select>
        </label>
        <label>Availability
          <select value={searchParams.get("availability") ?? "all"} onChange={(event) => updateFilter("availability", event.target.value === "all" ? "" : event.target.value)}>
            <option value="all">All listings</option>
            <option value="in_stock">In stock</option>
            <option value="out_of_stock">Out of stock</option>
          </select>
        </label>
        <label>Sort by
          <select value={searchParams.get("sort") ?? "relevance"} onChange={(event) => updateFilter("sort", event.target.value === "relevance" ? "" : event.target.value)}>
            <option value="relevance">Name</option>
            <option value="price_asc">Price: low to high</option>
            <option value="price_desc">Price: high to low</option>
            <option value="savings">Savings</option>
          </select>
        </label>
        {!loading && catalog && <span className="catalog-result-count">{catalog.total} fictional listing{catalog.total === 1 ? "" : "s"}</span>}
      </div>

      {loading && <div className="catalog-card-grid" aria-label="Loading catalog">{[1, 2, 3].map((item) => <div className="catalog-skeleton" key={item} />)}</div>}
      {!loading && error && <div className="catalog-message catalog-message--error" role="alert"><strong>Catalog unavailable</strong><span>{error}</span></div>}
      {!loading && !error && catalog?.items.length === 0 && <div className="catalog-message"><strong>No matching listings</strong><span>Try another name, ingredient, or filter.</span></div>}
      {!loading && !error && catalog?.items.length > 0 && (
        <>
          <div className="catalog-card-grid">{catalog.items.map((product) => <ProductCard key={product.id} product={product} />)}</div>
          {catalog.total_pages > 1 && <nav className="catalog-pagination" aria-label="Catalog pages">
            <button type="button" onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}>← Previous</button>
            <span>Page {catalog.page} of {catalog.total_pages}</span>
            <button type="button" onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= catalog.total_pages}>Next →</button>
          </nav>}
        </>
      )}

      <aside className="catalog-safety-note"><span>i</span><p>These fictional examples are for software demonstration only and contain no verified drug information. They cannot be purchased or used to guide treatment. Never change a prescribed medicine without professional advice.</p></aside>
    </CatalogFrame>
  );
}

export function ProductDetailPage() {
  const { session, api } = useAuth();
  const { cart, setQuantity, refresh: refreshCart } = useCart();
  const navigate = useNavigate();
  const location = useLocation();
  const { slug } = useParams();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cartMessage, setCartMessage] = useState("");
  const [cartBusy, setCartBusy] = useState(false);
  const [prescriptions, setPrescriptions] = useState([]);
  const [prescriptionFile, setPrescriptionFile] = useState(null);
  const [prescriptionBusy, setPrescriptionBusy] = useState(false);
  const [prescriptionMessage, setPrescriptionMessage] = useState("");
  const [prescriptionError, setPrescriptionError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError("");
    fetch(`${apiBase}/catalog/${encodeURIComponent(slug)}`, { signal: controller.signal })
      .then(async (response) => {
        if (response.status === 404) throw new Error("This listing is unavailable.");
        if (!response.ok) throw new Error("Listing details could not be loaded. Check that the API is running.");
        return response.json();
      })
      .then(setProduct)
      .catch((reason) => {
        if (reason.name !== "AbortError") setError(reason.message || "Listing details could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [slug]);

  useEffect(() => {
    if (!session || !product?.prescription_required) {
      setPrescriptions([]);
      return undefined;
    }
    const controller = new AbortController();
    setPrescriptions([]);
    setPrescriptionError("");
    api(`/prescriptions?product_id=${encodeURIComponent(product.id)}`, { signal: controller.signal })
      .then(setPrescriptions)
      .catch((reason) => {
        if (reason.name !== "AbortError") setPrescriptionError(reason.message || "Prescription status could not be loaded.");
      });
    return () => controller.abort();
  }, [session, api, product?.id, product?.prescription_required]);

  const latestPrescription = prescriptions[0] ?? null;
  const prescriptionApproved = !product?.prescription_required || latestPrescription?.status === "approved";

  async function submitPrescription(event) {
    event.preventDefault();
    setPrescriptionMessage("");
    setPrescriptionError("");
    if (!session) {
      navigate(`/login?next=${encodeURIComponent(location.pathname)}`);
      return;
    }
    if (!prescriptionFile || !product) {
      setPrescriptionError("Choose a PDF, PNG, or JPEG file first.");
      return;
    }
    if (prescriptionFile.size > 5 * 1024 * 1024) {
      setPrescriptionError("Prescription files must be 5 MB or smaller.");
      return;
    }
    const form = new FormData();
    form.append("product_id", product.id);
    form.append("file", prescriptionFile);
    setPrescriptionBusy(true);
    const formElement = event.currentTarget;
    try {
      const uploaded = await api("/prescriptions", { method: "POST", body: form });
      setPrescriptions((current) => [uploaded, ...current]);
      setPrescriptionFile(null);
      formElement.reset();
      setPrescriptionMessage("Prescription uploaded. It is waiting for pharmacist review.");
      await refreshCart();
    } catch (reason) {
      setPrescriptionError(reason.message || "Prescription upload could not be completed.");
    } finally {
      setPrescriptionBusy(false);
    }
  }

  const currentCartQuantity = product
    ? cart.items.find((item) => item.product_id === product.id)?.quantity ?? 0
    : 0;

  async function addToCart() {
    setCartMessage("");
    if (!session) {
      navigate(`/login?next=${encodeURIComponent(location.pathname)}`);
      return;
    }
    if (!prescriptionApproved || !product.in_stock || currentCartQuantity >= product.stock_quantity) return;
    setCartBusy(true);
    try {
      await setQuantity(product.id, currentCartQuantity + 1);
      setCartMessage("Added to your demonstration cart.");
    } catch (reason) {
      setCartMessage(reason.message || "This listing could not be added to your cart.");
    } finally {
      setCartBusy(false);
    }
  }

  return (
    <CatalogFrame>
      <Link className="catalog-back-link" to="/catalog">← Back to catalog</Link>
      {loading && <div className="detail-skeleton" aria-label="Loading listing" />}
      {!loading && error && <div className="catalog-message catalog-message--error" role="alert"><strong>Listing unavailable</strong><span>{error}</span></div>}
      {!loading && product && <article className="product-detail">
        <div className="product-detail-art" aria-hidden="true"><span className="demo-capsule demo-capsule--large"><i /></span></div>
        <div className="product-detail-copy">
          <span className="synthetic-tag">Fictional demonstration listing</span>
          <p className="detail-category">{product.category} · {product.dosage_form}</p>
          <h1>{product.name}</h1>
          <p className="detail-description">{product.description}</p>
          <dl className="detail-facts">
            <div><dt>Sample active ingredients</dt><dd>{product.active_ingredients.map((item) => <span key={item.name}>{item.name} — {item.strength_amount} {item.strength_unit}</span>)}</dd></div>
            <div><dt>Pack size</dt><dd>{product.pack_quantity} {product.pack_unit}</dd></div>
            <div><dt>Manufacturer</dt><dd>{product.manufacturer}</dd></div>
            <div><dt>Stock status</dt><dd>{product.in_stock ? `In stock (${product.stock_quantity} demo units)` : "Out of stock"}</dd></div>
            <div><dt>Prescription flag</dt><dd>{product.prescription_required ? "Review required before any dispensing workflow" : "No prescription flag in this synthetic example"}</dd></div>
          </dl>
          <div className="detail-price"><strong>{money.format(Number(product.selling_price))}</strong><del>{money.format(Number(product.mrp))}</del><span>Demo price · {money.format(Number(product.unit_price))} per {product.pack_unit.replace(/s$/, "")}</span></div>
          {product.prescription_required && <section className="prescription-box" aria-labelledby="prescription-heading">
            <div><span className="eyebrow">RESTRICTED LISTING</span><h2 id="prescription-heading">Prescription review</h2><p>Upload a prescription for this listing. Only an authorized pharmacist or administrator can review it.</p></div>
            {!session ? <Link className="catalog-primary-link" to={`/login?next=${encodeURIComponent(location.pathname)}`}>Sign in to upload</Link> : <>
              <form className="prescription-upload-form" onSubmit={submitPrescription}>
                <label htmlFor="prescription-file">Prescription file <span>PDF, PNG, or JPEG · up to 5 MB</span></label>
                <input id="prescription-file" type="file" accept="application/pdf,image/png,image/jpeg" onChange={(event) => setPrescriptionFile(event.target.files?.[0] ?? null)} />
                <button type="submit" disabled={prescriptionBusy || !prescriptionFile}>{prescriptionBusy ? "Uploading…" : "Upload for review"}</button>
              </form>
              {prescriptionError && <p className="prescription-feedback prescription-feedback--error" role="alert">{prescriptionError}</p>}
              {prescriptionMessage && <p className="prescription-feedback" role="status">{prescriptionMessage}</p>}
              {prescriptions.length > 0 ? <div className="prescription-status-list" aria-label="Prescription review history">
                {prescriptions.map((entry) => <div className="prescription-status-item" key={entry.id}>
                  <span className={`prescription-status prescription-status--${entry.status}`}>{entry.status}</span>
                  <span>Submitted {new Date(entry.created_at).toLocaleDateString()}</span>
                  {entry.review_note && <small>{entry.review_note}</small>}
                </div>)}
              </div> : <p className="prescription-feedback">No prescription has been submitted for this listing.</p>}
            </>}
          </section>}
          <div className="detail-cart-action">
            <button type="button" className="catalog-add-button" disabled={cartBusy || !product.in_stock || currentCartQuantity >= product.stock_quantity || !prescriptionApproved} onClick={addToCart}>
              {!product.in_stock ? "Out of stock" : currentCartQuantity >= product.stock_quantity ? "Stock limit reached" : cartBusy ? "Adding…" : !prescriptionApproved ? latestPrescription?.status === "pending" ? "Awaiting prescription review" : "Approval required before adding" : session ? "Add to demo cart" : "Sign in to add to cart"}
            </button>
            {cartMessage && <span role="status">{cartMessage}</span>}
          </div>
          <p className="detail-disclaimer">This item is fictional. No medicine is sold or dispensed from this demonstration catalog.</p>
        </div>
      </article>}
    </CatalogFrame>
  );
}

export function CustomerPrescriptionsPage() {
  const { session, api } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!session) return undefined;
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api("/prescriptions", { signal: controller.signal })
      .then(setItems)
      .catch((reason) => { if (reason.name !== "AbortError") setError(reason.message || "Prescription statuses could not be loaded."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [session, api, reload]);

  if (!session) return <Navigate to={`/login?next=${encodeURIComponent("/prescriptions")}`} replace />;

  return <CatalogFrame>
    <div className="catalog-heading-row"><div><div className="eyebrow"><span className="eyebrow-line" /> CUSTOMER RECORDS</div><h1>Prescription submissions</h1><p>Review the status of files you submitted for prescription-flagged demo listings.</p></div><button className="prescription-refresh-button" type="button" onClick={() => setReload((value) => value + 1)}>Refresh status</button></div>
    {loading && <div className="detail-skeleton" aria-label="Loading prescription status" />}
    {!loading && error && <div className="catalog-message catalog-message--error" role="alert"><strong>Prescription statuses unavailable</strong><span>{error}</span></div>}
    {!loading && !error && items.length === 0 && <section className="prescription-empty"><strong>No prescription submissions yet.</strong><span>Open a prescription-flagged listing to upload a document for review.</span><Link to="/catalog">Browse demo catalog</Link></section>}
    {!loading && !error && items.length > 0 && <div className="prescription-customer-list">{items.map((item) => <article className="prescription-customer-card" key={item.id}>
      <div><span className={`prescription-status prescription-status--${item.status}`}>{item.status}</span><h2>{item.product_name}</h2><p>Submitted {new Date(item.created_at).toLocaleString()}</p></div>
      {item.review_note && <p className="prescription-customer-note">{item.review_note}</p>}
      <Link to={`/catalog/${item.product_slug}`}>View listing</Link>
    </article>)}</div>}
  </CatalogFrame>;
}
