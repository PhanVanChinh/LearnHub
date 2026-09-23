import Link from "next/link";
import CourseBrowser from "@/components/CourseBrowser";
import HeroStats from "@/components/HeroStats";
import { getCourses } from "@/lib/courses.server";
import { site } from "@/lib/site";
import { absUrl } from "@/lib/seo";

const features = [
  { icon: "🎯", t: "Bám sát chương trình", d: "Nội dung biên soạn theo đề cương từng môn, ưu tiên phần hay ra thi." },
  { icon: "⚡", t: "Học nhanh, nhớ lâu", d: "Video ngắn gọn, trắc nghiệm ngay trong bài với giải thích từng đáp án và theo dõi tiến độ." },
  { icon: "🔒", t: "Thanh toán minh bạch", d: "Chuyển khoản QR, mở khóa ngay khi xác nhận. Hoàn tiền theo chính sách công khai." },
];

export default async function Home() {
  const courses = await getCourses();
  const jsonLd = {
    "@context": "https://schema.org", "@type": "EducationalOrganization", name: site.name, url: absUrl("/"), description: site.description,
    email: site.contact.email, telephone: site.contact.phone, address: { "@type": "PostalAddress", addressLocality: site.contact.address, addressCountry: "VN" },
  };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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
            <HeroStats courses={courses.length} lessons={courses.reduce((s, c) => s + c.lessons.length, 0)} free={courses.filter((c) => c.price === 0).length} />
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
            <h2 className="text-2xl font-bold sm:text-3xl">Rà soát dấu hiệu AI trong bài viết trước khi nộp</h2>
            <p className="mt-2 max-w-xl text-slate-300">Dán tiểu luận, báo cáo hoặc khoá luận — nhận điểm ước lượng, đoạn đáng chú ý và gợi ý chỉnh sửa trong khoảng một phút.</p>
          </div>
          <Link href="/ai-check" className="btn-primary mt-6 lg:mt-0">Dùng thử AI Check</Link>
        </div>
      </section>
    </>
  );
}
