// Centralized API client. All backend calls go through here so that base
// URL configuration, error handling, and response parsing live in one place.

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

class ApiError extends Error {
  constructor(message, status, details) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

async function request(path, options = {}) {
  const url = `${API_BASE_URL}${path}`;
  let response;

  try {
    response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      ...options,
    });
  } catch (networkErr) {
    throw new ApiError(
      "Could not reach the server. Check your connection and try again.",
      0,
      networkErr
    );
  }

  if (response.status === 204) {
    return null;
  }

  let body = null;
  try {
    body = await response.json();
  } catch {
    // No JSON body (e.g. some error responses) - leave body null
  }

  if (!response.ok) {
    const message =
      (body && (body.detail || body.message)) ||
      `Request failed with status ${response.status}`;
    throw new ApiError(
      typeof message === "string" ? message : JSON.stringify(message),
      response.status,
      body
    );
  }

  return body;
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------
export const productsApi = {
  list: () => request("/products"),
  get: (id) => request(`/products/${id}`),
  create: (data) => request("/products", { method: "POST", body: JSON.stringify(data) }),
  update: (id, data) => request(`/products/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  remove: (id) => request(`/products/${id}`, { method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// Customers
// ---------------------------------------------------------------------------
export const customersApi = {
  list: () => request("/customers"),
  get: (id) => request(`/customers/${id}`),
  create: (data) => request("/customers", { method: "POST", body: JSON.stringify(data) }),
  remove: (id) => request(`/customers/${id}`, { method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------
export const ordersApi = {
  list: () => request("/orders"),
  get: (id) => request(`/orders/${id}`),
  create: (data) => request("/orders", { method: "POST", body: JSON.stringify(data) }),
  remove: (id) => request(`/orders/${id}`, { method: "DELETE" }),
};

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export const dashboardApi = {
  summary: () => request("/dashboard/summary"),
};

export { ApiError };
