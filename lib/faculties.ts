// Khoa / nhóm ngành của khóa học (trường `faculty`, giá trị hợp lệ do backend/app/schemas.py:FACULTIES quy định).
// Dùng cho trang "Dành cho Phenikaa" và ô chọn khoa trong form admin.
export type Faculty = "cntt" | "kinh-te" | "co-ban" | "dai-cuong" | "chung";

export const faculties: { key: Faculty; label: string; emoji: string; subjects: string }[] = [
  { key: "cntt", label: "Công nghệ thông tin", emoji: "💻", subjects: "Lập trình C, Python, CTDL&GT, CSDL, Mạng máy tính, Hệ điều hành, Machine Learning" },
  { key: "kinh-te", label: "Kinh tế & Kinh doanh", emoji: "📈", subjects: "Kinh tế vi mô/vĩ mô, Nguyên lý kế toán, Marketing căn bản" },
  { key: "co-ban", label: "Khoa học cơ bản", emoji: "📐", subjects: "Giải tích, Đại số tuyến tính, Xác suất thống kê, Vật lý đại cương" },
  { key: "dai-cuong", label: "Đại cương", emoji: "📚", subjects: "Triết học, Kinh tế chính trị, Tư tưởng HCM, Lịch sử Đảng, Tiếng Anh B1" },
  { key: "chung", label: "Kỹ năng chung", emoji: "🧰", subjects: "AI Check bài viết, viết báo cáo thực tập, khóa luận" },
];

export const facultyLabel = (key?: string) => faculties.find((f) => f.key === key)?.label ?? "";
