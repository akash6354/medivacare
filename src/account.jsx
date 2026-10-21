import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { BrandMark } from "./Brand.jsx";
import { useAuth } from "./AuthContext.jsx";
import { useCart } from "./CartContext.jsx";
import "./account.css";

function AccountFrame({ children, className = "" }) {
  const { cart } = useCart();
  return (
    <div className="account-page">
      <header className="account-header">
        <BrandMark />
        <nav className="account-top-nav" aria-label="Account navigation">
          <Link to="/catalog">Catalog</Link>
          <Link to="/orders">Orders</Link>
          <Link to="/cart">Cart ({cart.item_count})</Link>
        </nav>
      </header>
      <main className={`account-main ${className}`}>{children}</main>
      <footer className="account-footer">MedivaCare is a college project. Catalog examples are fictional.</footer>
    </div>
  );
}

function FormError({ message }) {
  return message ? <p className="account-error" role="alert">{message}</p> : null;
}

export function LoginPage() {
  const { login, session } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const requestedPath = searchParams.get("next");
  const nextPath = requestedPath?.startsWith("/") && !requestedPath.startsWith("//") ? requestedPath : "/account";

  if (session) return <Navigate to={nextPath} replace />;

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await login({ email, password });
      navigate(nextPath, { replace: true });
    } catch (reason) {
      setError(reason.message || "Sign in could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountFrame className="account-main--auth">
      <section className="auth-card" aria-labelledby="login-title">
        <span className="auth-kicker">WELCOME BACK</span>
        <h1 id="login-title">Sign in to your account</h1>
        <p className="auth-intro">Use the email and password you registered with.</p>
        <form className="account-form" onSubmit={submit}>
          <label>Email address<input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required maxLength={254} /></label>
          <label>Password<input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required maxLength={128} /></label>
          <FormError message={error} />
          <button className="account-submit" type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
        </form>
        <p className="auth-switch">New to MedivaCare? <Link to="/register">Create an account</Link></p>
        <p className="auth-security-note">Your sign-in token stays in this browser tab’s memory and is cleared when you close or refresh it.</p>
      </section>
    </AccountFrame>
  );
}

export function RegisterPage() {
  const { register, session } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to="/account" replace />;

  function change(event) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await register(form);
      navigate("/account", { replace: true });
    } catch (reason) {
      setError(reason.message || "Account creation could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountFrame className="account-main--auth">
      <section className="auth-card" aria-labelledby="register-title">
        <span className="auth-kicker">CREATE YOUR ACCOUNT</span>
        <h1 id="register-title">A little more personal</h1>
        <p className="auth-intro">Your phone number helps identify you and can be used for delivery contact details.</p>
        <form className="account-form" onSubmit={submit}>
          <label>Full name<input name="full_name" autoComplete="name" value={form.full_name} onChange={change} required minLength={1} maxLength={120} /></label>
          <label>Email address<input name="email" type="email" autoComplete="email" value={form.email} onChange={change} required maxLength={254} /></label>
          <label>Phone number<input name="phone" type="tel" autoComplete="tel" value={form.phone} onChange={change} required pattern="\+[1-9][0-9]{7,14}" placeholder="+919876543210" title="Use international format, for example +919876543210" /></label>
          <label>Password<input name="password" type="password" autoComplete="new-password" aria-describedby="register-password-hint" value={form.password} onChange={change} required minLength={12} maxLength={128} /></label>
          <small id="register-password-hint">Use at least 12 characters.</small>
          <FormError message={error} />
          <button className="account-submit" type="submit" disabled={busy}>{busy ? "Creating account…" : "Create account"}</button>
        </form>
        <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
      </section>
    </AccountFrame>
  );
}

const EMPTY_ADDRESS = {
  label: "Home",
  recipient_name: "",
  phone: "",
  address_line1: "",
  address_line2: "",
  city: "",
  state: "",
  postal_code: "",
  country_code: "IN",
  is_default: false,
};

