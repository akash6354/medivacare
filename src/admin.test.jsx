import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AdminOrdersPage } from "./admin.jsx";
import { AuthProvider, useAuth } from "./AuthContext.jsx";
import { CartProvider } from "./CartContext.jsx";

const emptyCart = { items: [], item_count: 0, subtotal: "0.00", delivery_fee: "0.00", estimated_total: "0.00", currency: "INR" };
const initialOrder = {
  id: "6f8cc175-b579-4540-9af3-6a249982d882",
  order_number: "MC-261014-DEMO123456",
  status: "placed",
  payment_method: "cod",
  payment_status: "pending",
  currency: "INR",
  subtotal: "75.00",
  discount: "0.00",
  delivery_fee: "25.00",
  total: "100.00",
  customer_name: "Demo Customer",
  customer_email: "demo@example.test",
  customer_phone: "+919876543210",
  recipient_name: "Demo Customer",
  recipient_phone: "+919876543210",
  address_line1: "12 Example Road",
  address_line2: null,
  city: "Pune",
  state: "Maharashtra",
  postal_code: "411001",
  country_code: "IN",
  razorpay_order_id: null,
  razorpay_payment_id: null,
  items: [{ product_name: "Demo Tablet Alpha", product_sku: "DEMO-ALPHA", dosage_form: "Tablet", pack_quantity: 10, pack_unit: "tablets", quantity: 1, unit_price: "75.00", line_total: "75.00" }],
  created_at: "2026-10-14T10:00:00Z",
  updated_at: "2026-10-14T10:00:00Z",
};

function jsonResponse(payload, status = 200) {
  return { status, ok: status >= 200 && status < 300, json: async () => payload };
}

function SeedAdmin() {
  const { login } = useAuth();
  const navigate = useNavigate();
  useEffect(() => { login({ email: "admin@example.test", password: "admin-demo-password" }).then(() => navigate("/admin/orders")); }, [login, navigate]);
  return <p>Signing in as administrator</p>;
}

function renderAdmin() {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/"]}>
        <CartProvider>
          <Routes>
            <Route path="/" element={<SeedAdmin />} />
            <Route path="/admin/orders" element={<AdminOrdersPage />} />
            <Route path="/admin/orders/:orderNumber" element={<AdminOrdersPage />} />
          </Routes>
        </CartProvider>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("administrator order console", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  it("shows saved orders and applies a valid status change", async () => {
    const user = userEvent.setup();
    fetch.mockImplementation(async (url, request = {}) => {
      if (url.endsWith("/auth/login")) return jsonResponse({ access_token: "staff-token", expires_in: 1800, customer: { id: "staff-id", full_name: "Admin", email: "admin@example.test", phone: "+919876543219", role: "admin" } });
      if (url.endsWith("/cart")) return jsonResponse(emptyCart);
      if (url.endsWith("/admin/dashboard")) return jsonResponse({ total_orders: 1, active_orders: 1, awaiting_payment: 0, captured_sales: "0.00" });
      if (url.includes("/admin/orders?")) return jsonResponse({ items: [initialOrder], total: 1, page: 1, page_size: 20 });
      if (url.endsWith("/admin/orders/MC-261014-DEMO123456") && request.method === "PATCH") return jsonResponse({ ...initialOrder, status: JSON.parse(request.body).status, updated_at: "2026-10-14T10:05:00Z" });
      if (url.endsWith("/admin/orders/MC-261014-DEMO123456")) return jsonResponse(initialOrder);
      if (url.endsWith("/history")) return jsonResponse([]);
      return jsonResponse({ detail: "Unexpected request" }, 404);
    });
    renderAdmin();

    expect(await screen.findByText("MC-261014-DEMO123456")).toBeInTheDocument();
    expect(screen.getByText("demo@example.test")).toBeInTheDocument();
    await user.click(screen.getByRole("link", { name: "MC-261014-DEMO123456" }));
    expect(await screen.findByRole("heading", { name: "Items and totals" })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Move to"), "confirmed");
    await user.click(screen.getByRole("button", { name: "Save status" }));

    await waitFor(() => expect(screen.getByText("confirmed")).toBeInTheDocument());
    const patchRequest = fetch.mock.calls.find(([url, request]) => url.endsWith("/status") && request.method === "PATCH");
    expect(JSON.parse(patchRequest[1].body)).toEqual({ status: "confirmed" });
  });
});
