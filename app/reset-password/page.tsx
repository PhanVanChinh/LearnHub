import { Suspense } from "react";
import ResetPasswordForm from "@/components/ResetPasswordForm";
export const metadata = { title: "Đặt lại mật khẩu" };
export default function Page() {
  return <Suspense><ResetPasswordForm /></Suspense>;
}
