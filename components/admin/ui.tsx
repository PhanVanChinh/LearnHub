"use client";
import { FormEvent, useEffect, useState } from "react";

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div role="presentation" className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-900/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-labelledby="modal-title" className={`my-8 w-full ${wide ? "max-w-3xl" : "max-w-lg"} rounded-2xl bg-white p-6 shadow-xl`}>
        <div className="flex items-center justify-between">
          <h2 id="modal-title" className="text-lg font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} aria-label="Đóng" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">✕</button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export type DialogOptions = {
  title: string;
  message?: React.ReactNode;
  confirmLabel?: string;
  /** null = không có nút huỷ (thông báo) */
  cancelLabel?: string | null;
  danger?: boolean;
  input?: { label: string; placeholder?: string; required?: boolean; multiline?: boolean; initial?: string };
};
export type DialogResult = { ok: boolean; value: string };
export type AskFn = (opts: DialogOptions) => Promise<DialogResult>;

/** Thay cho prompt/confirm/alert của trình duyệt: hộp thoại cùng phong cách, có ô nhập (bắt buộc được), nút nguy hiểm màu đỏ.
 *  Dùng: const { ask, notify, dialog } = useDialog(); render {dialog} một lần; await ask({...}) → { ok, value }. */
export function useDialog() {
  const [state, setState] = useState<(DialogOptions & { resolve: (r: DialogResult) => void }) | null>(null);
  const ask: AskFn = (opts) => new Promise((resolve) => setState({ ...opts, resolve }));
  const notify = (title: string, message?: React.ReactNode) => ask({ title, message, cancelLabel: null, confirmLabel: "Đóng" });
  const close = (r: DialogResult) => { state?.resolve(r); setState(null); };
  const dialog = state ? <DialogView opts={state} onDone={close} /> : null;
  return { ask, notify, dialog };
}

function DialogView({ opts, onDone }: { opts: DialogOptions; onDone: (r: DialogResult) => void }) {
  const [value, setValue] = useState(opts.input?.initial ?? "");
  const required = !!opts.input?.required;
  const canConfirm = !required || value.trim().length > 0;
  const submit = (e: FormEvent) => { e.preventDefault(); if (canConfirm) onDone({ ok: true, value: value.trim() }); };
  return (
    <Modal title={opts.title} onClose={() => onDone({ ok: false, value: "" })}>
      <form onSubmit={submit}>
        {opts.message && <div className="whitespace-pre-line text-sm text-slate-600">{opts.message}</div>}
        {opts.input && (
          <label className="mt-4 block text-sm">
            <span className="font-medium text-slate-700">{opts.input.label}{required && <span className="text-rose-600"> *</span>}</span>
            {opts.input.multiline ? (
              <textarea autoFocus className="input mt-1" rows={3} value={value} placeholder={opts.input.placeholder} onChange={(e) => setValue(e.target.value)} />
            ) : (
              <input autoFocus className="input mt-1" value={value} placeholder={opts.input.placeholder} onChange={(e) => setValue(e.target.value)} />
            )}
          </label>
        )}
        <div className="mt-5 flex justify-end gap-2">
          {opts.cancelLabel !== null && (
            <button type="button" onClick={() => onDone({ ok: false, value: "" })} className="btn-outline">{opts.cancelLabel ?? "Hủy"}</button>
          )}
          <button type="submit" autoFocus={!opts.input} disabled={!canConfirm} className={`${opts.danger ? "btn-danger" : "btn-primary"} disabled:opacity-50`}>
            {opts.confirmLabel ?? "Xác nhận"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  );
}

export function ErrorBox({ message }: { message: string }) {
  if (!message) return null;
  return <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{message}</p>;
}

export function Badge({ children, tone = "slate" }: { children: React.ReactNode; tone?: "slate" | "green" | "amber" | "rose" | "brand" }) {
  const tones = {
    slate: "bg-slate-100 text-slate-700", green: "bg-emerald-100 text-emerald-700", amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700", brand: "bg-brand-50 text-brand-700",
  };
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${tones[tone]}`}>{children}</span>;
}

export function Pager({ total, limit, offset, onChange }: { total: number; limit: number; offset: number; onChange: (offset: number) => void }) {
  if (total <= limit) return null;
  const page = Math.floor(offset / limit) + 1;
  const pages = Math.ceil(total / limit);
  return (
    <div className="mt-4 flex items-center justify-between text-sm text-slate-600">
      <span>Trang {page}/{pages} · {total} mục</span>
      <div className="flex gap-2">
        <button disabled={offset === 0} onClick={() => onChange(Math.max(0, offset - limit))} className="btn-outline !py-1 disabled:opacity-40">‹ Trước</button>
        <button disabled={offset + limit >= total} onClick={() => onChange(offset + limit)} className="btn-outline !py-1 disabled:opacity-40">Sau ›</button>
      </div>
    </div>
  );
}

export const tableCls = "w-full text-left text-sm";
export const thCls = "border-b border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500";
export const tdCls = "border-b border-slate-100 px-3 py-2.5 align-middle";
