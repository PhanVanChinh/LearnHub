import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";
import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta({ path: "/register", title: "Đăng ký", description: "Tạo tài khoản LearnHub miễn phí để ghi danh khóa học, làm trắc nghiệm và lưu tiến độ." });
export default function Page() {
  return <Suspense><AuthForm mode="register" /></Suspense>;
}
