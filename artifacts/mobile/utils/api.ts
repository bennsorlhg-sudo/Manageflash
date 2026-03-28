const BASE = "/api";

export async function apiFetch(
  path: string,
  token: string | null,
  options: RequestInit = {}
): Promise<any> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers as Record<string, string> ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "خطأ غير متوقع" }));
    throw new Error(err.error ?? err.message ?? "خطأ في الطلب");
  }
  return res.json();
}

export function apiGet(path: string, token: string | null) {
  return apiFetch(path, token);
}

export function apiPost(path: string, token: string | null, body: object) {
  return apiFetch(path, token, { method: "POST", body: JSON.stringify(body) });
}

export function apiPut(path: string, token: string | null, body: object) {
  return apiFetch(path, token, { method: "PUT", body: JSON.stringify(body) });
}

export function apiPatch(path: string, token: string | null, body: object) {
  return apiFetch(path, token, { method: "PATCH", body: JSON.stringify(body) });
}

export function apiDelete(path: string, token: string | null) {
  return apiFetch(path, token, { method: "DELETE" });
}

export const CARD_PRICES: Record<number, number> = {
  200: 180, 300: 270, 500: 450, 1000: 900,
  2000: 1800, 3000: 2700, 5000: 5000, 9000: 9000,
};

export const DENOMINATIONS = [200, 300, 500, 1000, 2000, 3000, 5000, 9000];

export function formatCurrency(n: number | string) {
  return Number(n).toLocaleString("ar-SA") + " ر.س";
}

export function formatDate(d: string | Date) {
  return new Date(d).toLocaleDateString("ar-SA", {
    year: "numeric", month: "short", day: "numeric",
  });
}

export function formatDateTime(d: string | Date) {
  return new Date(d).toLocaleString("ar-SA", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}
