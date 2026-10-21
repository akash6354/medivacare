import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminPrescriptionPage } from "./admin.jsx";
import { AuthProvider, useAuth } from "./AuthContext.jsx";
import { CartProvider } from "./CartContext.jsx";
import { ProductDetailPage } from "./catalog.jsx";

const productId = "24a15dda-10e1-45df-9112-499b8b4b48bc";
const prescriptionId = "7e269210-7a22-43f6-9f7c-7a415e5b4d7a";
const emptyCart = { items: [], item_count: 0, subtotal: "0.00", delivery_fee: "0.00", estimated_total: "0.00", currency: "INR" };
const pendingPrescription = {
  id: prescriptionId,
  product_id: productId,
  product_name: "Demo Capsule Beta",
  product_slug: "demo-beta",
  status: "pending",
  review_note: null,
  created_at: "2026-10-14T10:00:00Z",
  reviewed_at: null,
};

function jsonResponse(payload, status = 200) {
  return { status, ok: status >= 200 && status < 300, json: async () => payload, blob: async () => new Blob() };
}

function StaffSignIn() {
  const { login } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { login({ email: "pharmacist@example.com", password: "demo-staff-password" }).then(() => navigate("/admin/prescriptions")); }, [login, navigate]);
  return <p>Signing in as pharmacist</p>;
}

function renderAdminQueue() {
  return render(<AuthProvider><MemoryRouter initialEntries={["/"]}><Routes>
    <Route path="/" element={<StaffSignIn />} />
    <Route path="/admin/prescriptions" element={<AdminPrescriptionPage />} />
  </Routes></MemoryRouter></AuthProvider>);
}

function CustomerSignIn() {
  const { login } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { login({ email: "customer@example.com", password: "demo-customer-password" }).then(() => navigate("/catalog/demo-beta")); }, [login, navigate]);
  return <p>Signing in as customer</p>;
}

const product = {
  id: productId,
  slug: "demo-beta",
  name: "Demo Capsule Beta",
  category: "Fictional demo",
  description: "Fictional catalog description.",
  dosage_form: "Capsule",
  active_ingredients: [{ name: "Sample Beta", strength_amount: "100", strength_unit: "mg" }],
  pack_quantity: 10,
  pack_unit: "capsules",
  manufacturer: "Example Labs",
  in_stock: true,
  stock_quantity: 2,
  prescription_required: true,
  selling_price: "120.00",
  mrp: "150.00",
  unit_price: "12.00",
};

function renderCustomerPage() {
  return render(<AuthProvider><MemoryRouter initialEntries={["/"]}><CartProvider><Routes>
    <Route path="/" element={<CustomerSignIn />} />
    <Route path="/catalog/:slug" element={<ProductDetailPage />} />
  </Routes></CartProvider></MemoryRouter></AuthProvider>);
}

describe("prescription workflows", () => {
  beforeEach(() => vi.stubGlobal("fetch", vi.fn()));

  it("lets a customer upload a document and displays pending review status", async () => {
    const user = userEvent.setup();
    fetch.mockImplementation(async (url, request = {}) => {
      if (url.endsWith("/auth/login")) return jsonResponse({ access_token: "customer-token", expires_in: 1800, customer: { id: "customer-id", full_name: "Demo Customer", email: "customer@example.com", phone: "+919876543210", role: "customer" } });
      if (url.endsWith("/cart")) return jsonResponse(emptyCart);
      if (url.endsWith("/catalog/demo-beta")) return jsonResponse(product);
      if (url.includes("/prescriptions?product_id=")) return jsonResponse([]);
      if (url.endsWith("/prescriptions") && request.method === "POST") {
        expect(request.body.get("product_id")).toBe(productId);
        expect(request.body.get("file").name).toBe("example.pdf");
        return jsonResponse(pendingPrescription, 201);
      }
      return jsonResponse({ detail: "Unexpected request" }, 404);
    });
    renderCustomerPage();

    const file = new File(["%PDF-1.7 sample"], "example.pdf", { type: "application/pdf" });
    await user.upload(await screen.findByLabelText(/^Prescription file/), file);
    await user.click(screen.getByRole("button", { name: "Upload for review" }));

    expect(await screen.findByText("Prescription uploaded. It is waiting for pharmacist review.")).toBeInTheDocument();
    expect(screen.getByText("pending")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Awaiting prescription review" })).toBeDisabled();
  });

  it("allows a pharmacist to review a pending submission", async () => {
    const user = userEvent.setup();
    fetch.mockImplementation(async (url, request = {}) => {
      if (url.endsWith("/auth/login")) return jsonResponse({ access_token: "pharmacist-token", expires_in: 1800, customer: { id: "staff-id", full_name: "Demo Pharmacist", email: "pharmacist@example.com", phone: "+919876543211", role: "pharmacist" } });
      if (url.endsWith("/admin/prescriptions?status=pending")) return jsonResponse({ items: [{ ...pendingPrescription, customer_id: "customer-id", customer_name: "Demo Customer", customer_email: "customer@example.com", customer_phone: "+919876543210", media_type: "application/pdf", file_size: 1500 }], total: 1, page: 1, page_size: 20 });
      if (url.endsWith(`/admin/prescriptions/${prescriptionId}/review`)) return jsonResponse({ ...pendingPrescription, status: JSON.parse(request.body).status, customer_id: "customer-id", customer_name: "Demo Customer", customer_email: "customer@example.com", customer_phone: "+919876543210", media_type: "application/pdf", file_size: 1500, reviewed_at: "2026-10-14T10:05:00Z" });
      return jsonResponse({ detail: "Unexpected request" }, 404);
    });
    renderAdminQueue();

    expect(await screen.findByText(/customer@example\.com/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Approve" }));

    expect(await screen.findByText("Prescription approved.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("No submissions in this view.")).toBeInTheDocument());
    const reviewRequest = fetch.mock.calls.find(([url, request]) => url.endsWith(`/admin/prescriptions/${prescriptionId}/review`) && request.method === "PATCH");
    expect(JSON.parse(reviewRequest[1].body)).toEqual({ status: "approved", note: "" });
  });
});
