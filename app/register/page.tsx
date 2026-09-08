import { Suspense } from "react";
import AuthForm from "@/components/AuthForm";
export const metadata = { title: "Đăng ký" };
export default function Page() {
  return <Suspense><AuthForm mode="register" /></Suspense>;
}
