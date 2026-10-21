import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect, useState } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext.jsx";
import { CartProvider } from "./CartContext.jsx";
import { LoginPage, ProfilePage, RegisterPage } from "./account.jsx";

const customer = {
  id: "f9b26c2b-ea2d-43ec-842e-b216b3ebda28",
  full_name: "Demo Customer",
  email: "customer@example.test",
  phone: "+919876543210",
  role: "customer",
  created_at: "2026-10-13T10:00:00Z",
};

function jsonResponse(payload, status = 200) {
  return { status, ok: status >= 200 && status < 300, json: async () => payload };
}

const emptyCart = { items: [], item_count: 0, subtotal: "0.00", delivery_fee: "0.00", estimated_total: "0.00", currency: "INR" };

function renderAt(path, element) {
  return render(
    <AuthProvider>
      <MemoryRouter initialEntries={[path]}>
        <CartProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/account" element={element ?? <ProfilePage />} />
          </Routes>
        </CartProvider>
      </MemoryRouter>
    </AuthProvider>,
  );
}

function ProtectedProbe() {
  const { api } = useAuth();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    api("/customers/me").then(() => setLoaded(true));
  }, [api]);

  return <p>{loaded ? "Protected profile loaded" : "Loading protected profile"}</p>;
}

describe("customer account pages", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    localStorage.clear();
  });

  it("shows a clear sign-in error when credentials are rejected", async () => {
    const user = userEvent.setup();
    fetch.mockResolvedValue(jsonResponse({ detail: "Email or password is incorrect" }, 401));
    renderAt("/login");

    await user.type(screen.getByLabelText("Email address"), customer.email);
    await user.type(screen.getByLabelText("Password"), "not-the-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect");
  });

  it("registers a customer without persisting the access token in browser storage", async () => {
    const user = userEvent.setup();
    fetch.mockImplementation(async (url) => url.endsWith("/auth/register")
      ? jsonResponse({ access_token: "test-memory-token", token_type: "bearer", expires_in: 1800, customer }, 201)
      : jsonResponse(emptyCart));
    renderAt("/register", <p>Account home</p>);

    await user.type(screen.getByLabelText("Full name"), customer.full_name);
    await user.type(screen.getByLabelText("Email address"), customer.email);
    await user.type(screen.getByLabelText("Phone number"), customer.phone);
    await user.type(screen.getByLabelText("Password"), "correct-horse-battery");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    expect(await screen.findByText("Account home")).toBeInTheDocument();
    const [, request] = fetch.mock.calls.find(([url]) => url.endsWith("/auth/register"));
    expect(JSON.parse(request.body)).not.toHaveProperty("role");
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
  });

  it("redirects unauthenticated visitors from the profile to sign in", async () => {
    renderAt("/account");

    await waitFor(() => expect(screen.getByRole("heading", { name: "Sign in to your account" })).toBeInTheDocument());
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends the in-memory bearer token with protected profile requests", async () => {
    const user = userEvent.setup();
    fetch.mockImplementation(async (url) => {
      if (url.endsWith("/auth/register")) return jsonResponse({ access_token: "test-memory-token", expires_in: 1800, customer }, 201);
      if (url.endsWith("/customers/me")) return jsonResponse(customer);
      if (url.endsWith("/cart")) return jsonResponse(emptyCart);
      throw new Error(`Unexpected request ${url}`);
    });
    renderAt("/register", <ProtectedProbe />);

    await user.type(screen.getByLabelText("Full name"), customer.full_name);
    await user.type(screen.getByLabelText("Email address"), customer.email);
    await user.type(screen.getByLabelText("Phone number"), customer.phone);
    await user.type(screen.getByLabelText("Password"), "correct-horse-battery");
    await user.click(screen.getByRole("button", { name: "Create account" }));

    await waitFor(() => expect(screen.getByText("Protected profile loaded")).toBeInTheDocument());
    const profileCall = fetch.mock.calls.find(([url]) => url.endsWith("/customers/me"));
    expect(profileCall[1].headers.Authorization).toBe("Bearer test-memory-token");
  });
});
