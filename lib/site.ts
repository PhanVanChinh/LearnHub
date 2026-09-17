// Đổi thương hiệu ở đây — toàn bộ site đọc từ file này.
export const site = {
    name: "LearnHub",
    tagline:
        "Học hiệu quả, dễ dàng cùng nội dung bám sát chương trình trên lớp.",
    description:
        "Nền tảng học tập online dành cho sinh viên: video bài giảng, tài liệu, source code và ngân hàng câu hỏi trắc nghiệm.",
    university: "Phenikaa",
    contact: {
        address: "Hà Nội, Việt Nam",
        phone: "0886876079",
        email: "phanvanchinh32@gmail.com",
        facebook: "https://facebook.com",
    },
    nav: [
        { href: "/free", label: "Tài liệu miễn phí" },
        { href: "/courses", label: "Tất cả khóa học" },
        { href: "/ai-check", label: "AI Check bài viết" },
        { href: "/phenikaa", label: "Dành cho Phenikaa" },
        { href: "/contact", label: "Liên hệ" },
    ],
    footerLinks: [
        { href: "/policy/terms", label: "Điều khoản sử dụng" },
        { href: "/policy/privacy", label: "Chính sách bảo mật" },
        { href: "/policy/payment", label: "Chính sách thanh toán" },
        { href: "/policy/delivery", label: "Chính sách giao nhận" },
        { href: "/policy/refund", label: "Chính sách hoàn tiền" },
    ],
};

/** Danh mục chưa mở bán: hiện "Sắp mở bán", không tạo được đơn. Gói AI Check chờ cơ chế cấp lượt theo gói. */
export const comingSoonCategories: string[] = ["ai-check"];
export const isComingSoon = (category: string) => comingSoonCategories.includes(category);

export const formatVND = (n: number) =>
    n === 0 ? "Miễn phí" : n.toLocaleString("vi-VN") + "đ";
