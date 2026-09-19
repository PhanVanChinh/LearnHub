// VAI TRÒ CỦA FILE NÀY (sau khi chuyển sang một nguồn sự thật):
//  1. Kiểu dữ liệu (Course, Lesson, Category) và danh mục dùng chung cho frontend.
//  2. Dữ liệu SEED lần đầu cho backend (scripts/export-courses.mts → backend/app/seed_data.json).
//  3. Dự phòng lúc build tĩnh khi không gọi được API (lib/courses.server.ts).
// Nguồn sự thật là DB (admin sửa qua /admin). Sửa file này KHÔNG làm đổi website đang chạy;
// muốn đổi nội dung khóa học hãy dùng trang admin rồi bấm "Xuất bản".
export type Category = "ai-check" | "pdf" | "quiz" | "free" | "source" | "video";

export const categories: { key: Category | "all"; label: string }[] = [
  { key: "all", label: "Tất cả" },
  { key: "ai-check", label: "AI Check" },
  { key: "pdf", label: "PDF" },
  { key: "quiz", label: "Trắc nghiệm" },
  { key: "free", label: "Miễn phí" },
  { key: "source", label: "Source code" },
  { key: "video", label: "Video" },
];

export type Lesson = {
  title: string;
  duration: string;
  free?: boolean; // xem thử không cần ghi danh
  video?: string; // YouTube ID (11 ký tự). CHỈ đặt cho bài free — video bài trả phí nằm ở data/videos.seed.ts
  hasVideo?: boolean; // từ API: bài (kể cả trả phí) có video hay không, không kèm ID
  quizCount?: number; // từ API: số câu trắc nghiệm của bài (0/undefined = không có). Đề và đáp án chỉ lấy qua API.
  attachments?: { name: string; kind: "file" | "link"; size: number; content_type: string }[]; // từ API: metadata, link tải lấy qua API
};

export type Course = {
  slug: string;
  title: string;
  category: Category;
  tags: Category[];
  price: number; // 0 = free
  // Lượt xem / số học viên KHÔNG nằm ở đây: lấy từ API /api/stats/courses (số thật, tăng theo hành vi người dùng)
  color: string; // gradient cho thumbnail
  emoji: string;
  short: string;
  description: string;
  includes: string[];
  lessons: Lesson[];
  featured?: boolean;
};

const base = (
  slug: string,
  title: string,
  category: Category,
  price: number,
  emoji: string,
  color: string,
  short: string,
  extra: Partial<Course> = {},
): Course => ({
  slug,
  title,
  category,
  tags: [category, ...(price === 0 ? (["free"] as Category[]) : [])],
  price,
  color,
  emoji,
  short,
  description:
    short +
    " Nội dung được biên soạn bám sát đề cương môn học, kèm ví dụ minh hoạ và phần luyện tập để bạn tự kiểm tra kiến thức.",
  includes: [
    "Truy cập trọn đời, cập nhật miễn phí",
    "Học trên mọi thiết bị",
    "Hỗ trợ giải đáp qua nhóm học tập",
  ],
  lessons: [
    { title: "Giới thiệu & cách sử dụng", duration: "05:20", free: true },
    { title: "Chương 1 — Kiến thức nền tảng", duration: "18:45" },
    { title: "Chương 2 — Nội dung trọng tâm", duration: "24:10" },
    { title: "Chương 3 — Bài tập & đề mẫu", duration: "21:30" },
    { title: "Ôn tập tổng hợp trước kỳ thi", duration: "15:00" },
  ],
  ...extra,
});

