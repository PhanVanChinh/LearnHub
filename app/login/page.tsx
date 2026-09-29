import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";
import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta({ path: "/login", title: "Đăng nhập", description: "Đăng nhập LearnHub để học tiếp, xem đơn hàng và nhận chứng nhận." });
export default function Page() {
  return <Suspense><AuthForm mode="login" /></Suspense>;
}
