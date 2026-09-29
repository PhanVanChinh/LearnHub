import { Suspense } from "react";
import CheckoutForm from "@/components/CheckoutForm";
import { getCourses } from "@/lib/courses.server";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ path: "/checkout", title: "Thanh toán", noindex: true });

// Trang được xuất tĩnh; tham số ?course= đọc ở client nên cần bọc Suspense.
export default async function CheckoutPage() {
  const courses = await getCourses();
  return <Suspense><CheckoutForm courses={courses} /></Suspense>;
}
