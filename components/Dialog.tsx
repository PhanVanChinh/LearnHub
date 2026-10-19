"use client";
import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

/* Hộp thoại dùng chung toàn site (thay prompt/confirm/alert của trình duyệt). Render qua portal vào <body>
   nên gọi được từ trong <form> hay trang nền tối mà không lồng DOM sai. Admin re-export từ components/admin/ui.tsx. */

export function Modal({ title, onClose, children, wide = false }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  // id riêng mỗi hộp thoại: form khóa học (Modal) mở thêm hộp xác nhận bên trong thì 2 tiêu đề không trùng id,
  // trình đọc màn hình đọc đúng tiêu đề của hộp đang mở.
  const titleId = useId();
  const boxRef = useRef<HTMLDivElement>(null);

  // Mở: nhớ phần tử đang focus (nút đã bấm mở), đưa focus vào hộp nếu chưa có ô autoFocus nào nhận.
  // Đóng: trả focus về đúng nút đó — người dùng bàn phím không bị đẩy về đầu trang.
  // Ghi nhớ ngay lúc render đầu (trước khi autoFocus của nút/ô bên trong chiếm focus ở bước commit)
  const [opener] = useState(() => (typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null));
  useEffect(() => {
    const box = boxRef.current;
    if (box && !box.contains(document.activeElement)) (focusables(box)[0] ?? box).focus();
    return () => { if (opener && opener !== document.body && document.contains(opener)) opener.focus(); };
  }, [opener]);

  // Phím xử lý ngay trên hộp (không gắn vào window): hộp lồng nhau thì chỉ hộp trên cùng nhận Escape / Tab,
  // stopPropagation chặn sự kiện lan lên hộp ngoài (React truyền sự kiện qua portal theo cây component).
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape") { e.stopPropagation(); onClose(); return; }
    if (e.key !== "Tab") return;
    e.stopPropagation();
    const box = boxRef.current;
    if (!box) return;
    const items = focusables(box);
    if (!items.length) { e.preventDefault(); box.focus(); return; }
    const first = items[0], last = items[items.length - 1];
    // Bẫy focus: Tab ở phần tử cuối quay về đầu, Shift+Tab ở đầu sang cuối — không lọt ra trang phía sau
    if (e.shiftKey && (document.activeElement === first || document.activeElement === box)) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };
  return (
    <div role="presentation" className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-900/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- mẫu dialog WAI-ARIA: Tab/Escape xử lý trên khung hộp */}
      <div ref={boxRef} role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1} onKeyDown={onKeyDown}
        className={`my-8 w-full focus:outline-none ${wide ? "max-w-3xl" : "max-w-lg"} rounded-2xl bg-white p-6 shadow-xl`}>
        <div className="flex items-center justify-between">
          <h2 id={titleId} className="text-lg font-bold text-slate-900">{title}</h2>
          <button onClick={onClose} aria-label="Đóng" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100">✕</button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';
function focusables(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.offsetParent !== null || el === document.activeElement);
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
  return createPortal(
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
    </Modal>,
    document.body,
  );
}
