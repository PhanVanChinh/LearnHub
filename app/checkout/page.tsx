import { Suspense } from "react";
import CheckoutForm from "@/components/CheckoutForm";

export const metadata = { title: "Thanh toán" };

// Trang được xuất tĩnh; tham số ?course= đọc ở client nên cần bọc Suspense.
export default function CheckoutPage() {
  return <Suspense><CheckoutForm /></Suspense>;
}
