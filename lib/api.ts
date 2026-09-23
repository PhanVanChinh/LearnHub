export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const REFRESH_KEY = "learnhub_refresh";   // chỉ dùng khi backend REFRESH_TOKEN_IN_BODY=true (frontend khác site với API)
const SESSION_FLAG = "learnhub_session";   // "1" = đã đăng nhập trên trình duyệt này → lúc tải trang thử refresh bằng cookie

export type User = { id: number; email: string; full_name: string; role: "user" | "admin"; email_verified: boolean; avatar_url?: string | null; has_google?: boolean; has_password?: boolean; created_at: string;
  last_login_at?: string | null; password_changed_at?: string | null; sessions_revoked_at?: string | null };
export type VerificationStatus = { email_verified: boolean; sent: boolean; cooldown_seconds: number; mail_provider: "resend" | "console" };
export type Token = { access_token: string; refresh_token?: string | null; token_type: string; user: User };
export type AuthConfig = { captcha_enabled: boolean; mail_provider: "resend" | "console"; access_token_minutes: number; google_client_id: string };

const ls = (fn: () => string | null | void) => { try { return fn() ?? null; } catch { return null; } };
// Access token CHỈ giữ trong bộ nhớ (mất khi tải lại trang → lấy lại bằng refresh cookie httpOnly). Không còn nằm trong
// localStorage nên script lạ (XSS) không đọc được token dài hạn; refresh token nằm trong cookie httpOnly do backend đặt.
let accessToken: string | null = null;
export const tokenStore = {
  get: () => accessToken,
  /** Refresh token legacy trong localStorage — chỉ có khi backend trả nó trong JSON */
  getRefresh: () => (typeof window === "undefined" ? null : ls(() => localStorage.getItem(REFRESH_KEY))),
  hasSession: () => typeof window !== "undefined" && (ls(() => localStorage.getItem(SESSION_FLAG)) === "1" || !!tokenStore.getRefresh()),
  set: (t: string, refresh?: string | null) => {
    accessToken = t;
    ls(() => localStorage.setItem(SESSION_FLAG, "1"));
    if (refresh) ls(() => localStorage.setItem(REFRESH_KEY, refresh)); else ls(() => localStorage.removeItem(REFRESH_KEY));
  },
  clear: () => { accessToken = null; ls(() => localStorage.removeItem(REFRESH_KEY)); ls(() => localStorage.removeItem(SESSION_FLAG)); ls(() => localStorage.removeItem("learnhub_token")); },
};

export type FieldErrors = Record<string, string>;
export class ApiError extends Error {
  constructor(public status: number, message: string, public errors: FieldErrors = {}, public requestId: string | null = null) { super(message); }
}

/** Gửi lỗi JS chưa bắt về backend (→ log / Sentry). Không ném lỗi, không chờ. */
export function reportClientError(payload: { message: string; stack?: string; source?: string }) {
  try {
    void fetch(`${API_URL}/api/client-errors`, {
      method: "POST", headers: { "Content-Type": "application/json" }, keepalive: true,
      body: JSON.stringify({ ...payload, url: location.href, user_agent: navigator.userAgent }),
    });
  } catch { /* bỏ qua */ }
}

