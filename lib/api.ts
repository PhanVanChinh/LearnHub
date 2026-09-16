export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "learnhub_token";
const REFRESH_KEY = "learnhub_refresh";

export type User = { id: number; email: string; full_name: string; role: "user" | "admin"; email_verified: boolean; avatar_url?: string | null; has_google?: boolean; has_password?: boolean; created_at: string;
  last_login_at?: string | null; password_changed_at?: string | null; sessions_revoked_at?: string | null };
export type VerificationStatus = { email_verified: boolean; sent: boolean; cooldown_seconds: number; mail_provider: "resend" | "console" };
export type Token = { access_token: string; refresh_token?: string | null; token_type: string; user: User };
export type AuthConfig = { captcha_enabled: boolean; mail_provider: "resend" | "console"; access_token_minutes: number; google_client_id: string };

const ls = (fn: () => string | null | void) => { try { return fn() ?? null; } catch { return null; } };
export const tokenStore = {
  get: () => (typeof window === "undefined" ? null : ls(() => localStorage.getItem(TOKEN_KEY))),
  getRefresh: () => (typeof window === "undefined" ? null : ls(() => localStorage.getItem(REFRESH_KEY))),
  set: (t: string, refresh?: string | null) => {
    ls(() => localStorage.setItem(TOKEN_KEY, t));
    if (refresh) ls(() => localStorage.setItem(REFRESH_KEY, refresh));
  },
  clear: () => { ls(() => localStorage.removeItem(TOKEN_KEY)); ls(() => localStorage.removeItem(REFRESH_KEY)); },
};

export type FieldErrors = Record<string, string>;
export class ApiError extends Error {
  constructor(public status: number, message: string, public errors: FieldErrors = {}) { super(message); }
}

let refreshing: Promise<boolean> | null = null;
/** Đổi refresh token lấy access token mới. Gộp các lần gọi đồng thời thành một. */
async function tryRefresh(): Promise<boolean> {
  const rt = tokenStore.getRefresh();
  if (!rt) return false;
  refreshing ??= (async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ refresh_token: rt }),
      });
      if (!res.ok) { tokenStore.clear(); return false; }
      const t = (await res.json()) as Token;
      tokenStore.set(t.access_token, t.refresh_token);
      return true;
    } catch { return false; } finally { refreshing = null; }
  })();
  return refreshing;
}

export async function api<T>(path: string, init: RequestInit = {}, _retried = false): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(init.headers as Record<string, string>) };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "Không kết nối được máy chủ. Backend đã chạy chưa?");
  }
  // Access token hết hạn → gia hạn bằng refresh token rồi gọi lại đúng 1 lần
  if (res.status === 401 && token && !_retried && !path.startsWith("/api/auth/refresh") && (await tryRefresh())) {
    return api<T>(path, init, true);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data.detail === "string" ? data.detail : Array.isArray(data.detail) ? data.detail[0]?.msg : "Có lỗi xảy ra";
    // Backend trả errors: [{field, msg}] cho lỗi 422 → map theo trường để form tô đỏ đúng ô
    const errors: FieldErrors = {};
    if (Array.isArray(data.errors)) for (const e of data.errors) if (e?.field && !errors[e.field]) errors[e.field] = e.msg;
    throw new ApiError(res.status, detail, errors);
  }
  return data as T;
}

