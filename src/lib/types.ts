export type Signals = {
  has_website?: boolean; reachable?: boolean; https?: boolean; mobile_friendly?: boolean; response_ms?: number;
  title?: string; description?: string; copyright_year?: number | null; has_chat?: boolean; has_booking?: boolean;
  tech?: string[]; robots_blocked?: boolean; error?: string;
};
export type Lead = {
  id: number; name: string; address: string; lat: number | null; lon: number | null; phone: string; website: string;
  email: string; socials: Record<string, string>; signals: Signals; score: number; status: string;
  ai: { summary?: string; opportunities?: string[]; services?: string[]; subject?: string; message?: string; priority?: string };
};
export type Job = {
  id: number; category: string; city: string; city_label: string; lang: string; status: "searching" | "running" | "done" | "failed";
  total: number; processed: number; is_public: boolean; created_at: string; error?: string; attempts?: number; hot?: number;
};

export async function api<T>(path: string, token: string | null, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}), ...(init.headers || {}) } });
  if (!res.ok) {
    const detail = (await res.json().catch(() => null))?.detail;
    throw Object.assign(new Error(typeof detail === "string" ? detail : `HTTP ${res.status}`), { status: res.status });
  }
  return res.json();
}
