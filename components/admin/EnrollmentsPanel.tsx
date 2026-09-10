"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { AdminCourse, AdminEnrollment, AdminUser, adminApi } from "@/lib/api";
import { ErrorBox, Field, Pager, tableCls, tdCls, thCls } from "./ui";

const LIMIT = 20;

export default function EnrollmentsPanel({ onChanged }: { onChanged: () => void }) {
  const [data, setData] = useState<{ total: number; items: AdminEnrollment[] } | null>(null);
  const [offset, setOffset] = useState(0);
  const [users, setUsers] = useState<AdminUser[]>([]); const [courses, setCourses] = useState<AdminCourse[]>([]);
  const [form, setForm] = useState({ user_id: "", course_id: "" });
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    adminApi.enrollments({ limit: LIMIT, offset }).then(setData).catch((e) => setError(e.message));
  }, [offset]);
  useEffect(load, [load]);
  useEffect(() => {
    adminApi.users({ limit: 200 }).then((r) => setUsers(r.items)).catch(() => {});
    adminApi.courses({ limit: 200 }).then((r) => setCourses(r.items)).catch(() => {});
  }, []);

  const grant = async (e: FormEvent) => {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      await adminApi.createEnrollment({ user_id: Number(form.user_id), course_id: Number(form.course_id) });
      setForm({ user_id: "", course_id: "" }); load(); onChanged();
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  const revoke = async (en: AdminEnrollment) => {
    if (!confirm(`Thu hồi quyền truy cập "${en.course_title}" của ${en.user_email}?`)) return;
    try { await adminApi.deleteEnrollment(en.id); load(); onChanged(); } catch (err) { setError((err as Error).message); }
  };

  return (
    <div>
      <form onSubmit={grant} className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <Field label="Người dùng">
          <select className="input" required value={form.user_id} onChange={(e) => setForm({ ...form, user_id: e.target.value })}>
            <option value="">— chọn —</option>
            {users.map((u) => <option key={u.id} value={u.id}>{u.email} ({u.full_name})</option>)}
          </select>
        </Field>
        <Field label="Khóa học" hint="Cấp cả khóa trả phí, ví dụ sau khi nhận chuyển khoản">
          <select className="input" required value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })}>
            <option value="">— chọn —</option>
            {courses.map((c) => <option key={c.id} value={c.id}>{c.emoji} {c.title}</option>)}
          </select>
        </Field>
        <button type="submit" disabled={busy} className="btn-primary mb-5 disabled:opacity-60">Cấp quyền</button>
      </form>
      <div className="mt-3"><ErrorBox message={error} /></div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className={tableCls}>
          <thead><tr>
            <th className={thCls}>Người dùng</th><th className={thCls}>Khóa học</th><th className={thCls}>Ngày</th><th className={thCls}></th>
          </tr></thead>
          <tbody>
            {!data && <tr><td className={tdCls} colSpan={4}>Đang tải…</td></tr>}
            {data?.items.length === 0 && <tr><td className={`${tdCls} text-slate-500`} colSpan={4}>Chưa có ghi danh nào.</td></tr>}
            {data?.items.map((en) => (
              <tr key={en.id} className="hover:bg-slate-50/60">
                <td className={tdCls}>{en.user_email}</td>
                <td className={tdCls}>
                  <div className="font-medium text-slate-900">{en.course_title}</div>
                  <div className="font-mono text-xs text-slate-500">/{en.course_slug}</div>
                </td>
                <td className={`${tdCls} whitespace-nowrap text-slate-600`}>{new Date(en.created_at).toLocaleString("vi-VN")}</td>
                <td className={`${tdCls} text-right`}>
                  <button onClick={() => revoke(en)} className="btn-outline !px-2.5 !py-1 !text-rose-600 hover:!border-rose-300">Thu hồi</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && <Pager total={data.total} limit={LIMIT} offset={offset} onChange={setOffset} />}
    </div>
  );
}
