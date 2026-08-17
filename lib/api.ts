const configuredApiBase = String(import.meta.env.VITE_API_BASE_URL ?? "").trim();

function normalizeApiBase(value: string) {
  const base = value || "/api";
  if (/^https?:\/\//i.test(base)) {
    const url = new URL(base);
    return `${url.origin}${url.pathname.replace(/\/$/, "")}`;
  }
  if (!base.startsWith("/")) throw new Error("VITE_API_BASE_URL debe ser una URL HTTP(S) o una ruta absoluta.");
  return base.replace(/\/$/, "") || "/api";
}

export const API_URL = normalizeApiBase(configuredApiBase);

export function apiUrl(path = "") {
  const suffix = path && !path.startsWith("/") ? `/${path}` : path;
  return `${API_URL}${suffix}`;
}

export async function apiRequest<T = unknown>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  if (typeof options.body === "string" && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(apiUrl(path), {
    credentials: "include",
    ...options,
    headers,
  });
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = typeof payload === "object" && payload && "error" in payload
      ? String(payload.error)
      : "La operación no se pudo completar.";
    throw new Error(message);
  }

  return payload as T;
}
