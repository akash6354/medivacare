import { useEffect, useRef, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "./AuthContext.jsx";
import { useCart } from "./CartContext.jsx";
import { BrandMark } from "./Brand.jsx";
import "./commerce.css";

const money = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });

function createIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (character) => {
    const value = Math.floor(Math.random() * 16);
    return (character === "x" ? value : (value & 0x3) | 0x8).toString(16);
  });
}

let razorpaySdkPromise;
function loadRazorpaySdk() {
  if (window.Razorpay) return Promise.resolve();
  if (!razorpaySdkPromise) {
    razorpaySdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => window.Razorpay ? resolve() : reject(new Error("Razorpay Checkout did not load."));
      script.onerror = () => reject(new Error("Razorpay Checkout could not be loaded. Check your connection and retry."));
      document.head.appendChild(script);
    }).catch((error) => {
      razorpaySdkPromise = null;
      throw error;
    });
  }
  return razorpaySdkPromise;
}

async function launchRazorpayCheckout(checkout, callbacks) {
  await loadRazorpaySdk();
  const instance = new window.Razorpay({
    key: checkout.key_id,
    amount: checkout.amount,
    currency: checkout.currency,
    name: "MedivaCare",
    description: `Demonstration order ${checkout.order_number}`,
    order_id: checkout.razorpay_order_id,
    handler: callbacks.onSuccess,
    modal: { ondismiss: callbacks.onDismiss },
    theme: { color: "#34775b" },
  });
  instance.on("payment.failed", (response) => callbacks.onFailure(response?.error?.description));
  instance.open();
}

function CommerceFrame({ children }) {
  const { cart } = useCart();
  return (
    <div className="commerce-page">
      <header className="commerce-header">
        <BrandMark />
        <nav aria-label="Account navigation">
          <Link to="/catalog">Catalog</Link>
          <Link to="/orders">Orders</Link>
          <Link className="commerce-cart-link" to="/cart">Cart <span>{cart.item_count}</span></Link>
          <Link to="/account">Account</Link>
        </nav>
      </header>
      <main className="commerce-main">{children}</main>
      <footer className="commerce-footer">College project demonstration. No real medicine is sold or dispensed.</footer>
    </div>
  );
}

function PageNotice({ children, tone = "error" }) {
  return children ? <p className={`commerce-notice commerce-notice--${tone}`} role={tone === "error" ? "alert" : "status"}>{children}</p> : null;
}

function OrderTotals({ order }) {
  return (
    <dl className="commerce-totals">
      <div><dt>Items</dt><dd>{money.format(Number(order.subtotal))}</dd></div>
      <div><dt>Discount</dt><dd>−{money.format(Number(order.discount ?? 0))}</dd></div>
      <div><dt>Delivery</dt><dd>{Number(order.delivery_fee) === 0 ? "Free" : money.format(Number(order.delivery_fee))}</dd></div>
      <div className="commerce-total"><dt>Total</dt><dd>{money.format(Number(order.total ?? order.estimated_total ?? 0))}</dd></div>
    </dl>
  );
}

