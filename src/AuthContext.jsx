import { createContext, useCallback, useContext, useMemo, useState } from "react";
import { apiRequest } from "./api.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);

  const authenticate = useCallback(async (path, credentials) => {
    const result = await apiRequest(path, { method: "POST", body: credentials });
    const nextSession = {
      accessToken: result.access_token,
      expiresIn: result.expires_in,
      customer: result.customer,
    };
    setSession(nextSession);
    return result.customer;
  }, []);

  const login = useCallback((credentials) => authenticate("/auth/login", credentials), [authenticate]);
  const register = useCallback((details) => authenticate("/auth/register", details), [authenticate]);
  const logout = useCallback(() => setSession(null), []);

  const api = useCallback(async (path, options = {}) => {
    try {
      return await apiRequest(path, { ...options, token: session?.accessToken });
    } catch (error) {
      if (error.status === 401) setSession(null);
      throw error;
    }
  }, [session]);

  const updateCustomer = useCallback((customer) => {
    setSession((current) => current ? { ...current, customer } : current);
  }, []);

  const value = useMemo(
    () => ({ session, customer: session?.customer ?? null, login, register, logout, api, updateCustomer }),
    [session, login, register, logout, api, updateCustomer],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
