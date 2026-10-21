import { useEffect } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext.jsx";
import { CartProvider } from "./CartContext.jsx";
import { CartPage, OrderDetailPage } from "./commerce.jsx";

const customer = {
  id: "f9b26c2b-ea2d-43ec-842e-b216b3ebda28",
  full_name: "Demo Customer",
  email: "customer@example.test",
  phone: "+919876543210",
  role: "customer",
  created_at: "2026-10-13T10:00:00Z",
};
const address = {
  id: "f7a7c80a-78e5-4a11-9ef8-38f131f26559",
  label: "Home",
  recipient_name: "Demo Customer",
  phone: "+919876543210",
  address_line1: "12 Example Road",
  address_line2: null,
  city: "Pune",
  state: "Maharashtra",
  postal_code: "411001",
  country_code: "IN",
  is_default: true,
  created_at: "2026-10-13T10:00:00Z",
};
const cart = {
  items: [{
    product_id: "3656b581-4f2c-48a3-bc71-e099638646c1",
    slug: "demo-alpha",
    name: "Demo Tablet Alpha",
    manufacturer: "Example Labs (fictional)",
    dosage_form: "Tablet",
    pack_quantity: 10,
    pack_unit: "tablets",
    unit_price: "75.00",
    mrp: "100.00",
    quantity: 2,
    line_total: "150.00",
    stock_quantity: 4,
    product_active: true,
    in_stock: true,
    prescription_required: false,
  }],
  item_count: 2,
  subtotal: "150.00",
  delivery_fee: "40.00",
  estimated_total: "190.00",
  currency: "INR",
};
const order = {
  id: "fbe782a5-b09f-4097-bbb3-63eb87430c1e",
  order_number: "MC-261013-1234ABCD",
  status: "placed",
  payment_method: "cod",
  payment_status: "pending",
  currency: "INR",
  subtotal: "150.00",
  discount: "0.00",
  delivery_fee: "40.00",
  total: "190.00",
  recipient_name: address.recipient_name,
  recipient_phone: address.phone,
  address_line1: address.address_line1,
  address_line2: null,
  city: address.city,
  state: address.state,
  postal_code: address.postal_code,
  country_code: "IN",
  items: [{
    product_id: cart.items[0].product_id,
    product_name: cart.items[0].name,
    product_sku: "DEMO-ALPHA",
    dosage_form: "Tablet",
    pack_quantity: 10,
    pack_unit: "tablets",
    unit_price: "75.00",
    quantity: 2,
    line_total: "150.00",
    prescription_required: false,
  }],
  created_at: "2026-10-13T10:00:00Z",
};

function jsonResponse(payload, status = 200) {
  return { status, ok: status >= 200 && status < 300, json: async () => payload };
}

function AuthenticatedCart() {
  const { login, session } = useAuth();
  useEffect(() => {
    if (!session) login({ email: customer.email, password: "correct-horse-battery" });
  }, [login, session]);
  return session ? <CartPage /> : <p>Signing in</p>;
}

function renderCommerce(rejectCheckout = false, onlinePayment = false) {
  let placed = false;
  let cancelled = false;
  let paid = false;
  fetch.mockImplementation(async (url, options = {}) => {
    if (url.endsWith("/auth/login")) return jsonResponse({ access_token: "memory-token", expires_in: 1800, customer });
    if (url.endsWith("/customers/me/addresses")) return jsonResponse([address]);
    if (url.endsWith("/cart")) return jsonResponse(placed ? { ...cart, items: [], item_count: 0, subtotal: "0.00", delivery_fee: "0.00", estimated_total: "0.00" } : cart);
    if (url.endsWith("/orders") && options.method === "POST") {
      if (rejectCheckout) return jsonResponse({ detail: "There is not enough stock" }, 409);
      placed = true;
      return jsonResponse(order, 201);
    }
    if (url.endsWith("/payments/razorpay/create-order") && options.method === "POST") {
      if (!onlinePayment) throw new Error("Unexpected Razorpay checkout request");
      placed = true;
      return jsonResponse({
        key_id: "rzp_test_demo",
        razorpay_order_id: "order_test_12345678",
        amount: 19000,
        currency: "INR",
        order_id: order.id,
        order_number: order.order_number,
        payment_attempt_id: "d17c7dda-8a56-4a8e-85f6-34c0cb5a65f1",
        expires_at: "2026-10-13T10:30:00Z",
      }, 201);
    }
    if (url.endsWith("/payments/razorpay/verify") && options.method === "POST") {
      paid = true;
      return jsonResponse({ payment_status: "captured", order_status: "placed" });
    }
    if (url.endsWith(`/orders/${order.order_number}/cancel`) && options.method === "PATCH") {
      cancelled = true;
      return jsonResponse({ ...order, status: "cancelled" });
    }
    if (url.endsWith(`/orders/${order.order_number}`)) return jsonResponse(cancelled ? { ...order, status: "cancelled" } : paid ? { ...order, payment_method: "razorpay", payment_status: "captured" } : onlinePayment ? { ...order, payment_method: "razorpay", status: "pending_payment" } : order);
    throw new Error(`Unexpected request ${options.method ?? "GET"} ${url}`);
  });

  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={["/cart"]}>
        <CartProvider>
          <Routes>
            <Route path="/cart" element={<AuthenticatedCart />} />
            <Route path="/orders/:orderNumber" element={<OrderDetailPage />} />
          </Routes>
        </CartProvider>
      </MemoryRouter>
    </AuthProvider>,
  );
}

