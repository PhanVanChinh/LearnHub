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

export type LessonOut = { title: string; duration: string; free: boolean; video: string | null; has_video: boolean };
export type CourseDetail = { slug: string; title: string; price: number; enrolled: boolean; lessons: LessonOut[] };
export type LessonVideo = { index: number; title: string; video: string | null };

export type Progress = { completed: number[]; total: number; percent: number; next_index: number | null };
export type EnrolledCourse = { slug: string; title: string; progress: Progress };

export const coursesApi = {
  enroll: (slug: string) => api<CourseDetail>(`/api/courses/${slug}/enroll`, { method: "POST" }),
  detail: (slug: string) => api<CourseDetail>(`/api/courses/${slug}`),
  mine: () => api<EnrolledCourse[]>("/api/courses/me/enrolled"),
  progress: (slug: string) => api<Progress>(`/api/courses/${slug}/progress`),
  complete: (slug: string, index: number) => api<Progress>(`/api/courses/${slug}/lessons/${index}/complete`, { method: "PUT" }),
  uncomplete: (slug: string, index: number) => api<Progress>(`/api/courses/${slug}/lessons/${index}/complete`, { method: "DELETE" }),
  /** Video của một bài: bài free → công khai; bài khác → 401 chưa đăng nhập, 403 chưa ghi danh */
  lessonVideo: (slug: string, index: number) => api<LessonVideo>(`/api/courses/${slug}/lessons/${index}/video`),
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

const qs = (params: Record<string, string | number | boolean | undefined | null>) => {
  const s = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== "") s.set(k, String(v)); });
  const str = s.toString();
  return str ? `?${str}` : "";
};
const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const adminApi = {
  stats: () => api<AdminStats>("/api/admin/stats"),

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
