"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "./AuthProvider";
import { coursesApi } from "@/lib/api";
import { fetchCourseDetail } from "@/lib/liveCourse";

export default function EnrollButton({ slug, price }: { slug: string; price: number }) {
  const { user, loading } = useAuth();
  const [enrolled, setEnrolled] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    if (!user) return setEnrolled(false);
    fetchCourseDetail(slug, true).then((d) => setEnrolled(d.enrolled)).catch(() => {}); // fresh: enrolled phụ thuộc user
  }, [user, slug]);

  if (price > 0) {
    return <Link href={`/checkout?course=${slug}`} className="btn-primary mt-4 w-full !py-3">Mua ngay</Link>;
  }
  if (loading) return <div className="mt-4 h-12 animate-pulse rounded-lg bg-slate-100" />;
  if (!user) {
    return <Link href={`/login?next=/courses/${slug}`} className="btn-primary mt-4 w-full !py-3">Đăng nhập để học miễn phí</Link>;
  }
  if (!user.email_verified) {
    return (
      <Link href={`/verify?next=/courses/${slug}`} className="btn mt-4 w-full !py-3 bg-amber-500 text-white hover:bg-amber-600">
        ✉️ Xác thực email để ghi danh
      </Link>
    );
  }
  if (enrolled) {
    return <Link href={`/learn/${slug}`} className="btn mt-4 w-full !py-3 bg-emerald-600 text-white hover:bg-emerald-700">▶ Vào học ngay</Link>;
  }
  const enroll = async () => {
    setBusy(true); setMsg("");
    try { await coursesApi.enroll(slug); setEnrolled(true); }
    catch (e) { setMsg((e as Error).message); }
    finally { setBusy(false); }
  };
  return (
    <>
      <button onClick={enroll} disabled={busy} className="btn-primary mt-4 w-full !py-3 disabled:opacity-60">
        {busy ? "Đang ghi danh…" : "Bắt đầu học miễn phí"}
      </button>
      {msg && <p className="mt-2 text-sm text-rose-600">{msg}</p>}
    </>
  );
}