export const authApi = {
  config: () => api<AuthConfig>("/api/auth/config"),
  logoutAll: () => api<Token>("/api/auth/logout-all", { method: "POST" }),
  google: (credential: string) => api<Token>("/api/auth/google", { method: "POST", body: JSON.stringify({ credential }) }),
  linkGoogle: (credential: string) => api<User>("/api/auth/google/link", { method: "POST", body: JSON.stringify({ credential }) }),
  unlinkGoogle: () => api<User>("/api/auth/google", { method: "DELETE" }),
  register: (body: { email: string; full_name: string; password: string; accept_terms: boolean; captcha_token?: string | null }) =>
    api<Token>("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    api<Token>("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => api<User>("/api/auth/me"),
  updateMe: (body: { full_name: string }) => api<User>("/api/auth/me", { method: "PATCH", body: JSON.stringify(body) }),
  verification: () => api<VerificationStatus>("/api/auth/verification"),
  resendVerification: () => api<VerificationStatus>("/api/auth/verification/resend", { method: "POST" }),
  confirmVerification: (code: string) => api<User>("/api/auth/verification/confirm", { method: "POST", body: JSON.stringify({ code }) }),
  forgotPassword: (email: string, captcha_token?: string | null) =>
    api<{ detail: string }>("/api/auth/forgot-password", { method: "POST", body: JSON.stringify({ email, captcha_token }) }),
  resetPassword: (token: string, new_password: string) =>
    api<void>("/api/auth/reset-password", { method: "POST", body: JSON.stringify({ token, new_password }) }),
  changePassword: (current_password: string, new_password: string) =>
    api<Token>("/api/auth/change-password", { method: "POST", body: JSON.stringify({ current_password, new_password }) }),
  setPassword: (new_password: string) => api<Token>("/api/auth/set-password", { method: "POST", body: JSON.stringify({ new_password }) }),
};

export type LessonOut = { title: string; duration: string; free: boolean; video: string | null; has_video: boolean };
export type CourseDetail = {
  id: number; slug: string; title: string; category: string; tags: string[]; price: number; views: number; sold: number;
  color: string; emoji: string; short: string; featured: boolean; description: string; includes: string[];
  lessons: LessonOut[]; enrolled: boolean;
};
export type CoursePublic = Omit<CourseDetail, "enrolled">;
export type LessonVideo = { index: number; title: string; video: string | null };

export type Progress = { completed: number[]; total: number; percent: number; next_index: number | null };
export type EnrolledCourse = { slug: string; title: string; progress: Progress };

export const coursesApi = {
  enroll: (slug: string) => api<CourseDetail>(`/api/courses/${slug}/enroll`, { method: "POST" }),
  detail: (slug: string) => api<CourseDetail>(`/api/courses/${slug}`),
  /** Toàn bộ khóa học dạng công khai (bản mới nhất từ DB) — dùng để làm mới danh sách đã build tĩnh */
  exportAll: () => api<CoursePublic[]>("/api/courses/export"),
  mine: () => api<EnrolledCourse[]>("/api/courses/me/enrolled"),
  progress: (slug: string) => api<Progress>(`/api/courses/${slug}/progress`),
  complete: (slug: string, index: number) => api<Progress>(`/api/courses/${slug}/lessons/${index}/complete`, { method: "PUT" }),
  uncomplete: (slug: string, index: number) => api<Progress>(`/api/courses/${slug}/lessons/${index}/complete`, { method: "DELETE" }),
  /** Video của một bài: bài free → công khai; bài khác → 401 chưa đăng nhập, 403 chưa ghi danh */
  lessonVideo: (slug: string, index: number) => api<LessonVideo>(`/api/courses/${slug}/lessons/${index}/video`),
};

// ---- Orders ----
export type OrderStatus = "pending" | "paid" | "cancelled" | "expired";
export type PaymentInfo = { bank_name: string; bank_bin: string; account_number: string; account_name: string; amount: number; content: string; qr_url: string | null };
export type Order = {
  id: number; code: string; status: OrderStatus; amount: number; payment_method: string; created_at: string; expires_at: string; paid_at: string | null;
  course_slug: string; course_title: string; course_emoji: string; course_color: string;
};
export type OrderDetail = Order & { payment: PaymentInfo | null };

export const ordersApi = {
  create: (course_slug: string) => api<OrderDetail>("/api/orders", { method: "POST", body: JSON.stringify({ course_slug }) }),
  mine: () => api<Order[]>("/api/orders/me"),
  get: (code: string) => api<OrderDetail>(`/api/orders/${encodeURIComponent(code)}`),
  cancel: (code: string) => api<OrderDetail>(`/api/orders/${encodeURIComponent(code)}/cancel`, { method: "POST" }),
};

// ---- Public stats ----
export type PublicStats = { courses: number; lessons: number; videos: number; students: number; enrollments: number; views: number };
export type CourseStats = { slug: string; views: number; students: number };

export const statsApi = {
  summary: () => api<PublicStats>("/api/stats"),
  courses: () => api<CourseStats[]>("/api/stats/courses"),
};

// ---- Admin ----
export type Lesson = { title: string; duration: string; free?: boolean; video?: string | null };
export type AdminCourse = {
  id: number; slug: string; title: string; category: string; tags: string[]; price: number; views: number; sold: number;
  color: string; emoji: string; short: string; featured: boolean; description: string; includes: string[]; lessons: Lesson[];
  enrollment_count: number;
};
export type CourseInput = Omit<AdminCourse, "id" | "tags" | "enrollment_count" | "views" | "sold"> & { tags?: string[] };
export type AdminUser = User & { is_active: boolean; enrollment_count: number };
export type AdminEnrollment = {
  id: number; user_id: number; course_id: number; created_at: string; user_email: string; course_slug: string; course_title: string;
};
export type AdminStats = {
  users: number; admins: number; courses: number; free_courses: number; paid_courses: number;
  enrollments: number; total_views: number; total_sold: number; revenue: number;
};
export type Paginated<T> = { total: number; limit: number; offset: number; items: T[] };
export type PublishStatus = { configured: boolean; repo: string; actions_url: string; site_url: string };
export type PublishResult = PublishStatus & { detail: string };

const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") s.set(k, String(v)); });
  const str = s.toString();
  return str ? `?${str}` : "";
};
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const adminApi = {
  stats: () => api<AdminStats>("/api/admin/stats"),
  publishStatus: () => api<PublishStatus>("/api/admin/publish"),
  publish: () => api<PublishResult>("/api/admin/publish", { method: "POST" }),

  courses: (params: { q?: string; category?: string; featured?: boolean; limit?: number; offset?: number } = {}) =>
    api<Paginated<AdminCourse>>(`/api/admin/courses${qs(params)}`),
  course: (id: number) => api<AdminCourse>(`/api/admin/courses/${id}`),
  createCourse: (body: CourseInput) => api<AdminCourse>("/api/admin/courses", json("POST", body)),
  updateCourse: (id: number, body: Partial<CourseInput & { views: number; sold: number }>) =>
    api<AdminCourse>(`/api/admin/courses/${id}`, json("PATCH", body)),
  deleteCourse: (id: number) => api<void>(`/api/admin/courses/${id}`, { method: "DELETE" }),

  users: (params: { q?: string; role?: "user" | "admin"; is_active?: boolean; limit?: number; offset?: number } = {}) =>
    api<Paginated<AdminUser>>(`/api/admin/users${qs(params)}`),
  createUser: (body: { email: string; full_name: string; password: string; role?: "user" | "admin"; is_active?: boolean }) =>
    api<AdminUser>("/api/admin/users", json("POST", body)),
  updateUser: (id: number, body: Partial<{ full_name: string; email: string; password: string; role: "user" | "admin"; is_active: boolean }>) =>
    api<AdminUser>(`/api/admin/users/${id}`, json("PATCH", body)),
  deleteUser: (id: number) => api<void>(`/api/admin/users/${id}`, { method: "DELETE" }),

  enrollments: (params: { user_id?: number; course_id?: number; limit?: number; offset?: number } = {}) =>
    api<Paginated<AdminEnrollment>>(`/api/admin/enrollments${qs(params)}`),
  createEnrollment: (body: { user_id: number; course_id: number }) =>
    api<AdminEnrollment>("/api/admin/enrollments", json("POST", body)),
  deleteEnrollment: (id: number) => api<void>(`/api/admin/enrollments/${id}`, { method: "DELETE" }),
};
