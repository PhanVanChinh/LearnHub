import { Suspense } from "react";
import CertificateView from "@/components/CertificateView";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ path: "/certificate", title: "Chứng nhận hoàn thành", description: "Tra cứu và xác thực chứng nhận hoàn thành khóa học LearnHub bằng mã chứng nhận." });

// Xuất tĩnh: mã đọc từ ?code= ở client nên cần Suspense.
export default function CertificatePage() {
  return <Suspense><CertificateView /></Suspense>;
}
