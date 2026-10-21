export const apiBase = (import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1").replace(/\/$/, "");

export async function apiRequest(path, { token, method = "GET", body, signal, headers: requestHeaders } = {}) {
  const headers = { Accept: "application/json", ...requestHeaders };
  const isFormData = typeof FormData !== "undefined" && body instanceof FormData;
  if (body !== undefined && !isFormData) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${apiBase}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    signal,
  });

  if (response.status === 204) return null;
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = payload?.detail;
    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg).join(" ")
      : typeof detail === "string" ? detail : "The request could not be completed.";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return payload;
}

export async function apiBlob(path, { token, method = "GET", signal, headers: requestHeaders } = {}) {
  const headers = { Accept: "application/octet-stream", ...requestHeaders };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${apiBase}${path}`, { method, headers, signal });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    const detail = payload?.detail;
    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg).join(" ")
      : typeof detail === "string" ? detail : "The file could not be downloaded.";
    const error = new Error(message);
    error.status = response.status;
    throw error;
  }
  return response.blob();
}
