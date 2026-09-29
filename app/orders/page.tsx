import MyOrders from "@/components/MyOrders";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ path: "/orders", title: "Đơn hàng của tôi", noindex: true });

export default function OrdersPage() {
  return <MyOrders />;
}
