import { Suspense } from "react";
import ResetPasswordForm from "@/components/ResetPasswordForm";
import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta({ path: "/reset-password", title: "Đặt lại mật khẩu", noindex: true });
export default function Page() {
  return <Suspense><ResetPasswordForm /></Suspense>;
}