export function CartPage() {
  const { session, api } = useAuth();
  const { cart, loading, error, setError, setQuantity, removeItem, refresh } = useCart();
  const [addresses, setAddresses] = useState([]);
  const [addressId, setAddressId] = useState("");
  const [addressError, setAddressError] = useState("");
  const [busyProduct, setBusyProduct] = useState("");
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cod");
  const idempotencyKey = useRef(null);
  if (!idempotencyKey.current) idempotencyKey.current = createIdempotencyKey();
  const navigate = useNavigate();
  const unusableItems = cart.items.filter((item) => !item.product_active || !item.in_stock || (item.prescription_required && !item.prescription_approved));

  useEffect(() => {
    if (!session) return undefined;
    const controller = new AbortController();
    api("/customers/me/addresses", { signal: controller.signal })
      .then((result) => {
        setAddresses(result);
        setAddressId(result.find((address) => address.is_default)?.id ?? result[0]?.id ?? "");
      })
      .catch((reason) => {
        if (reason.name !== "AbortError") setAddressError(reason.message || "Saved addresses could not be loaded.");
      });
    return () => controller.abort();
  }, [session, api]);

  if (!session) return <Navigate to="/login?next=%2Fcart" replace />;

  async function changeQuantity(item, quantity) {
    setBusyProduct(item.product_id);
    setError("");
    try {
      await setQuantity(item.product_id, quantity);
    } catch (reason) {
      setError(reason.message || "Cart quantity could not be updated.");
    } finally {
      setBusyProduct("");
    }
  }

  async function deleteItem(item) {
    setBusyProduct(item.product_id);
    setError("");
    try {
      await removeItem(item.product_id);
    } catch (reason) {
      setError(reason.message || "This item could not be removed.");
    } finally {
      setBusyProduct("");
    }
  }

  async function placeOrder(event) {
    event.preventDefault();
    setCheckoutError("");
    setCheckoutBusy(true);
    let onlineOrder;
    try {
      if (paymentMethod === "cod") {
        const order = await api("/orders", {
          method: "POST",
          headers: { "Idempotency-Key": idempotencyKey.current },
          body: { address_id: addressId, payment_method: "cod" },
        });
        await refresh();
        navigate(`/orders/${order.order_number}`, { replace: true });
        return;
      }

      onlineOrder = await api("/payments/razorpay/create-order", {
        method: "POST",
        headers: { "Idempotency-Key": idempotencyKey.current },
        body: { address_id: addressId },
      });
      await refresh();
      await launchRazorpayCheckout(onlineOrder, {
        onSuccess: async (response) => {
          try {
            await api("/payments/razorpay/verify", {
              method: "POST",
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
            });
          } catch (reason) {
            setCheckoutError(reason.message || "Payment status could not be confirmed yet.");
          }
          navigate(`/orders/${onlineOrder.order_number}`, { replace: true });
        },
        onFailure: (message) => setCheckoutError(message || "Payment was not completed. You can retry from the order page."),
        onDismiss: () => navigate(`/orders/${onlineOrder.order_number}`, { replace: true }),
      });
    } catch (reason) {
      setCheckoutError(reason.message || "Your order could not be placed.");
      if (onlineOrder) navigate(`/orders/${onlineOrder.order_number}`, { replace: true });
    } finally {
      setCheckoutBusy(false);
    }
  }

  return (
    <CommerceFrame>
      <div className="commerce-heading">
        <span className="commerce-kicker">YOUR BASKET</span>
        <h1>Shopping cart</h1>
        <p>Review your fictional demonstration items and choose how to complete this order.</p>
      </div>
      <PageNotice>{error}</PageNotice>
      {loading ? <div className="commerce-skeleton" aria-label="Loading cart" /> : cart.items.length === 0 ? (
        <section className="commerce-empty"><strong>Your cart is empty</strong><span>Explore the fictional catalog to add a demonstration item.</span><Link className="commerce-primary" to="/catalog">Browse catalog</Link></section>
      ) : (
        <div className="cart-layout">
          <section className="cart-panel" aria-label="Cart items">
            {cart.items.map((item) => (
              <article className="cart-item" key={item.product_id}>
                <div className="cart-item-art" aria-hidden="true"><span className="demo-capsule"><i /></span></div>
                <div className="cart-item-content">
                  <div className="cart-item-heading"><div><span className="commerce-kicker">SYNTHETIC DEMO</span><h2>{item.name}</h2><p>{item.dosage_form} · {item.pack_quantity} {item.pack_unit} · {item.manufacturer}</p></div><strong>{money.format(Number(item.line_total))}</strong></div>
                  {!item.product_active && <p className="cart-item-warning">This listing is no longer active.</p>}
                  {item.product_active && !item.in_stock && <p className="cart-item-warning">Only {item.stock_quantity} units are currently available. Update or remove this item.</p>}
                  {item.prescription_required && !item.prescription_approved && <p className="cart-item-warning">An approved prescription for this listing is required before checkout.</p>}
                  <div className="cart-item-actions">
                    <div className="quantity-control" aria-label={`Quantity for ${item.name}`}>
                      <button type="button" aria-label={`Decrease ${item.name} quantity`} disabled={busyProduct === item.product_id || item.quantity <= 1} onClick={() => changeQuantity(item, item.quantity - 1)}>−</button>
                      <span>{item.quantity}</span>
                      <button type="button" aria-label={`Increase ${item.name} quantity`} disabled={busyProduct === item.product_id || item.quantity >= item.stock_quantity || item.quantity >= 20} onClick={() => changeQuantity(item, item.quantity + 1)}>+</button>
                    </div>
                    <button className="commerce-text-button" type="button" disabled={busyProduct === item.product_id} onClick={() => deleteItem(item)}>Remove</button>
                    <span>Unit price {money.format(Number(item.unit_price))}</span>
                  </div>
                </div>
              </article>
            ))}
            <Link className="commerce-back-link" to="/catalog">← Continue browsing</Link>
          </section>

          <aside className="checkout-panel">
            <span className="commerce-kicker">DEMO CHECKOUT</span>
            <h2>Order summary</h2>
            <OrderTotals order={cart} />
            {unusableItems.length > 0 && <p className="cart-blocked-note">Resolve unavailable items and prescription review before checkout.</p>}
            {addresses.length === 0 ? (
              <div className="checkout-address-empty"><p>{addressError || "Add a delivery address to place an order."}</p><Link to="/account">Manage addresses</Link></div>
            ) : (
              <form className="checkout-form" onSubmit={placeOrder}>
                <label htmlFor="checkout-address">Deliver to</label>
                <select id="checkout-address" value={addressId} onChange={(event) => setAddressId(event.target.value)} required>
                  {addresses.map((address) => <option key={address.id} value={address.id}>{address.label} · {address.city}, {address.postal_code}</option>)}
                </select>
                <label htmlFor="checkout-payment">Payment method</label>
                <select id="checkout-payment" value={paymentMethod} onChange={(event) => setPaymentMethod(event.target.value)}>
                  <option value="cod">Cash on delivery (local demo)</option>
                  <option value="razorpay">Razorpay online checkout</option>
                </select>
                <PageNotice>{checkoutError}</PageNotice>
                <button className="commerce-primary commerce-place-order" type="submit" disabled={checkoutBusy || unusableItems.length > 0 || !addressId}>{checkoutBusy ? "Starting checkout…" : paymentMethod === "cod" ? "Place demo order" : "Continue to secure checkout"}</button>
              </form>
            )}
            <p className="checkout-disclaimer">COD is stored locally. Online checkout uses your configured Razorpay account and its enabled methods. This demonstration does not arrange medicine delivery.</p>
          </aside>
        </div>
      )}
    </CommerceFrame>
  );
}

