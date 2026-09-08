import Link from "next/link";
import Logo from "./Logo";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const login = mode === "login";
  return (
    <div className="container-x flex justify-center py-16">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
        <div className="flex justify-center"><Logo /></div>
        <h1 className="mt-6 text-center text-2xl font-bold text-slate-900">{login ? "Đăng nhập" : "Tạo tài khoản"}</h1>
        <p className="mt-1 text-center text-sm text-slate-500">{login ? "Chào mừng bạn quay lại!" : "Miễn phí, chỉ mất 30 giây."}</p>
        <form className="mt-6 space-y-4">
          {!login && <input className="input" placeholder="Họ và tên" required />}
          <input className="input" type="email" placeholder="Email" required />
          <input className="input" type="password" placeholder="Mật khẩu" required />
          {login && (
            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-slate-600"><input type="checkbox" className="rounded" /> Ghi nhớ</label>
              <a href="#" className="font-medium text-brand-700 hover:underline">Quên mật khẩu?</a>
            </div>
          )}
          <button type="submit" className="btn-primary w-full !py-2.5">{login ? "Đăng nhập" : "Đăng ký"}</button>
        </form>
        <div className="my-5 flex items-center gap-3 text-xs text-slate-400"><span className="h-px flex-1 bg-slate-200" />hoặc<span className="h-px flex-1 bg-slate-200" /></div>
        <button className="btn-outline w-full">Tiếp tục với Google</button>
        <p className="mt-6 text-center text-sm text-slate-600">
          {login ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
          <Link href={login ? "/register" : "/login"} className="font-semibold text-brand-700 hover:underline">{login ? "Đăng ký" : "Đăng nhập"}</Link>
        </p>
      </div>
    </div>
  );
}
