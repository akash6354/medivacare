import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import { BrandMark } from "./Brand.jsx";
import "./support.css";

function PageFrame({ title, children }) {
  return <main className="simple-page"><header><BrandMark /><Link to="/">Back to MedivaCare</Link></header><section className="simple-panel"><span className="simple-kicker">MEDIVACARE · COLLEGE PROJECT</span><h1>{title}</h1>{children}</section><footer>Demonstration only · No real medicine sales or delivery</footer></main>;
}

export function SupportPage() {
  const { session, api } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!session) return;
    api("/support/tickets").then(setTickets).catch((reason) => setError(reason.message || "Support requests could not be loaded."));
  }, [session, api]);
  if (!session) return <Navigate to="/login?next=%2Fsupport" replace />;
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const created = await api("/support/tickets", { method: "POST", body: { subject, message } });
      setTickets((current) => [created, ...current]); setSubject(""); setMessage(""); setNotice("Your support request has been saved.");
    } catch (reason) { setError(reason.message || "Your request could not be saved."); }
    finally { setBusy(false); }
  }
  return <PageFrame title="Customer support"><p>Send a question about this demonstration account or order. Staff can review your request in the support console.</p><form className="support-form" onSubmit={submit}><label>Subject<input required minLength="4" maxLength="120" value={subject} onChange={(e) => setSubject(e.target.value)} /></label><label>How can we help?<textarea required minLength="10" maxLength="3000" rows="5" value={message} onChange={(e) => setMessage(e.target.value)} /></label><button disabled={busy}>{busy ? "Sending…" : "Send request"}</button></form>{error && <p className="simple-error" role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}<h2>Your requests</h2>{tickets.length === 0 ? <p>No requests yet.</p> : <div className="ticket-list">{tickets.map((ticket) => <article key={ticket.id}><div><strong>{ticket.subject}</strong><span>{new Date(ticket.created_at).toLocaleString()}</span></div><span className="ticket-status">{ticket.status.replaceAll("_", " ")}</span><p>{ticket.message}</p>{ticket.staff_note && <p className="staff-note">Staff: {ticket.staff_note}</p>}</article>)}</div>}</PageFrame>;
}

export function AdminSupportPage() {
  const { session, api } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!session) return;
    api("/admin/support/tickets").then(setTickets).catch((reason) => setError(reason.message || "Support tickets could not be loaded."));
  }, [session, api]);
  if (!session) return <Navigate to="/login?next=%2Fadmin%2Fsupport" replace />;
  async function update(ticket, status, staff_note) {
    try {
      const updated = await api(`/admin/support/tickets/${ticket.id}`, { method: "PATCH", body: { status, staff_note } });
      setTickets((current) => current.map((row) => row.id === updated.id ? updated : row)); setError("");
    } catch (reason) { setError(reason.message || "Ticket update failed."); }
  }
  return <PageFrame title="Support inbox"><p>Review customer questions and update their status.</p>{error && <p className="simple-error" role="alert">{error}</p>}{tickets.length === 0 ? <p>No support requests yet.</p> : <div className="ticket-list">{tickets.map((ticket) => <TicketEditor key={ticket.id} ticket={ticket} onSave={update} />)}</div>}</PageFrame>;
}

function TicketEditor({ ticket, onSave }) {
  const [status, setStatus] = useState(ticket.status);
  const [note, setNote] = useState(ticket.staff_note || "");
  return <article className="support-ticket"><div><strong>{ticket.subject}</strong><span>{ticket.customer_name} · {ticket.customer_email} · {new Date(ticket.created_at).toLocaleString()}</span></div><p>{ticket.message}</p><label>Staff note<textarea maxLength="500" rows="2" value={note} onChange={(event) => setNote(event.target.value)} /></label><div className="ticket-edit-actions"><select value={status} onChange={(event) => setStatus(event.target.value)}><option value="open">Open</option><option value="in_progress">In progress</option><option value="resolved">Resolved</option></select><button type="button" onClick={() => onSave(ticket, status, note)}>Save update</button></div></article>;
}

const info = {
  "/privacy": ["Privacy notice", "This local college demonstration stores account details, delivery addresses, saved orders, support messages, and prescription uploads in its configured database or private upload folder. Use synthetic information only. Access tokens are kept in memory by the browser app. Staff access is role-restricted.", "This is a project notice, not legal advice or a substitute for a production privacy policy."],
  "/terms": ["Terms of use", "MedivaCare is a non-commercial educational demonstration. Catalog entries and transactions are synthetic. No medicine is sold, dispensed, shipped, or clinically recommended through this project.", "Do not rely on the site for diagnosis, treatment, or medication decisions. Consult a qualified healthcare professional."],
  "/medicine-safety": ["Medicine information and safety", "Product and ingredient details in this demonstration are fictional sample data and are not verified medical information. Similar ingredient names do not establish that medicines are interchangeable.", "Follow your prescription and ask a qualified pharmacist or clinician before changing or taking a medicine."],
};

export function InfoPage({ path }) {
  const [title, body, note] = info[path] || info["/terms"];
  return <PageFrame title={title}><p>{body}</p><p className="info-note">{note}</p><p><Link to="/support">Contact support</Link></p></PageFrame>;
}