function OrderSummary({ order, onRefresh }) {
  return (
    <>
      <section className="order-panel">
        <div className="order-section-heading"><div><span className="commerce-kicker">ITEMS</span><h2>Order contents</h2></div><span className="order-status">{order.status.replaceAll("_", " ")}</span></div>
        {order.items.map((item) => <div className="order-line" key={`${item.product_sku}-${item.product_name}`}><div><strong>{item.product_name}</strong><span>{item.dosage_form} · {item.pack_quantity} {item.pack_unit} × {item.quantity}</span></div><span>{money.format(Number(item.line_total))}</span></div>)}
        <OrderTotals order={order} />
      </section>
      <section className="order-panel">
        <span className="commerce-kicker">DELIVERY SNAPSHOT</span>
        <h2>{order.recipient_name}</h2>
        <p>{order.recipient_phone}<br />{order.address_line1}{order.address_line2 ? `, ${order.address_line2}` : ""}<br />{order.city}, {order.state} {order.postal_code}</p>
      </section>
      <section className="order-panel delivery-tracking"><div className="order-section-heading"><div><span className="commerce-kicker">DELIVERY TRACKING</span><h2>{order.delivery ? order.delivery.tracking_number : "Tracking timeline"}</h2></div><button type="button" className="commerce-text-button" onClick={onRefresh}>Refresh</button></div>
        {order.delivery ? <><p>{order.delivery.carrier_name} · {order.delivery.courier_name} · {order.delivery.status.replaceAll("_", " ")}</p><ol className="delivery-events">{order.delivery.events.map((event) => <li key={event.id}><strong>{event.status.replaceAll("_", " ")}</strong><span>{new Date(event.created_at).toLocaleString()}</span>{event.note && <small>{event.note}</small>}</li>)}</ol></> : <p>A delivery has not been assigned yet. Tracking updates will appear here when available.</p>}
      </section>
    </>
  );
}

