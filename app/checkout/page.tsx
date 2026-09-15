import { Suspense } from "react";
import CheckoutForm from "@/components/CheckoutForm";
import { getCourses } from "@/lib/courses.server";

export const metadata = { title: "Thanh toán" };

// Trang được xuất tĩnh; tham số ?course= đọc ở client nên cần bọc Suspense.
export default async function CheckoutPage() {
  const courses = await getCourses();
  return <Suspense><CheckoutForm courses={courses} /></Suspense>;
}