export const courses: Course[] = [
  base(
    "ai-check-dao-van-khoa-luan",
    "Gói AI Check mở rộng — Khoá luận, tiểu luận",
    "ai-check",
    20000,
    "🤖",
    "from-violet-500 to-fuchsia-600",
    "Thêm lượt rà soát dấu hiệu AI cho bài dài, phân tích theo từng phần và gợi ý chỉnh sửa. Sắp mở bán.",
    { featured: true },
  ),
  base(
    "ai-check-bao-cao-thuc-tap",
    "Gói AI Check mở rộng — Báo cáo thực tập",
    "ai-check",
    15000,
    "🧠",
    "from-indigo-500 to-violet-600",
    "Thêm lượt rà soát báo cáo thực tập theo từng chương, kèm nhận xét học thuật. Sắp mở bán.",
  ),
  base(
    "trac-nghiem-triet-hoc-mac-lenin",
    "Ngân hàng trắc nghiệm Triết học Mác – Lênin",
    "quiz",
    15000,
    "📚",
    "from-rose-500 to-orange-500",
    "Câu hỏi trắc nghiệm có đáp án và giải thích, chia theo chương, làm ngay trong bài học.",
    { featured: true },
  ),
  base(
    "trac-nghiem-kinh-te-chinh-tri",
    "Trắc nghiệm Kinh tế chính trị Mác – Lênin",
    "quiz",
    15000,
    "💹",
    "from-emerald-500 to-teal-600",
    "Bộ câu hỏi ôn thi cuối kỳ, bám sát giáo trình mới nhất.",
  ),
  base(
    "trac-nghiem-tu-tuong-ho-chi-minh",
    "Trắc nghiệm Tư tưởng Hồ Chí Minh",
    "quiz",
    15000,
    "⭐",
    "from-red-500 to-rose-600",
    "Câu hỏi luyện tập theo từng chương, chấm điểm và giải thích ngay sau khi nộp.",
  ),
  base(
    "trac-nghiem-lich-su-dang",
    "Trắc nghiệm Lịch sử Đảng Cộng sản Việt Nam",
    "quiz",
    15000,
    "🏛️",
    "from-amber-500 to-orange-600",
    "Ôn tập nhanh kiến thức trọng tâm bằng câu hỏi trắc nghiệm.",
  ),
  base(
    "trac-nghiem-mang-may-tinh",
    "Trắc nghiệm Mạng máy tính",
    "quiz",
    15000,
    "🌐",
    "from-sky-500 to-blue-600",
    "Câu hỏi về mô hình OSI, TCP/IP, định tuyến, subnet và bảo mật mạng.",
  ),
  base(
    "trac-nghiem-co-so-du-lieu",
    "Trắc nghiệm Cơ sở dữ liệu",
    "quiz",
    15000,
    "🗄️",
    "from-cyan-500 to-sky-600",
    "Đại số quan hệ, chuẩn hoá, SQL và thiết kế ERD qua 400+ câu hỏi.",
  ),
  base(
    "pdf-de-thi-giai-tich-1",
    "PDF Đề thi & lời giải Giải tích 1 (5 năm)",
    "pdf",
    15000,
    "📄",
    "from-blue-500 to-indigo-600",
    "Tổng hợp đề thi cuối kỳ các năm gần đây kèm lời giải chi tiết.",
    { featured: true },
  ),
  base(
    "pdf-de-thi-dai-so-tuyen-tinh",
    "PDF Đề thi Đại số tuyến tính",
    "pdf",
    15000,
    "📐",
    "from-teal-500 to-emerald-600",
    "Đề thi + đáp án + ghi chú các dạng bài thường gặp.",
  ),
  base(
    "pdf-tom-tat-xac-suat-thong-ke",
    "PDF Tóm tắt công thức Xác suất thống kê",
    "pdf",
    0,
    "🎲",
    "from-lime-500 to-green-600",
    "Cheatsheet 12 trang gói gọn toàn bộ công thức cần nhớ.",
  ),
  base(
    "pdf-slide-lap-trinh-c",
    "PDF Slide & bài tập Lập trình C",
    "pdf",
    0,
    "💻",
    "from-slate-600 to-slate-800",
    "Slide bài giảng và bộ bài tập có lời giải cho người mới bắt đầu.",
    {
      lessons: [
        { title: "Giới thiệu & cài đặt môi trường", duration: "05:20", free: true, video: "KJgsSFOSQv0" },
        { title: "Chương 1 — Biến, kiểu dữ liệu, toán tử", duration: "18:45" },
        { title: "Chương 2 — Cấu trúc điều khiển & vòng lặp", duration: "24:10" },
        { title: "Chương 3 — Hàm, mảng, con trỏ", duration: "21:30" },
        { title: "Bài tập tổng hợp có lời giải", duration: "15:00" },
      ],
    },
  ),
  base(
    "source-web-ban-hang-nodejs",
    "Source code Web bán hàng (Node.js + MongoDB)",
    "source",
    20000,
    "🛒",
    "from-green-500 to-emerald-700",
    "Đồ án môn Phát triển ứng dụng web: giỏ hàng, thanh toán, quản trị.",
    { featured: true },
  ),
  base(
    "source-quan-ly-sinh-vien-java",
    "Source code Quản lý sinh viên (Java Swing + MySQL)",
    "source",
    20000,
    "☕",
    "from-orange-500 to-red-600",
    "Đồ án Lập trình hướng đối tượng, có báo cáo Word đi kèm.",
  ),
  base(
    "source-app-todo-flutter",
    "Source code App ghi chú (Flutter)",
    "source",
    15000,
    "📱",
    "from-sky-400 to-indigo-500",
    "Ứng dụng di động đa nền tảng, có hướng dẫn chạy từng bước.",
  ),
  base(
    "video-lap-trinh-python-co-ban",
    "Video Lập trình Python từ 0 (12 giờ)",
    "video",
    20000,
    "🐍",
    "from-yellow-400 to-amber-600",
    "Khoá video dành cho người mới, học xong làm được mini project.",
    { featured: true },
  ),
  base(
    "video-cau-truc-du-lieu-giai-thuat",
    "Video Cấu trúc dữ liệu & Giải thuật",
    "video",
    20000,
    "🧩",
    "from-fuchsia-500 to-pink-600",
    "Giải thích trực quan bằng hình vẽ, code mẫu C++ và Python.",
  ),
  base(
    "video-nhap-mon-machine-learning",
    "Video Nhập môn Machine Learning",
    "video",
    0,
    "📈",
    "from-brand-500 to-brand-700",
    "Hồi quy, phân loại, đánh giá mô hình — thực hành với scikit-learn.",
    {
      lessons: [
        { title: "Machine Learning là gì?", duration: "07:52", free: true, video: "ukzFI9rgwfU" },
        { title: "Mạng neural hoạt động thế nào?", duration: "18:40", free: true, video: "aircAruvnKk" },
        { title: "Gradient descent — cách mô hình học", duration: "20:33" },
        { title: "Backpropagation — trực giác", duration: "12:47" },
        { title: "Backpropagation — phần tính toán", duration: "10:18" },
      ],
    },
  ),
  base(
    "pdf-de-cuong-vat-ly-dai-cuong",
    "PDF Đề cương ôn tập Vật lý đại cương",
    "pdf",
    0,
    "⚛️",
    "from-purple-500 to-indigo-600",
    "Hệ thống kiến thức theo chương, có bài tập tự luyện.",
  ),
  base(
    "trac-nghiem-tieng-anh-b1",
    "Trắc nghiệm Tiếng Anh chuẩn đầu ra B1",
    "quiz",
    0,
    "🇬🇧",
    "from-blue-400 to-cyan-500",
    "1.000 câu ngữ pháp, từ vựng và đọc hiểu theo format đề thi.",
  ),
  base(
    "pdf-huong-dan-viet-bao-cao-thuc-tap",
    "PDF Hướng dẫn viết báo cáo thực tập chuẩn form",
    "pdf",
    0,
    "📝",
    "from-stone-500 to-stone-700",
    "Template Word + checklist trình bày, trích dẫn tài liệu tham khảo.",
  ),
  base(
    "trac-nghiem-he-dieu-hanh",
    "Trắc nghiệm Hệ điều hành",
    "quiz",
    15000,
    "🖥️",
    "from-zinc-600 to-zinc-800",
    "Tiến trình, luồng, lập lịch CPU, quản lý bộ nhớ và deadlock.",
  ),
];