describe("cart checkout", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    delete window.Razorpay;
  });

  it("submits an authenticated COD demo order with a retry-safe key and shows its snapshot", async () => {
    const user = userEvent.setup();
    renderCommerce();

    const checkoutButton = await screen.findByRole("button", { name: "Place demo order" });
    await waitFor(() => expect(checkoutButton).toBeEnabled());
    await user.click(checkoutButton);

    expect(await screen.findByRole("heading", { name: order.order_number })).toBeInTheDocument();
    expect(screen.getByText("Demo Tablet Alpha")).toBeInTheDocument();
    expect(screen.getByText("This is a saved demonstration order.")).toBeInTheDocument();
    const checkoutCall = fetch.mock.calls.find(([url, options]) => url.endsWith("/orders") && options.method === "POST");
    expect(checkoutCall[1].headers.Authorization).toBe("Bearer memory-token");
    expect(checkoutCall[1].headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/i);
    expect(JSON.parse(checkoutCall[1].body)).toEqual({ address_id: address.id, payment_method: "cod" });

    vi.spyOn(window, "confirm").mockReturnValue(true);
    await user.click(screen.getByRole("button", { name: "Cancel demo order" }));
    expect(await screen.findByText("cancelled")).toBeInTheDocument();
    expect(fetch.mock.calls.some(([url, options]) => url.endsWith(`/orders/${order.order_number}/cancel`) && options.method === "PATCH")).toBe(true);
  });

  it("shows an API checkout rejection while leaving the cart visible", async () => {
    const user = userEvent.setup();
    renderCommerce(true);

    const checkoutButton = await screen.findByRole("button", { name: "Place demo order" });
    await waitFor(() => expect(checkoutButton).toBeEnabled());
    await user.click(checkoutButton);

    expect(await screen.findByRole("alert")).toHaveTextContent("There is not enough stock");
    expect(screen.getByText("Demo Tablet Alpha")).toBeInTheDocument();
  });

  it("creates a server-priced Razorpay order and verifies its callback before showing payment success", async () => {
    const user = userEvent.setup();
    window.Razorpay = class {
      constructor(options) { this.options = options; }
      on() {}
      open() {
        this.options.handler({
          razorpay_order_id: "order_test_12345678",
          razorpay_payment_id: "pay_test_12345678",
          razorpay_signature: "a".repeat(64),
        });
      }
    };
    renderCommerce(false, true);

    await screen.findByRole("combobox", { name: "Deliver to" });
    await user.selectOptions(screen.getByLabelText("Payment method"), "razorpay");
    await user.click(screen.getByRole("button", { name: "Continue to secure checkout" }));

    expect(await screen.findByText("Payment verified. Your demonstration order is confirmed.")).toBeInTheDocument();
    const createCall = fetch.mock.calls.find(([url, options]) => url.endsWith("/payments/razorpay/create-order") && options.method === "POST");
    expect(JSON.parse(createCall[1].body)).toEqual({ address_id: address.id });
    expect(createCall[1].headers["Idempotency-Key"]).toMatch(/^[0-9a-f-]{36}$/i);
    const verifyCall = fetch.mock.calls.find(([url, options]) => url.endsWith("/payments/razorpay/verify") && options.method === "POST");
    expect(JSON.parse(verifyCall[1].body)).toEqual({
      razorpay_order_id: "order_test_12345678",
      razorpay_payment_id: "pay_test_12345678",
      razorpay_signature: "a".repeat(64),
    });
  });
});