let refreshing: Promise<boolean> | null = null;
/** Lấy access token mới bằng cookie httpOnly (credentials: include) hoặc refresh token legacy. Gộp các lần gọi đồng thời. */
export async function tryRefresh(): Promise<boolean> {
  if (!tokenStore.hasSession()) return false;
  refreshing ??= (async () => {
    try {
      const rt = tokenStore.getRefresh();
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rt ? { refresh_token: rt } : {}),
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
  // FormData: để trình duyệt tự đặt Content-Type kèm boundary
  const headers: Record<string, string> = { ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }), ...(init.headers as Record<string, string>) };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, { credentials: "include", ...init, headers });
  } catch {
    throw new ApiError(0, "Không kết nối được máy chủ. Backend đã chạy chưa?");
  }
  // Access token hết hạn → gia hạn bằng refresh token rồi gọi lại đúng 1 lần
  // 401 → thử gia hạn (kể cả khi chưa có access token trong bộ nhớ, vd vừa tải lại trang) rồi gọi lại đúng 1 lần
  if (res.status === 401 && !_retried && !path.startsWith("/api/auth/refresh") && !path.startsWith("/api/auth/login") && (await tryRefresh())) {
    return api<T>(path, init, true);
  }
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const detail = typeof data.detail === "string" ? data.detail : Array.isArray(data.detail) ? data.detail[0]?.msg : "Có lỗi xảy ra";
    // Backend trả errors: [{field, msg}] cho lỗi 422 → map theo trường để form tô đỏ đúng ô
    const errors: FieldErrors = {};
    if (Array.isArray(data.errors)) for (const e of data.errors) if (e?.field && !errors[e.field]) errors[e.field] = e.msg;
    throw new ApiError(res.status, detail, errors, res.headers.get("x-request-id"));
  }
  return data as T;
}

