import AccountView from "@/components/account/AccountView";
import { pageMeta } from "@/lib/seo";

export const metadata = pageMeta({ path: "/account", title: "Tài khoản", noindex: true });

export default function AccountPage() {
  return <AccountView />;
}
