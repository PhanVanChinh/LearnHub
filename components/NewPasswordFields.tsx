"use client";
import { useMemo } from "react";
import { passwordRules, passwordStrength, passwordValid } from "@/lib/password";
import PasswordInput from "./PasswordInput";

type Props = {
  password: string;
  confirm: string;
  onPassword: (v: string) => void;
  onConfirm: (v: string) => void;
  /** Đã bấm gửi / rời ô → tô đỏ các lỗi */
  touched: boolean;
  onBlur?: () => void;
  email?: string;
  placeholder?: string;
  autoFocus?: boolean;
};

/** Ô mật khẩu mới + nhập lại, kèm thanh độ mạnh và checklist quy tắc. Dùng cho đặt lại / đổi / đặt mật khẩu. */
export default function NewPasswordFields({ password, confirm, onPassword, onConfirm, touched, onBlur, email = "", placeholder = "Mật khẩu mới", autoFocus }: Props) {
  const rules = useMemo(() => passwordRules(password, email), [password, email]);
  const strength = useMemo(() => passwordStrength(password), [password]);
  return (
    <>
      <div>
        <PasswordInput placeholder={placeholder} value={password} onChange={(e) => onPassword(e.target.value)} onBlur={onBlur} autoComplete="new-password"
          autoFocus={autoFocus} invalid={touched && !passwordValid(password, email)} />
        {password && (
          <div className="mt-2">
            <div className="flex gap-1">{[1, 2, 3, 4].map((i) => <span key={i} className={`h-1.5 flex-1 rounded-full ${i <= strength.score ? strength.color : "bg-slate-200"}`} />)}</div>
            <p className="mt-1 text-xs text-slate-500">Độ mạnh: <span className="font-medium text-slate-700">{strength.label}</span></p>
          </div>
        )}
        <ul className="mt-2 grid grid-cols-1 gap-1 text-xs sm:grid-cols-2">
          {rules.map((r) => <li key={r.key} className={r.ok ? "text-emerald-600" : "text-slate-500"}>{r.ok ? "✓" : "○"} {r.label}</li>)}
        </ul>
      </div>
      <div>
        <PasswordInput placeholder={`Nhập lại ${placeholder.toLowerCase()}`} value={confirm} onChange={(e) => onConfirm(e.target.value)} autoComplete="new-password"
          invalid={touched && confirm !== password} />
        {touched && confirm !== password && <p className="mt-1 text-xs text-rose-600">Mật khẩu nhập lại không khớp</p>}
      </div>
    </>
  );
}