export const authApi = {
  config: () => api<AuthConfig>("/api/auth/config"),
  logoutAll: () => api<Token>("/api/auth/logout-all", { method: "POST" }),
  /** Xoá cookie refresh trên thiết bị này */
  logout: () => api<void>("/api/auth/logout", { method: "POST" }),
  google: (credential: string) => api<Token>("/api/auth/google", { method: "POST", body: JSON.stringify({ credential }) }),
  linkGoogle: (credential: string) => api<User>("/api/auth/google/link", { method: "POST", body: JSON.stringify({ credential }) }),
  unlinkGoogle: () => api<User>("/api/auth/google", { method: "DELETE" }),
  register: (body: { email: string; full_name: string; password: string; accept_terms: boolean; captcha_token?: string | null }) =>
    api<Token>("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),
  login: (body: { email: string; password: string }) =>
    api<Token>("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),
  me: () => api<User>("/api/auth/me"),
  updateMe: (body: { full_name: string }) => api<User>("/api/auth/me", { method: "PATCH", body: JSON.stringify(body) }),
  /** Toàn bộ dữ liệu cá nhân dạng JSON (quyền truy cập dữ liệu) */
  exportData: () => api<Record<string, unknown>>("/api/account/export"),
  deleteAccount: (confirm: string, password?: string) =>
    api<void>("/api/account", { method: "DELETE", body: JSON.stringify({ confirm, password: password || null }) }),
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

export type AttachmentOut = { name: string; kind: "file" | "link"; size: number; content_type: string };
export type LessonOut = { title: string; duration: string; free: boolean; video: string | null; has_video: boolean; has_quiz: boolean; quiz_count: number; attachments: AttachmentOut[] };
export type AttachmentLink = { name: string; url: string; expires_in: number | null };
export type CourseDetail = {
  id: number; slug: string; title: string; category: string; tags: string[]; price: number; views: number; sold: number;
  color: string; emoji: string; short: string; featured: boolean; description: string; includes: string[];
  lessons: LessonOut[]; enrolled: boolean;
};
export type CoursePublic = Omit<CourseDetail, "enrolled">;
export type LessonVideo = { index: number; title: string; video: string | null };

export type QuizPublic = { index: number; title: string; pass_percent: number; total: number; questions: { q: string; options: string[] }[] };
export type QuizAnswerResult = { index: number; chosen: number | null; answer: number; correct: boolean; explain: string };
export type QuizResult = { score: number; total: number; percent: number; pass_percent: number; passed: boolean; results: QuizAnswerResult[]; saved: boolean; lesson_completed: boolean };
export type QuizAttempt = { id: number; score: number; total: number; percent: number; passed: boolean; created_at: string };
export type QuizAttempts = { count: number; best: QuizAttempt | null; last: QuizAttempt | null };

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
  /** Đề trắc nghiệm không kèm đáp án; luật truy cập như video */
  quiz: (slug: string, index: number) => api<QuizPublic>(`/api/courses/${slug}/lessons/${index}/quiz`),
  submitQuiz: (slug: string, index: number, answers: (number | null)[]) =>
    api<QuizResult>(`/api/courses/${slug}/lessons/${index}/quiz/submit`, { method: "POST", body: JSON.stringify({ answers }) }),
  quizAttempts: (slug: string, index: number) => api<QuizAttempts>(`/api/courses/${slug}/lessons/${index}/quiz/attempts`),
  /** Link tải tài liệu (URL ký 10 phút với file S3); luật truy cập như video */
  attachmentLink: (slug: string, index: number, pos: number) => api<AttachmentLink>(`/api/courses/${slug}/lessons/${index}/attachments/${pos}/download`),
};

// ---- AI Check ----
export type AiCheckStatus = { enabled: boolean; daily_limit: number; used_today: number; remaining: number; max_chars: number; min_words: number; model: string };
export type AiCheckSegment = { text: string; ai_likelihood: number; reason: string };
export type AiCheckResult = {
  ai_score: number; confidence: "low" | "medium" | "high"; verdict: string; signals: string[]; segments: AiCheckSegment[];
  suggestions: string[]; writing_feedback: string; words: number; remaining: number; daily_limit: number; model: string;
};
export const aiCheckApi = {
  status: () => api<AiCheckStatus>("/api/ai-check/status"),
  run: (text: string) => api<AiCheckResult>("/api/ai-check", { method: "POST", body: JSON.stringify({ text }) }),
};

// ---- Contact ----
export const contactApi = {
  send: (body: { name: string; email: string; subject: string; message: string; captcha_token?: string | null }) =>
    api<{ detail: string }>("/api/contact", { method: "POST", body: JSON.stringify(body) }),
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
const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") s.set(k, String(v)); });
  const str = s.toString();
  return str ? `?${str}` : "";
};

export type RatingSummary = { count: number; average: number | null; distribution: Record<string, number> };
export type CourseStats = { slug: string; views: number; students: number; rating: RatingSummary };
export type Review = { id: number; rating: number; comment: string; created_at: string; updated_at: string; user_name: string; user_initial: string; mine: boolean };
export type ReviewList = { summary: RatingSummary; total: number; items: Review[]; mine: Review | null; can_review: boolean };
export type Certificate = { code: string; holder_name: string; course_title: string; course_slug: string; lessons: number; issued_at: string; valid: boolean; verify_url: string };
export const certificatesApi = {
  issue: (slug: string) => api<Certificate>(`/api/courses/${slug}/certificate`, { method: "POST" }),
  mine: () => api<Certificate[]>("/api/certificates/me"),
  verify: (code: string) => api<Certificate>(`/api/certificates/${encodeURIComponent(code.trim().toUpperCase())}`),
};
export const reviewsApi = {
  list: (slug: string, params: { limit?: number; offset?: number } = {}) =>
    api<ReviewList>(`/api/courses/${slug}/reviews${qs(params)}`),
  upsert: (slug: string, rating: number, comment: string) =>
    api<Review>(`/api/courses/${slug}/reviews/me`, { method: "PUT", body: JSON.stringify({ rating, comment }) }),
  remove: (slug: string) => api<void>(`/api/courses/${slug}/reviews/me`, { method: "DELETE" }),
};

export const statsApi = {
  summary: () => api<PublicStats>("/api/stats"),
  courses: () => api<CourseStats[]>("/api/stats/courses"),
};

// ---- Admin ----
export type QuizQuestion = { q: string; options: string[]; answer: number; explain: string };
export type Quiz = { pass_percent: number; questions: QuizQuestion[] };
export type Attachment = { name: string; kind: "file" | "link"; key?: string | null; url?: string | null; size: number; content_type: string };
export type Lesson = { title: string; duration: string; free?: boolean; video?: string | null; quiz?: Quiz | null; attachments?: Attachment[] };
export type UploadStatus = { enabled: boolean; max_mb: number; allowed: string[] };
export type UploadOut = { key: string; name: string; size: number; content_type: string };
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
  enrollments: number; total_views: number; total_sold: number; revenue: number; paid_orders: number; pending_orders: number; new_contacts: number;
};
export type AdminContact = {
  id: number; name: string; email: string; subject: string; message: string; user_id: number | null;
  status: "new" | "replied"; created_at: string; replied_at: string | null;
};
export type AdminOrder = Order & { user_id: number; user_email: string; user_name: string; note: string | null; confirmed_by_email: string | null };
export type Paginated<T> = { total: number; limit: number; offset: number; items: T[] };
export type AdminReview = Review & { user_id: number; user_email: string; course_slug: string; course_title: string; hidden: boolean; hidden_reason: string | null };
export type AuditLog = {
  id: number; actor_id: number | null; actor_email: string | null; action: string; target_type: string; target_id: string | null;
  summary: string; detail: Record<string, unknown> | null; ip: string | null; created_at: string;
};
export type HealthConfig = {
  env: string; database: "sqlite" | "postgres";
  services: { mail: string; google_login: boolean; captcha: boolean; bank_qr: boolean; file_storage: boolean; ai_check: boolean; publish_button: boolean };
  errors: string[]; warnings: string[];
};
export type PublishStatus = { configured: boolean; repo: string; actions_url: string; site_url: string };
export type PublishResult = PublishStatus & { detail: string };

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const adminApi = {
  stats: () => api<AdminStats>("/api/admin/stats"),
  publishStatus: () => api<PublishStatus>("/api/admin/publish"),
  healthConfig: () => api<HealthConfig>("/api/health/config"),
  uploadStatus: () => api<UploadStatus>("/api/admin/uploads/status"),
  reviews: (params: { hidden?: boolean | ""; course_id?: number | ""; rating?: number | ""; q?: string; limit?: number; offset?: number } = {}) =>
    api<Paginated<AdminReview>>(`/api/admin/reviews${qs(params)}`),
  toggleReviewHidden: (id: number, reason?: string) => api<AdminReview>(`/api/admin/reviews/${id}/hide`, json("POST", { reason: reason || null })),
  upload: (file: File, course_slug: string) => {
    const fd = new FormData(); fd.append("file", file); fd.append("course_slug", course_slug);
    return api<UploadOut>("/api/admin/uploads", { method: "POST", body: fd });
  },
  deleteUpload: (key: string) => api<void>(`/api/admin/uploads?key=${encodeURIComponent(key)}`, { method: "DELETE" }),
  audit: (params: { action?: string; actor?: string; q?: string; limit?: number; offset?: number } = {}) =>
    api<Paginated<AuditLog>>(`/api/admin/audit${qs(params)}`),
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

  contacts: (params: { status?: "new" | "replied" | ""; q?: string; limit?: number; offset?: number } = {}) =>
    api<Paginated<AdminContact>>(`/api/admin/contacts${qs(params)}`),
  toggleContactReplied: (id: number) => api<AdminContact>(`/api/admin/contacts/${id}/replied`, { method: "POST" }),
  deleteContact: (id: number) => api<void>(`/api/admin/contacts/${id}`, { method: "DELETE" }),

  orders: (params: { status?: OrderStatus | ""; q?: string; limit?: number; offset?: number } = {}) =>
    api<Paginated<AdminOrder>>(`/api/admin/orders${qs(params)}`),
  confirmOrder: (id: number, note?: string) => api<AdminOrder>(`/api/admin/orders/${id}/confirm`, json("POST", { note: note || null })),
  cancelOrder: (id: number, note?: string) => api<AdminOrder>(`/api/admin/orders/${id}/cancel`, json("POST", { note: note || null })),
};
