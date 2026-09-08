import Link from "next/link";
import CourseBrowser from "@/components/CourseBrowser";
import { courses } from "@/data/courses";
import { site } from "@/lib/site";

const stats = [
  { v: `${courses.length}+`, l: "Khóa học & tài liệu" },
  { v: "5.000+", l: "Sinh viên đã học" },
  { v: "4.9/5", l: "Đánh giá trung bình" },
];

const features = [
  { icon: "🎯", t: "Bám sát chương trình", d: "Nội dung biên soạn theo đề cương từng môn, ưu tiên phần hay ra thi." },
  { icon: "⚡", t: "Học nhanh, nhớ lâu", d: "Tóm tắt ngắn gọn, câu hỏi luyện tập tính giờ và giải thích từng đáp án." },
  { icon: "🔒", t: "Thanh toán an toàn", d: "Nhận tài liệu ngay sau khi thanh toán, hoàn tiền nếu không đúng mô tả." },
];

export default function Home() {
  return (
    <>
      <section className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-indigo-700 text-white">
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-fuchsia-400/20 blur-3xl" />
        <div className="container-x relative grid items-center gap-10 py-20 lg:grid-cols-2 lg:py-28">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold backdrop-blur">
              🎓 Dành cho sinh viên {site.university}
            </span>
            <h1 className="mt-5 text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
              Khám phá các khóa học <span className="text-yellow-300">nổi bật</span>
            </h1>
            <p className="mt-5 max-w-xl text-lg text-white/85">{site.tagline}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/courses" className="btn bg-white text-brand-700 hover:bg-brand-50">Xem tất cả khóa học</Link>
              <Link href="/free" className="btn border border-white/40 text-white hover:bg-white/10">Tài liệu miễn phí →</Link>
            </div>
            <dl className="mt-10 grid grid-cols-3 gap-6 border-t border-white/20 pt-8">
              {stats.map((s) => (
                <div key={s.l}>
                  <dt className="text-2xl font-bold sm:text-3xl">{s.v}</dt>
                  <dd className="mt-1 text-sm text-white/75">{s.l}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="hidden lg:block">
            <div className="grid grid-cols-2 gap-4">
              {courses.filter((c) => c.featured).slice(0, 4).map((c, i) => (
                <Link key={c.slug} href={`/courses/${c.slug}`} className={`rounded-2xl bg-white/10 p-4 backdrop-blur transition hover:bg-white/20 ${i % 2 ? "translate-y-6" : ""}`}>
                  <div className={`grid aspect-video place-items-center rounded-xl bg-gradient-to-br ${c.color} text-4xl`}>{c.emoji}</div>
                  <p className="mt-3 line-clamp-2 text-sm font-semibold">{c.title}</p>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="container-x -mt-8 relative z-10 grid gap-4 md:grid-cols-3">
        {features.map((f) => (
          <div key={f.t} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-card">
            <div className="text-2xl">{f.icon}</div>
            <h3 className="mt-2 font-semibold text-slate-900">{f.t}</h3>
            <p className="mt-1 text-sm text-slate-600">{f.d}</p>
          </div>
        ))}
      </section>

      <section id="courses" className="container-x py-16">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 sm:text-3xl">Khóa học & tài liệu</h2>
            <p className="mt-2 text-slate-600">Chọn danh mục để lọc nhanh nội dung bạn cần.</p>
          </div>
          <Link href="/courses" className="hidden text-sm font-semibold text-brand-700 hover:underline sm:block">Xem tất cả →</Link>
        </div>
        <CourseBrowser courses={courses} pageSize={8} />
      </section>

      <section className="container-x">
        <div className="rounded-3xl bg-slate-900 px-8 py-12 text-white sm:px-12 lg:flex lg:items-center lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold sm:text-3xl">Kiểm tra đạo văn & nội dung AI trước khi nộp</h2>
            <p className="mt-2 max-w-xl text-slate-300">Tải lên khoá luận, tiểu luận hoặc báo cáo — nhận kết quả chi tiết theo từng đoạn trong vài phút.</p>
          </div>
          <Link href="/ai-check" className="btn-primary mt-6 lg:mt-0">Dùng thử AI Check</Link>
        </div>
      </section>
    </>
  );
}
