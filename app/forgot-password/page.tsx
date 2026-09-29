import ForgotPasswordForm from "@/components/ForgotPasswordForm";
import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta({ path: "/forgot-password", title: "Quên mật khẩu", description: "Nhận liên kết đặt lại mật khẩu LearnHub qua email." });
export default function Page() {
  return <ForgotPasswordForm />;
}
