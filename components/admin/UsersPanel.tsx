"use client";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { AdminUser, adminApi } from "@/lib/api";
import { Badge, ErrorBox, Field, Modal, Pager, tableCls, tdCls, thCls } from "./ui";

const LIMIT = 20;
type Role = "user" | "admin";

export default function UsersPanel({ onChanged }: { onChanged: () => void }) {
  const { user: me } = useAuth();
  const [data, setData] = useState<{ total: number; items: AdminUser[] } | null>(null);
  const [q, setQ] = useState(""); const [role, setRole] = useState<"" | Role>(""); const [offset, setOffset] = useState(0);
  const [modal, setModal] = useState<null | "create" | AdminUser>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    adminApi.users({ q, role: role || undefined, limit: LIMIT, offset }).then(setData).catch((e) => setError(e.message));
  }, [q, role, offset]);
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);

  const done = () => { setModal(null); load(); onChanged(); };
  const act = async (fn: () => Promise<unknown>) => { setError(""); try { await fn(); done(); } catch (e) { setError((e as Error).message); } };

  const toggleActive = (u: AdminUser) => act(() => adminApi.updateUser(u.id, { is_active: !u.is_active }));
  const toggleRole = (u: AdminUser) => act(() => adminApi.updateUser(u.id, { role: u.role === "admin" ? "user" : "admin" }));
  const remove = (u: AdminUser) => {
    if (!confirm(`Xoá người dùng ${u.email}?\n${u.enrollment_count} ghi danh của họ cũng sẽ bị xoá.`)) return;
    act(() => adminApi.deleteUser(u.id));
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input className="input max-w-xs" placeholder="Tìm email / họ tên…" value={q} onChange={(e) => { setQ(e.target.value); setOffset(0); }} />
        <select className="input max-w-[10rem]" value={role} onChange={(e) => { setRole(e.target.value as "" | Role); setOffset(0); }}>
          <option value="">Mọi vai trò</option><option value="user">user</option><option value="admin">admin</option>
        </select>
        <div className="flex-1" />
        <button onClick={() => setModal("create")} className="btn-primary">+ Thêm người dùng</button>
      </div>
      <div className="mt-3"><ErrorBox message={error} /></div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className={tableCls}>
          <thead><tr>
            <th className={thCls}>Người dùng</th><th className={thCls}>Vai trò</th><th className={thCls}>Trạng thái</th>
            <th className={thCls}>Ghi danh</th><th className={thCls}>Ngày tạo</th><th className={thCls}></th>
          </tr></thead>
          <tbody>
            {!data && <tr><td className={tdCls} colSpan={6}>Đang tải…</td></tr>}
            {data?.items.length === 0 && <tr><td className={`${tdCls} text-slate-500`} colSpan={6}>Không có người dùng nào.</td></tr>}
            {data?.items.map((u) => {
              const self = u.id === me?.id;
              return (
                <tr key={u.id} className="hover:bg-slate-50/60">
                  <td className={tdCls}>
                    <div className="font-medium text-slate-900">{u.full_name} {self && <span className="text-xs text-slate-400">(bạn)</span>}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </td>
                  <td className={tdCls}><Badge tone={u.role === "admin" ? "amber" : "slate"}>{u.role}</Badge></td>
                  <td className={tdCls}><Badge tone={u.is_active ? "green" : "rose"}>{u.is_active ? "Hoạt động" : "Đã khoá"}</Badge></td>
                  <td className={`${tdCls} text-slate-600`}>{u.enrollment_count}</td>
                  <td className={`${tdCls} whitespace-nowrap text-slate-600`}>{new Date(u.created_at).toLocaleDateString("vi-VN")}</td>
                  <td className={`${tdCls} whitespace-nowrap text-right`}>
                    <button onClick={() => setModal(u)} className="btn-outline !px-2.5 !py-1">Sửa</button>
                    <button disabled={self} onClick={() => toggleRole(u)} className="btn-outline ml-1 !px-2.5 !py-1 disabled:opacity-40">{u.role === "admin" ? "Hạ quyền" : "Cấp admin"}</button>
                    <button disabled={self} onClick={() => toggleActive(u)} className="btn-outline ml-1 !px-2.5 !py-1 disabled:opacity-40">{u.is_active ? "Khoá" : "Mở khoá"}</button>
                    <button disabled={self} onClick={() => remove(u)} className="btn-outline ml-1 !px-2.5 !py-1 !text-rose-600 hover:!border-rose-300 disabled:opacity-40">Xoá</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {data && <Pager total={data.total} limit={LIMIT} offset={offset} onChange={setOffset} />}

      {modal && (
        <Modal title={modal === "create" ? "Thêm người dùng" : `Sửa: ${modal.email}`} onClose={() => setModal(null)}>
          <UserForm initial={modal === "create" ? undefined : modal} isSelf={modal !== "create" && modal.id === me?.id}
            onSubmit={async (body) => {
              if (modal === "create") await adminApi.createUser(body as Parameters<typeof adminApi.createUser>[0]);
              else await adminApi.updateUser(modal.id, body);
              done();
            }}
            onCancel={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}

function UserForm({ initial, isSelf, onSubmit, onCancel }: {
  initial?: AdminUser; isSelf: boolean;
  onSubmit: (body: { email?: string; full_name?: string; password?: string; role?: Role; is_active?: boolean }) => Promise<void>;
  onCancel: () => void;
}) {
  const [f, setF] = useState({ full_name: initial?.full_name ?? "", email: initial?.email ?? "", password: "", role: (initial?.role ?? "user") as Role, is_active: initial?.is_active ?? true });
  const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault(); setError(""); setBusy(true);
    try {
      const body: Record<string, unknown> = { full_name: f.full_name.trim(), email: f.email.trim(), role: f.role, is_active: f.is_active };
      if (f.password) body.password = f.password;
      if (!initial && !f.password) throw new Error("Cần nhập mật khẩu cho tài khoản mới");
      await onSubmit(body);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  };
  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Họ và tên"><input className="input" required value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
      <Field label="Email"><input className="input" type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
      <Field label={initial ? "Mật khẩu mới (để trống nếu không đổi)" : "Mật khẩu"}>
        <input className="input" type="password" minLength={8} placeholder="Tối thiểu 8 ký tự, có chữ và số" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete="new-password" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Vai trò">
          <select className="input" disabled={isSelf} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as Role })}>
            <option value="user">user</option><option value="admin">admin</option>
          </select>
        </Field>
        <label className="flex items-center gap-2 pt-6 text-sm">
          <input type="checkbox" disabled={isSelf} checked={f.is_active} onChange={(e) => setF({ ...f, is_active: e.target.checked })} /> Tài khoản hoạt động
        </label>
      </div>
      <ErrorBox message={error} />
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="btn-outline">Huỷ</button>
        <button type="submit" disabled={busy} className="btn-primary disabled:opacity-60">{busy ? "Đang lưu…" : initial ? "Lưu thay đổi" : "Tạo người dùng"}</button>
      </div>
    </form>
  );
}
