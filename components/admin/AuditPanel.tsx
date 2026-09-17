"use client";
import { useCallback, useEffect, useState } from "react";
import { adminApi, AuditLog } from "@/lib/api";
import { ErrorBox, Pager } from "./ui";

const LIMIT = 30;
const utc = (iso: string) => new Date(/Z|[+-]\d\d:\d\d$/.test(iso) ? iso : iso + "Z");
const fmt = (iso: string) => utc(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });

const GROUPS: { key: string; label: string }[] = [
  { key: "", label: "Tất cả" }, { key: "order", label: "Đơn hàng" }, { key: "course", label: "Khóa học" }, { key: "user", label: "Người dùng" },
  { key: "enrollment", label: "Ghi danh" }, { key: "contact", label: "Liên hệ" }, { key: "site", label: "Xuất bản" }, { key: "account", label: "Tự xoá TK" },
];
const TONE: Record<string, string> = {
  create: "bg-emerald-50 text-emerald-700", confirm: "bg-emerald-50 text-emerald-700", replied: "bg-emerald-50 text-emerald-700",
  update: "bg-sky-50 text-sky-700", publish: "bg-brand-50 text-brand-700", unreplied: "bg-slate-100 text-slate-600",
  delete: "bg-rose-50 text-rose-700", cancel: "bg-amber-50 text-amber-700",
};
const verb = (action: string) => action.split(".")[1] ?? action;

/** Nhật ký hành động admin: chỉ đọc, mới nhất trước, lọc theo nhóm / người thực hiện / từ khoá, bấm dòng để xem chi tiết JSON. */
export default function AuditPanel() {
  const [group, setGroup] = useState("");
  const [actor, setActor] = useState("");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<{ total: number; items: AuditLog[] } | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    adminApi.audit({ action: group || undefined, actor: actor.trim() || undefined, q: q.trim() || undefined, limit: LIMIT, offset })
      .then(setData).catch((e) => setError(e.message));
  }, [group, actor, q, offset]);
  useEffect(load, [load]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {GROUPS.map((g) => (
          <button key={g.key} onClick={() => { setGroup(g.key); setOffset(0); }}
            className={`chip ${group === g.key ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-brand-300"}`}>{g.label}</button>
        ))}
        <input value={actor} onChange={(e) => { setActor(e.target.value); setOffset(0); }} placeholder="Email admin…" className="input ml-auto sm:w-48" />
        <input value={q} onChange={(e) => { setQ(e.target.value); setOffset(0); }} placeholder="Tìm trong tóm tắt…" className="input sm:w-56" />
      </div>
      <p className="mt-3 text-xs text-slate-500">Nhật ký chỉ đọc, không sửa/xoá được từ giao diện. Mỗi dòng ghi ai làm, làm gì, lúc nào, từ IP nào.</p>
      <div className="mt-3"><ErrorBox message={error} /></div>

      <ul className="mt-4 divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
        {!data && <li className="p-4 text-sm text-slate-500">Đang tải…</li>}
        {data?.items.length === 0 && <li className="p-8 text-center text-sm text-slate-500">Chưa có bản ghi nào.</li>}
        {data?.items.map((l) => {
          const isOpen = open === l.id;
          return (
            <li key={l.id}>
              <button onClick={() => setOpen(isOpen ? null : l.id)} className="flex w-full flex-wrap items-start gap-x-3 gap-y-1 px-4 py-3 text-left text-sm hover:bg-slate-50/60">
                <span className="w-36 shrink-0 font-mono text-xs text-slate-500">{fmt(l.created_at)}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 font-mono text-xs font-semibold ${TONE[verb(l.action)] ?? "bg-slate-100 text-slate-600"}`}>{l.action}</span>
                <span className="min-w-0 flex-1 text-slate-800">{l.summary}</span>
                <span className="shrink-0 text-xs text-slate-500">{l.actor_email ?? "người dùng"}</span>
              </button>
              {isOpen && (
                <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 text-xs text-slate-600">
                  <div className="flex flex-wrap gap-x-6 gap-y-1">
                    <span>ID #{l.id}</span>
                    <span>Đối tượng: {l.target_type}{l.target_id ? ` #${l.target_id}` : ""}</span>
                    <span>IP: {l.ip ?? "—"}</span>
                    {l.actor_id && <span>Actor ID: {l.actor_id}</span>}
                  </div>
                  {l.detail && <pre className="mt-2 overflow-x-auto rounded-lg bg-white p-3 font-mono text-[11px] leading-5 text-slate-700">{JSON.stringify(l.detail, null, 2)}</pre>}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {data && <Pager total={data.total} limit={LIMIT} offset={offset} onChange={setOffset} />}
    </div>
  );
}
