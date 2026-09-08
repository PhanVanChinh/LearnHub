import Link from "next/link";
export default function NotFound() {
  return (
    <div className="container-x py-32 text-center">
      <p className="text-6xl font-black text-brand-600">404</p>
      <h1 className="mt-3 text-2xl font-bold text-slate-900">Không tìm thấy trang</h1>
      <Link href="/" className="btn-primary mt-6">Về trang chủ</Link>
    </div>
  );
}
