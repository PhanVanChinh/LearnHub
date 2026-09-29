import { Suspense } from "react";
import VerifyEmailForm from "@/components/VerifyEmailForm";
import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta({ path: "/verify", title: "Xác thực email", noindex: true });
export default function Page() {
  return <Suspense><VerifyEmailForm /></Suspense>;
}
