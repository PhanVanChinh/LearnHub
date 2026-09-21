import { Suspense } from "react";
import CertificateView from "@/components/CertificateView";

export const metadata = { title: "Chứng nhận hoàn thành" };

// Xuất tĩnh: mã đọc từ ?code= ở client nên cần Suspense.
export default function CertificatePage() {
  return <Suspense><CertificateView /></Suspense>;
}
