import Link from "next/link";
import type { Course, Lesson } from "@/data/courses";
import VideoPlayer from "@/components/VideoPlayer";

export type Access = "checking" | "granted" | "login" | "verify" | "enroll" | "offline";

type Props = {
  access: Access;
  video: string | null;
  course: Course;
  lesson: Lesson;
  index: number;
  email?: string;
  resumeAt: number;
  onProgress: (seconds: number) => void;
};

// Khung trên cùng của bài học: video khi được xem, hoặc màn trạng thái (đang tải, cần đăng nhập/xác thực/ghi danh, mất kết nối, bài chưa có nội dung)
export default function LessonStage({ access, video, course, lesson, index, email, resumeAt, onProgress }: Props) {
  const next = `/learn/${course.slug}?lesson=${index}`;

  if (access === "checking") return <div className="aspect-video animate-pulse rounded-xl bg-white/10" />;

  if (access === "offline") {
    return (
      <div className="grid aspect-video place-items-center rounded-xl border border-rose-500/30 bg-rose-500/10 p-8 text-center">
        <div>
          <p className="text-5xl" aria-hidden="true">⚠️</p>
          <p className="mt-3 text-lg font-semibold">Không kết nối được máy chủ</p>
          <p className="mt-1 text-sm text-slate-300">Chưa tải được bài học. Kiểm tra kết nối mạng rồi tải lại trang; nếu vẫn lỗi, <Link href="/contact" className="font-semibold text-white underline">báo cho chúng tôi</Link>.</p>
        </div>
      </div>
    );
  }

  if (access === "verify") {
    return (
      <div className="grid aspect-video place-items-center rounded-xl border border-amber-500/30 bg-amber-500/10 p-8 text-center">
        <div>
          <p className="text-5xl" aria-hidden="true">✉️</p>
          <p className="mt-3 text-lg font-semibold">Xác thực email để tiếp tục học</p>
          <p className="mt-1 text-sm text-slate-300">Chúng tôi đã gửi mã 6 số tới {email}.</p>
          <Link href={`/verify?next=${next}`} className="btn-primary mt-4">Nhập mã xác thực</Link>
        </div>
      </div>
    );
  }

  if (access === "login" || access === "enroll") {
    return (
      <div className="grid aspect-video place-items-center rounded-xl border border-white/10 bg-white/5 p-8 text-center">
        <div>
          <p className="text-5xl" aria-hidden="true">🔒</p>
          <p className="mt-3 text-lg font-semibold">Bài học dành cho học viên đã ghi danh</p>
          {access === "login" ? (
            <Link href={`/login?next=${next}`} className="btn-primary mt-4">Đăng nhập để tiếp tục</Link>
          ) : (
            <Link href={`/courses/${course.slug}`} className="btn-primary mt-4">{course.price === 0 ? "Ghi danh miễn phí" : "Mua khóa học"}</Link>
          )}
          <p className="mt-3 text-xs text-slate-400">Bạn vẫn có thể xem các bài gắn nhãn “Xem thử” ở danh sách bên.</p>
        </div>
      </div>
    );
  }

  // access === "granted"
  if (video) return <VideoPlayer videoId={video} title={lesson.title} autoplay className="!rounded-xl" startSeconds={resumeAt} onProgress={onProgress} />;
  if (lesson.content) return null; // bài đọc: LessonContent hiển thị bên dưới tiêu đề

  if (lesson.attachments?.length) {
    return (
      <div className={`grid aspect-video place-items-center rounded-xl bg-gradient-to-br ${course.color} p-8 text-center`}>
        <div>
          <p className="text-5xl" aria-hidden="true">📚</p>
          <p className="mt-3 text-lg font-semibold text-white">Bài học dạng tài liệu</p>
          <p className="mt-1 text-sm text-white/80">Tải {lesson.attachments.length} tài liệu bên dưới để học.{lesson.quizCount ? " Làm trắc nghiệm sau khi đọc xong." : ""}</p>
        </div>
      </div>
    );
  }

  if (lesson.quizCount) return null; // chỉ có trắc nghiệm: QuizPlayer hiển thị bên dưới

  return (
    <div className={`grid aspect-video place-items-center rounded-xl bg-gradient-to-br ${course.color} p-8 text-center`}>
      <div>
        <p className="text-5xl" aria-hidden="true">📄</p>
        <p className="mt-3 text-lg font-semibold text-white">Nội dung bài này đang được cập nhật</p>
        <p className="mt-1 text-sm text-white/80">Bài chưa có video hay tài liệu. Hãy chuyển sang bài kế tiếp hoặc quay lại sau.</p>
      </div>
    </div>
  );
}
