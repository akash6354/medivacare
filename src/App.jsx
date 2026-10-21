import { useEffect, useState } from "react";
import { Link, Route, Routes, useNavigate } from "react-router-dom";
import { CatalogPage, CustomerPrescriptionsPage, ProductDetailPage } from "./catalog.jsx";
import { BrandMark } from "./Brand.jsx";
import { LoginPage, ProfilePage, RegisterPage } from "./account.jsx";
import { CartPage, OrderDetailPage, OrderListPage } from "./commerce.jsx";
import { AdminOrdersPage, AdminPrescriptionPage } from "./admin.jsx";
import { AdminCatalogPage } from "./adminCatalog.jsx";
import { AdminDataPage } from "./adminData.jsx";
import { useCart } from "./CartContext.jsx";
import { AdminSupportPage, InfoPage, SupportPage } from "./support.jsx";

const apiBase = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1";

function ApiStatus() {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBase}/health`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("API unavailable");
        return response.json();
      })
      .then((data) => setStatus(data.status === "ok" ? "online" : "offline"))
      .catch((error) => {
        if (error.name !== "AbortError") setStatus("offline");
      });

    return () => controller.abort();
  }, []);

  const label = status === "checking" ? "Connecting to service" : status === "online" ? "Service connected" : "Service starting";

  return (
    <span className={`api-status api-status--${status}`} aria-live="polite">
      <span className="status-dot" />
      {label}
    </span>
  );
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none">
      <circle cx="10.8" cy="10.8" r="6.8" stroke="currentColor" strokeWidth="1.7" />
      <path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </svg>
  );
}

function HomePage() {
  const { cart } = useCart();
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");

  function handleSearch(event) {
    event.preventDefault();
    const search = query.trim();
    if (!search) {
      setNotice("Enter a medicine name or active ingredient to search.");
      return;
    }
    navigate(`/catalog?q=${encodeURIComponent(search)}`);
  }

  return (
    <div id="top" className="page-shell">
      <div className="announcement">
        <span className="announcement-icon" aria-hidden="true">✳</span>
        <span>A clearer way to explore generic medicine information</span>
      </div>

      <header className="site-header">
        <div className="header-inner">
          <BrandMark />
          <nav className="main-nav" aria-label="Main navigation">
            <a className="nav-link nav-link--active" href="#top">Home</a>
            <Link className="nav-link" to="/catalog">Catalog</Link>
            <a className="nav-link" href="#how-it-works">How it works</a>
            <a className="nav-link" href="#our-approach">Our approach</a>
          </nav>
          <div className="header-actions">
            <ApiStatus />
            <Link className="account-button" to="/cart">Cart ({cart.item_count})</Link>
            <Link className="account-button" to="/account">My account <span aria-hidden="true">↗</span></Link>
          </div>
        </div>
      </header>

      <main>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <div className="eyebrow"><span className="eyebrow-line" /> HEALTHCARE, WITH MORE CLARITY</div>
            <h1 id="hero-title">Good health starts<br />with <span>good information.</span></h1>
            <p className="hero-description">Explore medicine details, understand active ingredients, and make informed conversations with your healthcare professional easier.</p>
            <form className="search-form" onSubmit={handleSearch} role="search">
              <label className="visually-hidden" htmlFor="medicine-search">Search medicine or active ingredient</label>
              <span className="search-icon"><SearchIcon /></span>
              <input id="medicine-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search a medicine or active ingredient" />
              <button type="submit">Search <span aria-hidden="true">→</span></button>
            </form>
            {notice && <p className="search-notice" role="status">{notice}</p>}
            <div className="hero-footnote"><span className="small-shield" aria-hidden="true">✓</span> Information designed to support—not replace—professional advice</div>
          </div>

          <div className="hero-art" aria-label="Abstract illustration of a medicine capsule">
            <div className="art-orbit art-orbit--outer" />
            <div className="art-orbit art-orbit--inner" />
            <div className="art-spark art-spark--one">✳</div>
            <div className="art-spark art-spark--two">✦</div>
            <div className="capsule-shadow" />
            <div className="capsule">
              <div className="capsule-half capsule-half--light"><span className="capsule-glint" /></div>
              <div className="capsule-half capsule-half--green" />
              <div className="capsule-seam" />
            </div>
            <div className="art-label art-label--ingredient"><span className="label-dot" />Active ingredients<br /><strong>Understand what’s inside</strong></div>
            <div className="art-label art-label--care"><span className="care-icon">♡</span>Better informed<br /><strong>Care starts with clarity</strong></div>
          </div>
        </section>

        <section className="trust-strip" aria-label="Our commitments">
          <div className="trust-item"><span className="trust-icon trust-icon--leaf">✳</span><span><strong>Clarity first</strong><small>Understand the details</small></span></div>
          <div className="trust-divider" />
          <div className="trust-item"><span className="trust-icon trust-icon--search"><SearchIcon /></span><span><strong>Ingredient aware</strong><small>Explore compositions</small></span></div>
          <div className="trust-divider" />
          <div className="trust-item"><span className="trust-icon trust-icon--heart">♡</span><span><strong>People centered</strong><small>Informed care decisions</small></span></div>
          <div className="trust-divider" />
          <div className="trust-item"><span className="trust-icon trust-icon--shield">✓</span><span><strong>Guidance matters</strong><small>Professional advice comes first</small></span></div>
        </section>

        <section id="how-it-works" className="intro-section">
          <div className="section-heading">
            <div className="eyebrow"><span className="eyebrow-line" /> A MORE INFORMED JOURNEY</div>
            <h2>Healthcare choices,<br /><span>made a little clearer.</span></h2>
          </div>
          <p className="intro-copy">Medicine information can feel hard to navigate. The demonstration catalog organizes fictional product details in one place, while keeping qualified healthcare professionals at the center of every treatment decision.</p>
        </section>

        <section id="our-approach" className="approach-grid" aria-label="Our approach">
          <article className="approach-card"><span className="card-number">01</span><div className="card-icon card-icon--green">⌕</div><h3>Start with the details</h3><p>Explore names, strengths, dosage forms, and active ingredients in one considered place.</p><span className="card-bottom">BUILT AROUND CLARITY <span>↗</span></span></article>
          <article className="approach-card approach-card--tint"><span className="card-number">02</span><div className="card-icon card-icon--peach">◉</div><h3>See the full picture</h3><p>Compare structured product information and bring better questions to your care team.</p><span className="card-bottom">INFORMATION, ORGANIZED <span>↗</span></span></article>
          <article className="approach-card"><span className="card-number">03</span><div className="card-icon card-icon--lavender">♡</div><h3>Keep care personal</h3><p>A qualified healthcare professional should guide any change to your prescribed medicine.</p><span className="card-bottom">YOUR CARE COMES FIRST <span>↗</span></span></article>
        </section>

        <section className="disclaimer" aria-label="Important information">
          <span className="disclaimer-mark" aria-hidden="true">i</span>
          <p><strong>For learning and demonstration.</strong> This college project uses no verified medicine catalog and is not a pharmacy or authorization to sell medicines. Always follow qualified medical advice; never change a prescribed medicine based on this site.</p>
          <span className="disclaimer-leaf" aria-hidden="true">✳</span>
        </section>
      </main>

      <footer className="site-footer">
        <BrandMark />
        <span>Thoughtful information for more informed care.</span>
        <nav aria-label="Information"><Link to="/support">Support</Link><Link to="/medicine-safety">Medicine safety</Link><Link to="/privacy">Privacy</Link><Link to="/terms">Terms</Link></nav>
        <span className="footer-copy">© 2026 MedivaCare · College project</span>
      </footer>
    </div>
  );
}

function NotFoundPage() {
  return (
    <main className="catalog-empty-page">
      <span className="eyebrow">PAGE NOT FOUND</span>
      <h1>We couldn’t find that page.</h1>
      <p>Return to the home page or browse the demonstration catalog.</p>
      <Link className="catalog-primary-link" to="/catalog">Browse catalog</Link>
    </main>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/catalog" element={<CatalogPage />} />
      <Route path="/catalog/:slug" element={<ProductDetailPage />} />
      <Route path="/prescriptions" element={<CustomerPrescriptionsPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/account" element={<ProfilePage />} />
      <Route path="/cart" element={<CartPage />} />
      <Route path="/orders" element={<OrderListPage />} />
      <Route path="/orders/:orderNumber" element={<OrderDetailPage />} />
      <Route path="/support" element={<SupportPage />} />
      <Route path="/privacy" element={<InfoPage path="/privacy" />} />
      <Route path="/terms" element={<InfoPage path="/terms" />} />
      <Route path="/medicine-safety" element={<InfoPage path="/medicine-safety" />} />
      <Route path="/admin/orders" element={<AdminOrdersPage />} />
      <Route path="/admin/orders/:orderNumber" element={<AdminOrdersPage />} />
      <Route path="/admin/catalog" element={<AdminCatalogPage />} />
      <Route path="/admin/customers" element={<AdminDataPage section="customers" />} />
      <Route path="/admin/payments" element={<AdminDataPage section="payments" />} />
      <Route path="/admin/prescriptions" element={<AdminPrescriptionPage />} />
      <Route path="/admin/support" element={<AdminSupportPage />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
