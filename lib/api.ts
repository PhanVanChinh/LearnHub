export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "learnhub_token";

export type User = { id: number; email: string; full_name: string; role: "user" | "admin"; created_at: string };
export type Token = { access_token: string; token_type: string; user: User };

export const tokenStore = {
  get: () => (typeof window === "undefined" ? null : localStorage.getItem(TOKEN_KEY)),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(init.headers as Record<string, string>) };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "Không kết nối được máy chủ. Backend đã chạy chưa?");
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data.detail === "string" ? data.detail : Array.isArray(data.detail) ? data.detail[0]?.msg : "Có lỗi xảy ra";
    throw new ApiError(res.status, detail);
  }
  return data as T;
}

export const authApi = {
  register: (body: { email: string; full_name: string; password: string }) =>
    api<Token>("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    api<Token>("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => api<User>("/api/auth/me"),
};

export const coursesApi = {
  enroll: (slug: string) => api<{ enrolled: boolean }>(`/api/courses/${slug}/enroll`, { method: "POST" }),
  detail: (slug: string) => api<{ enrolled: boolean }>(`/api/courses/${slug}`),
  mine: () => api<{ slug: string; title: string }[]>("/api/courses/me/enrolled"),
};
