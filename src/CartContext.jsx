import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "./AuthContext.jsx";

const CartContext = createContext(null);
const EMPTY_CART = { items: [], item_count: 0, subtotal: 0, delivery_fee: 0, estimated_total: 0, currency: "INR" };

export function CartProvider({ children }) {
  const { session, api } = useAuth();
  const [cart, setCart] = useState(EMPTY_CART);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    if (!session) {
      setCart(EMPTY_CART);
      return EMPTY_CART;
    }
    const nextCart = await api("/cart");
    setCart(nextCart);
    return nextCart;
  }, [session, api]);

  useEffect(() => {
    if (!session) {
      setCart(EMPTY_CART);
      setError("");
      setLoading(false);
      return undefined;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");
    api("/cart", { signal: controller.signal })
      .then(setCart)
      .catch((reason) => {
        if (reason.name !== "AbortError") setError(reason.message || "Your cart could not be loaded.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [session, api]);

  const setQuantity = useCallback(async (productId, quantity) => {
    const nextCart = await api("/cart/items", {
      method: "PUT",
      body: { product_id: productId, quantity },
    });
    setCart(nextCart);
    return nextCart;
  }, [api]);

  const removeItem = useCallback(async (productId) => {
    await api(`/cart/items/${productId}`, { method: "DELETE" });
    await refresh();
  }, [api, refresh]);

  const value = useMemo(
    () => ({ cart, loading, error, setError, refresh, setQuantity, removeItem }),
    [cart, loading, error, refresh, setQuantity, removeItem],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error("useCart must be used inside CartProvider");
  return context;
}
