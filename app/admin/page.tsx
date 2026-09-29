import AdminDashboard from "@/components/admin/AdminDashboard";
import { pageMeta } from "@/lib/seo";
export const metadata = pageMeta({ path: "/admin", title: "Quản trị", noindex: true });
export default function Page() {
  return <AdminDashboard />;
}
