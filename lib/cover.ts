import { API_URL } from "./api";

/** Ảnh bìa khóa học: URL ngoài dùng thẳng; key S3 (covers/...) đi qua backend /api/media (bucket không cần public). */
export const coverUrl = (cover?: string | null): string | null =>
  !cover ? null : /^https?:\/\//.test(cover) ? cover : `${API_URL}/api/media/${cover.replace(/^\/+/, "")}`;
