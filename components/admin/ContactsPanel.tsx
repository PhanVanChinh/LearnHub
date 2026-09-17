"use client";
import { useCallback, useEffect, useState } from "react";
import { AdminContact, adminApi } from "@/lib/api";
import { ErrorBox, Pager } from "./ui";

const LIMIT = 20;
const utc = (iso: string) => new Date(/Z|[+-]\d\d:\d\d$/.test(iso) ? iso : iso + "Z");
const fmt = (iso: string) => utc(iso).toLocaleString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

export default function ContactsPanel({ onChanged }: { onChanged: () => void }) {
  const [status, setStatus] = useState<"new" | "replied" | "">("new");
  const [q, setQ] = useState("");
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<{ total: number; items: AdminContact[] } | null>(null);
  const [open, setOpen] = useState<number | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    adminApi.contacts({ status, q: q.trim() || undefined, limit: LIMIT, offset }).then(setData).catch((e) => setError(e.message));
  }, [status, q, offset]);
  useEffect(load, [load]);

  const toggle = async (m: AdminContact) => {
    try { await adminApi.toggleContactReplied(m.id); load(); onChanged(); } catch (e) { setError((e as Error).message); }
  };
  const remove = async (m: AdminContact) => {
    if (!confirm(`Xoá tin nhắn của ${m.email}? Không khôi phục được.`)) return;
    try { await adminApi.deleteContact(m.id); load(); onChanged(); } catch (e) { setError((e as Error).message); }
  };
  const replyHref = (m: AdminContact) =>
    `mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.subject || "Liên hệ LearnHub"}`)}&body=${encodeURIComponent(`Chào ${m.name},\n\n\n\n---\nBạn đã viết:\n${m.message}`)}`;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {([["new", "Chưa trả lời"], ["replied", "Đã trả lời"], ["", "Tất cả"]] as const).map(([k, l]) => (
          <button key={k} onClick={() => { setStatus(k); setOffset(0); }}
            className={`chip ${status === k ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-brand-300"}`}>{l}</button>
        ))}
        <input value={q} onChange={(e) => { setQ(e.target.value); setOffset(0); }} placeholder="Tìm tên, email, nội dung…" className="input ml-auto sm:w-64" />
      </div>
      <p className="mt-3 text-xs text-slate-500">Bấm "Trả lời" để mở email soạn sẵn, gửi xong bấm "Đã trả lời" để đánh dấu.</p>
      <div className="mt-3"><ErrorBox message={error} /></div>

      <ul className="mt-4 space-y-2">
        {!data && <li className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-500">Đang tải…</li>}
        {data?.items.length === 0 && <li className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">Không có tin nhắn nào.</li>}
        {data?.items.map((m) => {
          const isOpen = open === m.id;
          return (
            <li key={m.id} className={`rounded-xl border bg-white ${m.status === "new" ? "border-brand-200" : "border-slate-200"}`}>
              <button onClick={() => setOpen(isOpen ? null : m.id)} className="flex w-full items-start gap-3 p-4 text-left">
                <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${m.status === "new" ? "bg-brand-600" : "bg-slate-300"}`} />
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-x-2 text-sm">
                    <span className="font-semibold text-slate-900">{m.name}</span>
                    <span className="text-slate-500">{m.email}</span>
                    {m.user_id && <span className="rounded-full bg-slate-100 px-1.5 text-xs text-slate-600">thành viên</span>}
                    <span className="ml-auto text-xs text-slate-400">{fmt(m.created_at)}</span>
                  </span>
                  <span className="mt-0.5 block truncate text-sm text-slate-700">
                    {m.subject && <span className="font-medium">{m.subject} · </span>}
                    <span className={isOpen ? "hidden" : ""}>{m.message}</span>
                  </span>
                </span>
              </button>
              {isOpen && (
                <div className="border-t border-slate-100 px-4 pb-4 pt-3">
                  <p className="whitespace-pre-wrap text-sm leading-6 text-slate-700">{m.message}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    <a href={replyHref(m)} className="btn-primary !px-3 !py-1.5">✉️ Trả lời qua email</a>
                    <button onClick={() => toggle(m)} className={`btn-outline !px-3 !py-1.5 ${m.status === "new" ? "!border-emerald-300 !text-emerald-700" : ""}`}>
                      {m.status === "new" ? "✓ Đã trả lời" : "↩ Chưa trả lời"}
                    </button>
                    <button onClick={() => remove(m)} className="btn-outline ml-auto !px-3 !py-1.5 !text-rose-600 hover:!border-rose-300">Xoá</button>
                    {m.replied_at && <span className="w-full text-xs text-slate-500">Đã trả lời lúc {fmt(m.replied_at)}</span>}
                  </div>
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
