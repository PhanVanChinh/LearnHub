"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import Logo from "./Logo";
import PasswordInput from "./PasswordInput";
import { useAuth } from "./AuthProvider";
import { ApiError, FieldErrors } from "@/lib/api";
import { passwordRules, passwordStrength, passwordValid } from "@/lib/password";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
    const login = mode === "login";
    const { user, login: doLogin, register: doRegister } = useAuth();
    const router = useRouter();
    const next = useSearchParams().get("next") || "/";
    const [form, setForm] = useState({
        full_name: "",
        email: "",
        password: "",
        confirm: "",
        terms: false,
    });
    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [serverErrors, setServerErrors] = useState<FieldErrors>({});
    const [error, setError] = useState("");
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (user && login) router.replace(next);
    }, [user, login, next, router]);

    // ---- kiểm tra phía client (chỉ dùng cho đăng ký) ----
    const rules = useMemo(() => passwordRules(form.password, form.email), [form.password, form.email]);
    const strength = useMemo(() => passwordStrength(form.password), [form.password]);
    const clientErrors: FieldErrors = useMemo(() => {
        if (login) return {};
        const e: FieldErrors = {};
        if (!form.full_name.trim()) e.full_name = "Vui lòng nhập họ và tên";
        if (!EMAIL_RE.test(form.email.trim())) e.email = "Email không hợp lệ";
        if (!passwordValid(form.password, form.email)) e.password = "Mật khẩu chưa đạt yêu cầu bên dưới";
        if (form.confirm !== form.password) e.confirm = "Mật khẩu nhập lại không khớp";
        if (!form.terms) e.terms = "Bạn cần đồng ý điều khoản để tiếp tục";
        return e;
    }, [login, form]);
    const fieldError = (k: string) => serverErrors[k] || (touched[k] ? clientErrors[k] : "");
    const canSubmit = login ? form.email && form.password : Object.keys(clientErrors).length === 0;

    const onSubmit = async (e: FormEvent) => {
        e.preventDefault();
        setTouched({ full_name: true, email: true, password: true, confirm: true, terms: true });
        if (!login && Object.keys(clientErrors).length) return;
        setError("");
        setServerErrors({});
        setBusy(true);
        try {
            if (login) {
                await doLogin(form.email.trim(), form.password);
                router.replace(next);
            } else {
                await doRegister(form.full_name.trim(), form.email.trim(), form.password);
                router.replace(`/verify?next=${encodeURIComponent(next)}`);
            }
        } catch (err) {
            const ae = err as ApiError;
            if (ae.errors && Object.keys(ae.errors).length) setServerErrors(ae.errors);
            else setError(ae.message);
        } finally {
            setBusy(false);
        }
    };
    const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => {
        const v = e.target.type === "checkbox" ? e.target.checked : e.target.value;
        setForm({ ...form, [k]: v });
        if (serverErrors[k]) setServerErrors({ ...serverErrors, [k]: "" });
    };
    const blur = (k: string) => () => setTouched({ ...touched, [k]: true });
    const Err = ({ k }: { k: string }) =>
        fieldError(k) ? <p className="mt-1 text-xs text-rose-600">{fieldError(k)}</p> : null;

    return (
        <div className="container-x flex justify-center py-16">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-card">
                <div className="flex justify-center">
                    <Logo />
                </div>
                <h1 className="mt-6 text-center text-2xl font-bold text-slate-900">
                    {login ? "Đăng nhập" : "Tạo tài khoản"}
                </h1>
                <p className="mt-1 text-center text-sm text-slate-500">
                    {login ? "Chào mừng bạn quay lại!" : "Miễn phí, chỉ mất 30 giây."}
                </p>
                <form onSubmit={onSubmit} noValidate className="mt-6 space-y-4">
                    {!login && (
                        <div>
                            <input
                                className={`input ${fieldError("full_name") ? "!border-rose-400" : ""}`}
                                placeholder="Họ và tên"
                                value={form.full_name}
                                onChange={set("full_name")}
                                onBlur={blur("full_name")}
                                autoComplete="name"
                                required
                            />
                            <Err k="full_name" />
                        </div>
                    )}
                    <div>
                        <input
                            className={`input ${fieldError("email") ? "!border-rose-400" : ""}`}
                            type="email"
                            placeholder="Email"
                            value={form.email}
                            onChange={set("email")}
                            onBlur={blur("email")}
                            required
                            autoComplete="email"
                            inputMode="email"
                        />
                        <Err k="email" />
                    </div>
                    <div>
                        <PasswordInput
                            invalid={!!fieldError("password")}
                            placeholder={login ? "Mật khẩu" : "Mật khẩu (tối thiểu 8 ký tự, có chữ và số)"}
                            value={form.password}
                            onChange={set("password")}
                            onBlur={blur("password")}
                            required
                            autoComplete={login ? "current-password" : "new-password"}
                        />
                        <Err k="password" />
                        {!login && form.password && (
                            <div className="mt-2">
                                <div className="flex gap-1">
                                    {[1, 2, 3, 4].map((i) => (
                                        <span
                                            key={i}
                                            className={`h-1.5 flex-1 rounded-full transition ${
                                                i <= strength.score ? strength.color : "bg-slate-200"
                                            }`}
                                        />
                                    ))}
                                </div>
                                <p className="mt-1 text-xs text-slate-500">
                                    Độ mạnh: <span className="font-medium text-slate-700">{strength.label}</span>
                                </p>
                            </div>
                        )}
                        {!login && (touched.password || form.password) && (
                            <ul className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
                                {rules.map((r) => (
                                    <li key={r.key} className={r.ok ? "text-emerald-600" : "text-slate-500"}>
                                        {r.ok ? "✓" : "○"} {r.label}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                    {!login && (
                        <div>
                            <PasswordInput
                                invalid={!!fieldError("confirm")}
                                placeholder="Nhập lại mật khẩu"
                                value={form.confirm}
                                onChange={set("confirm")}
                                onBlur={blur("confirm")}
                                required
                                autoComplete="new-password"
                            />
                            <Err k="confirm" />
                        </div>
                    )}
                    {!login && (
                        <div>
                            <label className="flex items-start gap-2 text-sm text-slate-600">
                                <input
                                    type="checkbox"
                                    className="mt-0.5"
                                    checked={form.terms}
                                    onChange={set("terms")}
                                    onBlur={blur("terms")}
                                />
                                <span>
                                    Tôi đồng ý với{" "}
                                    <Link href="/policy/terms" target="_blank" className="font-medium text-brand-700 hover:underline">
                                        Điều khoản sử dụng
                                    </Link>{" "}
                                    và{" "}
                                    <Link href="/policy/privacy" target="_blank" className="font-medium text-brand-700 hover:underline">
                                        Chính sách bảo mật
                                    </Link>
                                    .
                                </span>
                            </label>
                            <Err k="terms" />
                        </div>
                    )}
                    {login && (
                        <div className="-mt-1 text-right">
                            <Link href="/forgot-password" className="text-sm font-medium text-brand-700 hover:underline">
                                Quên mật khẩu?
                            </Link>
                        </div>
                    )}
                    {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
                    <button
                        type="submit"
                        disabled={busy || (!login && !canSubmit && Object.keys(touched).length > 0)}
                        className="btn-primary w-full !py-2.5 disabled:opacity-60"
                    >
                        {busy ? "Đang xử lý…" : login ? "Đăng nhập" : "Đăng ký"}
                    </button>
                </form>
                <p className="mt-6 text-center text-sm text-slate-600">
                    {login ? "Chưa có tài khoản? " : "Đã có tài khoản? "}
                    <Link href={login ? "/register" : "/login"} className="font-semibold text-brand-700 hover:underline">
                        {login ? "Đăng ký" : "Đăng nhập"}
                    </Link>
                </p>
            </div>
        </div>
    );
}
