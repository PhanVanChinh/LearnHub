// Bản sao quy tắc mật khẩu của backend/app/passwords.py để hiển thị tức thời trên form.
// Backend vẫn kiểm tra lại; nếu sửa quy tắc hãy sửa cả hai nơi.
export const PASSWORD_MIN = 8;

const COMMON = new Set([
  "12345678", "123456789", "1234567890", "password", "password1", "password123", "qwerty123", "qwertyuiop",
  "11111111", "00000000", "abcd1234", "abc12345", "iloveyou", "admin123", "admin1234", "letmein1", "welcome1",
  "matkhau1", "matkhau123", "phenikaa1", "phenikaa123", "learnhub1", "learnhub123", "a12345678", "1q2w3e4r",
]);

export type Rule = { key: string; label: string; ok: boolean };

/** Danh sách quy tắc kèm trạng thái đạt/chưa đạt — dùng cho checklist trên form. */
export function passwordRules(pw: string, email = ""): Rule[] {
  const local = email.split("@")[0]?.trim().toLowerCase() ?? "";
  return [
    { key: "len", label: `Ít nhất ${PASSWORD_MIN} ký tự`, ok: pw.length >= PASSWORD_MIN },
    { key: "letter", label: "Có chữ cái", ok: /[A-Za-z]/.test(pw) },
    { key: "digit", label: "Có chữ số", ok: /\d/.test(pw) },
    { key: "common", label: "Không phải mật khẩu phổ biến", ok: pw.length === 0 || !COMMON.has(pw.toLowerCase()) },
    { key: "email", label: "Không chứa tên email của bạn", ok: local.length < 4 || !pw.toLowerCase().includes(local) },
  ];
}

export const passwordValid = (pw: string, email = "") => pw.length <= 128 && pw.trim() === pw && passwordRules(pw, email).every((r) => r.ok);

/** Điểm 0–4 để vẽ thanh độ mạnh. */
export function passwordStrength(pw: string): { score: 0 | 1 | 2 | 3 | 4; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "bg-slate-200" };
  let s = 0;
  if (pw.length >= PASSWORD_MIN) s++;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) && /[^A-Za-z0-9]/.test(pw)) s++;
  if (COMMON.has(pw.toLowerCase())) s = 0;
  const score = Math.min(4, s) as 0 | 1 | 2 | 3 | 4;
  const map = [
    { label: "Rất yếu", color: "bg-rose-500" },
    { label: "Yếu", color: "bg-orange-500" },
    { label: "Trung bình", color: "bg-amber-500" },
    { label: "Mạnh", color: "bg-lime-500" },
    { label: "Rất mạnh", color: "bg-emerald-500" },
  ];
  return { score, ...map[score] };
}