export function OrderListPage() {
  const { session, api } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!session) return undefined;
    const controller = new AbortController();
    api("/orders", { signal: controller.signal })
      .then((page) => setOrders(page.items))
      .catch((reason) => { if (reason.name !== "AbortError") setError(reason.message || "Order history could not be loaded."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [session, api]);

  if (!session) return <Navigate to="/login?next=%2Forders" replace />;
  return (
    <CommerceFrame>
      <div className="commerce-heading"><span className="commerce-kicker">YOUR ACCOUNT</span><h1>Order history</h1><p>Review the demonstration orders saved to your account.</p></div>
      <PageNotice>{error}</PageNotice>
      {loading ? <div className="commerce-skeleton" aria-label="Loading orders" /> : orders.length === 0 ? (
        <section className="commerce-empty"><strong>No orders yet</strong><span>Placed demonstration orders will appear here.</span><Link className="commerce-primary" to="/catalog">Explore catalog</Link></section>
      ) : <div className="order-list">{orders.map((order) => <article className="order-list-card" key={order.id}><div><span className="commerce-kicker">{order.order_number}</span><h2>{order.items.map((item) => item.product_name).join(", ")}</h2><p>{new Date(order.created_at).toLocaleString()} · {order.items.reduce((count, item) => count + item.quantity, 0)} items</p></div><div><strong>{money.format(Number(order.total))}</strong><span className="order-status">{order.status.replaceAll("_", " ")}</span></div><Link className="commerce-text-button" to={`/orders/${order.order_number}`}>View order →</Link></article>)}</div>}
    </CommerceFrame>
  );
}

export function OrderDetailPage() {
  const { orderNumber } = useParams();
  const { session, api } = useAuth();
  const { refresh } = useCart();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);

  useEffect(() => {
    if (!session) return undefined;
    const controller = new AbortController();
    api(`/orders/${encodeURIComponent(orderNumber)}`, { signal: controller.signal })
      .then(setOrder)
      .catch((reason) => { if (reason.name !== "AbortError") setError(reason.message || "Order details could not be loaded."); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [session, api, orderNumber]);

  if (!session) return <Navigate to={`/login?next=${encodeURIComponent(`/orders/${orderNumber}`)}`} replace />;

  async function cancelOrder() {
    if (!window.confirm("Cancel this saved demonstration order?")) return;
    setError("");
    setCancelBusy(true);
    try {
      setOrder(await api(`/orders/${encodeURIComponent(orderNumber)}/cancel`, { method: "PATCH" }));
    } catch (reason) {
      setError(reason.message || "This order could not be cancelled.");
    } finally {
      setCancelBusy(false);
    }
  }

  async function refreshOrder() {
    try { setOrder(await api(`/orders/${encodeURIComponent(orderNumber)}`)); setError(""); }
    catch (reason) { setError(reason.message || "Tracking could not be refreshed."); }
  }

  async function resumePayment() {
    setError("");
    setPaymentBusy(true);
    try {
      const checkout = await api(`/payments/razorpay/orders/${encodeURIComponent(orderNumber)}/retry`, { method: "POST" });
      await launchRazorpayCheckout(checkout, {
        onSuccess: async (response) => {
          try {
            await api("/payments/razorpay/verify", {
              method: "POST",
              body: {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              },
            });
            setOrder(await api(`/orders/${encodeURIComponent(orderNumber)}`));
          } catch (reason) {
            setError(reason.message || "Payment status could not be confirmed yet. Refresh this order shortly.");
          }
        },
        onFailure: (message) => setError(message || "Payment was not completed. You can safely retry."),
        onDismiss: () => api(`/orders/${encodeURIComponent(orderNumber)}`).then(setOrder).catch(() => {}),
      });
    } catch (reason) {
      setError(reason.message || "Online checkout could not be opened.");
      try {
        setOrder(await api(`/orders/${encodeURIComponent(orderNumber)}`));
        await refresh();
      } catch {
        // Keep the existing order snapshot visible if refresh is also unavailable.
      }
    } finally {
      setPaymentBusy(false);
    }
  }

  return (
    <CommerceFrame>
      <div className="commerce-heading"><span className="commerce-kicker">ORDER DETAILS</span><h1>{order ? order.order_number : "Your order"}</h1><p>{order?.payment_method === "razorpay" ? "Razorpay online payment" : "Cash on delivery"} · Payment status: {order?.payment_status ?? "pending"}</p></div>
      {order?.payment_status === "captured" && <PageNotice tone="success">Payment verified. Your demonstration order is confirmed.</PageNotice>}
      <PageNotice>{error}</PageNotice>
      {loading ? <div className="commerce-skeleton" aria-label="Loading order" /> : order && <div className="order-detail-layout"><OrderSummary order={order} onRefresh={refreshOrder} /><section className="order-panel order-next-steps"><strong>This is a saved demonstration order.</strong><span>No real medicine sale or delivery is taking place.</span>{order.payment_status === "authorized" && <span>Payment is authorized but not captured. The order cannot proceed until capture is confirmed.</span>}{order.payment_status === "failed" && <span>Payment failed. You can safely retry checkout while this order is still pending.</span>}{order.status === "pending_payment" && order.payment_method === "razorpay" && order.payment_status !== "authorized" && <button type="button" className="commerce-primary" onClick={resumePayment} disabled={paymentBusy}>{paymentBusy ? "Opening checkout…" : order.payment_status === "failed" ? "Retry online payment" : "Continue to payment"}</button>}{order.status === "placed" && order.payment_method === "cod" && <button type="button" className="commerce-text-button" onClick={cancelOrder} disabled={cancelBusy}>{cancelBusy ? "Cancelling…" : "Cancel demo order"}</button>}<Link to="/orders">Back to order history</Link></section></div>}
    </CommerceFrame>
  );
}