function AddressForm({ initial, onCancel, onSave, busy }) {
  const [form, setForm] = useState(() => ({ ...EMPTY_ADDRESS, ...(initial ?? {}) }));
  const [error, setError] = useState("");

  function change(event) {
    const { name, value, checked, type } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  }

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await onSave(form);
    } catch (reason) {
      setError(reason.message || "Address could not be saved.");
    }
  }

  return (
    <form className="address-form" onSubmit={submit}>
      <div className="address-form-heading"><h3>{initial ? "Edit address" : "Add delivery address"}</h3><button type="button" className="quiet-button" onClick={onCancel}>Cancel</button></div>
      <div className="address-fields">
        <label>Label<select name="label" value={form.label} onChange={change}><option>Home</option><option>Work</option><option>Other</option></select></label>
        <label>Recipient name<input name="recipient_name" autoComplete="name" value={form.recipient_name} onChange={change} required maxLength={120} /></label>
        <label>Delivery phone<input name="phone" type="tel" autoComplete="tel" value={form.phone} onChange={change} required pattern="\+[1-9][0-9]{7,14}" placeholder="+919876543210" title="Use international format, for example +919876543210" /></label>
        <label className="address-field-wide">Address line 1<input name="address_line1" autoComplete="address-line1" value={form.address_line1} onChange={change} required minLength={3} maxLength={200} /></label>
        <label className="address-field-wide">Address line 2 <span>(optional)</span><input name="address_line2" autoComplete="address-line2" value={form.address_line2 ?? ""} onChange={change} maxLength={200} /></label>
        <label>City<input name="city" autoComplete="address-level2" value={form.city} onChange={change} required maxLength={100} /></label>
        <label>State<input name="state" autoComplete="address-level1" value={form.state} onChange={change} required maxLength={100} /></label>
        <label>PIN code<input name="postal_code" autoComplete="postal-code" value={form.postal_code} onChange={change} required inputMode="numeric" pattern="[1-9][0-9]{5}" maxLength={6} /></label>
      </div>
      <label className="default-address-toggle"><input type="checkbox" name="is_default" checked={Boolean(form.is_default)} onChange={change} /> Make this my default address</label>
      <FormError message={error} />
      <button className="account-submit address-save" type="submit" disabled={busy}>{busy ? "Saving…" : "Save address"}</button>
    </form>
  );
}

function AddressCard({ address, onEdit, onDelete, onDefault, busy }) {
  return (
    <article className="saved-address">
      <div className="saved-address-heading"><strong>{address.label}</strong>{address.is_default && <span className="default-address-badge">Default</span>}</div>
      <p>{address.recipient_name}<br />{address.address_line1}{address.address_line2 ? `, ${address.address_line2}` : ""}<br />{address.city}, {address.state} {address.postal_code}<br />{address.phone}</p>
      <div className="saved-address-actions">
        <button type="button" className="quiet-button" onClick={onEdit} disabled={busy}>Edit</button>
        {!address.is_default && <button type="button" className="quiet-button" onClick={onDefault} disabled={busy}>Make default</button>}
        <button type="button" className="quiet-button quiet-button--danger" onClick={onDelete} disabled={busy}>Delete</button>
      </div>
    </article>
  );
}

