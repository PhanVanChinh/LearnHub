import { Suspense } from "react";
import VerifyEmailForm from "@/components/VerifyEmailForm";
export const metadata = { title: "Xác thực email" };
export default function Page() {
  return <Suspense><VerifyEmailForm /></Suspense>;
}
