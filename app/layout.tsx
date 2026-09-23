import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { site } from "@/lib/site";
import { SITE_ORIGIN, absUrl } from "@/lib/seo";
import { AuthProvider } from "@/components/AuthProvider";
import VerifyBanner from "@/components/VerifyBanner";
import ErrorReporter from "@/components/ErrorReporter";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: { default: `${site.name} — Học tập online cho sinh viên`, template: `%s | ${site.name}` },
  description: site.description,
  applicationName: site.name,
  keywords: ["khóa học online", "sinh viên", "trắc nghiệm", "Phenikaa", "ôn thi", "video bài giảng", "AI check"],
  openGraph: { type: "website", siteName: site.name, locale: "vi_VN", title: `${site.name} — Học tập online cho sinh viên`, description: site.description, url: absUrl("/") },
  twitter: { card: "summary_large_image" },
  robots: { index: true, follow: true },
  alternates: { canonical: absUrl("/") },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <body className="flex min-h-screen flex-col">
        <ErrorReporter />
        <AuthProvider>
          <Header />
          <VerifyBanner />
          <main id="main" className="flex-1">{children}</main>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