export function ProfilePage() {
  const { session, customer, api, logout, updateCustomer } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(customer);
  const [addresses, setAddresses] = useState([]);
  const [editingAddress, setEditingAddress] = useState(undefined);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (!session) return;
    const controller = new AbortController();
    setLoading(true);
    Promise.all([
      api("/customers/me", { signal: controller.signal }),
      api("/customers/me/addresses", { signal: controller.signal }),
    ])
      .then(([nextProfile, nextAddresses]) => {
        setProfile(nextProfile);
        setAddresses(nextAddresses);
      })
      .catch((reason) => {
        if (reason.name !== "AbortError") setError(reason.message || "Account details could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [session, api]);

  if (!session) return <Navigate to="/login?next=%2Faccount" replace />;

  async function saveProfile(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    setBusy(true);
    const form = new FormData(event.currentTarget);
    try {
      const nextProfile = await api("/customers/me", {
        method: "PATCH",
        body: { full_name: form.get("full_name"), phone: form.get("phone") },
      });
      setProfile(nextProfile);
      updateCustomer(nextProfile);
      setNotice("Your profile has been updated.");
    } catch (reason) {
      setError(reason.message || "Profile could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  async function saveAddress(form) {
    setBusy(true);
    setError("");
    try {
      if (editingAddress && editingAddress !== "new") {
        await api(`/customers/me/addresses/${editingAddress.id}`, { method: "PATCH", body: form });
      } else {
        await api("/customers/me/addresses", { method: "POST", body: form });
      }
      const nextAddresses = await api("/customers/me/addresses");
      setAddresses(nextAddresses);
      setEditingAddress(undefined);
      setNotice("Your address has been saved.");
    } finally {
      setBusy(false);
    }
  }

  async function makeDefault(address) {
    setBusy(true);
    setError("");
    try {
      await api(`/customers/me/addresses/${address.id}`, { method: "PATCH", body: { is_default: true } });
      setAddresses(await api("/customers/me/addresses"));
      setNotice(`${address.label} is now your default address.`);
    } catch (reason) {
      setError(reason.message || "Default address could not be updated.");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAddress(address) {
    if (!window.confirm(`Delete the ${address.label.toLowerCase()} address?`)) return;
    setBusy(true);
    setError("");
    try {
      await api(`/customers/me/addresses/${address.id}`, { method: "DELETE" });
      setAddresses(await api("/customers/me/addresses"));
      setNotice("The address has been deleted.");
    } catch (reason) {
      setError(reason.message || "Address could not be deleted.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AccountFrame className="account-main--profile">
      <div className="profile-heading">
        <div><span className="auth-kicker">YOUR ACCOUNT</span><h1>Welcome, {profile?.full_name ?? "customer"}</h1><p>Manage your contact information and saved delivery addresses.</p></div>
        <button className="quiet-button" type="button" onClick={() => { logout(); navigate("/", { replace: true }); }}>Sign out</button>
      </div>
      {error && <FormError message={error} />}
      {notice && <p className="account-success" role="status">{notice}</p>}
      {loading ? <div className="account-loading" aria-label="Loading account" /> : <div className="profile-grid">
        <section className="profile-panel" aria-labelledby="profile-details-title">
          <div className="profile-panel-heading"><div><span className="auth-kicker">PERSONAL DETAILS</span><h2 id="profile-details-title">Your information</h2></div></div>
          <form className="account-form" onSubmit={saveProfile}>
            <label>Full name<input name="full_name" autoComplete="name" defaultValue={profile?.full_name ?? ""} required minLength={1} maxLength={120} /></label>
            <label>Email address<input type="email" value={profile?.email ?? ""} readOnly disabled /></label>
            <label>Phone number<input name="phone" type="tel" autoComplete="tel" defaultValue={profile?.phone ?? ""} required pattern="\+[1-9][0-9]{7,14}" title="Use international format, for example +919876543210" /></label>
            <button className="account-submit" type="submit" disabled={busy}>Save profile</button>
          </form>
        </section>

        <section className="profile-panel" aria-labelledby="addresses-title">
          <div className="profile-panel-heading"><div><span className="auth-kicker">DELIVERY DETAILS</span><h2 id="addresses-title">Saved addresses</h2></div><button className="quiet-button" type="button" onClick={() => setEditingAddress("new")} disabled={busy}>+ Add address</button></div>
          {editingAddress !== undefined && <AddressForm key={editingAddress === "new" ? "new" : editingAddress.id} initial={editingAddress === "new" ? null : editingAddress} onCancel={() => setEditingAddress(undefined)} onSave={saveAddress} busy={busy} />}
          {!editingAddress && addresses.length === 0 && <div className="address-empty"><strong>No saved addresses yet</strong><span>Add an address for a future checkout.</span></div>}
          {!editingAddress && addresses.length > 0 && <div className="address-list">{addresses.map((address) => <AddressCard key={address.id} address={address} busy={busy} onEdit={() => setEditingAddress(address)} onDelete={() => deleteAddress(address)} onDefault={() => makeDefault(address)} />)}</div>}
        </section>
      </div>}
      <p className="account-session-note">For privacy, sign-in remains active only in the current page session. Refreshing the page signs you out.</p>
    </AccountFrame>
  );
}
