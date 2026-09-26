"use client";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { AdminCourse, adminApi, CourseInput } from "@/lib/api";
import { formatVND } from "@/lib/site";
import { categories } from "@/data/courses";
import CourseForm from "./CourseForm";
import { Badge, ErrorBox, Modal, Pager, tableCls, tdCls, thCls } from "./ui";

const LIMIT = 20;

export default function CoursesPanel({ onChanged }: { onChanged: () => void }) {
  const [data, setData] = useState<{ total: number; items: AdminCourse[] } | null>(null);
  const [q, setQ] = useState(""); const [category, setCategory] = useState("all"); const [offset, setOffset] = useState(0);
  const [modal, setModal] = useState<null | "create" | AdminCourse>(null);
  const [hidden, setHidden] = useState<boolean | "">("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    adminApi.courses({ q, category, hidden, limit: LIMIT, offset }).then(setData).catch((e) => setError(e.message));
  }, [q, category, hidden, offset]);
  useEffect(() => { const t = setTimeout(load, q ? 300 : 0); return () => clearTimeout(t); }, [load, q]);

  const done = () => { setModal(null); load(); onChanged(); };
  const create = async (body: CourseInput) => { await adminApi.createCourse(body); done(); };
  const update = (id: number) => async (body: CourseInput) => { await adminApi.updateCourse(id, body); done(); };
  const remove = async (c: AdminCourse) => {
    if (!confirm(`Xoá khóa học "${c.title}"?\n${c.enrollment_count} ghi danh liên quan cũng sẽ bị xoá.`)) return;
    try { await adminApi.deleteCourse(c.id); done(); } catch (e) { setError((e as Error).message); }
  };
  const toggleFeatured = async (c: AdminCourse) => {
    try { await adminApi.updateCourse(c.id, { featured: !c.featured }); load(); } catch (e) { setError((e as Error).message); }
  };

  const toggleHidden = async (c: AdminCourse) => {
    try { await adminApi.toggleCourseHidden(c.id); load(); onChanged(); } catch (e) { setError((e as Error).message); }
  };
  const hideEmpty = async () => {
    setBusy(true); setError("");
    try {
      const dry = await adminApi.hideEmptyCourses(true);
      if (!dry.hidden) { alert("Không có khóa nào trống để ẩn."); return; }
      const kept = dry.skipped_enrolled.length ? `\n\n${dry.skipped_enrolled.length} khóa trống nhưng đã có người ghi danh sẽ KHÔNG bị ẩn.` : "";
      if (!confirm(`Ẩn ${dry.hidden} khóa chưa có nội dung?\n\n${dry.slugs.slice(0, 12).join("\n")}${dry.slugs.length > 12 ? "\n…" : ""}${kept}`)) return;
      const r = await adminApi.hideEmptyCourses();
      load(); onChanged();
      alert(`Đã ẩn ${r.hidden} khóa. Bấm "Xuất bản" để website cập nhật.`);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <input className="input max-w-xs" placeholder="Tìm tiêu đề / slug…" value={q} onChange={(e) => { setQ(e.target.value); setOffset(0); }} />
        <select className="input max-w-[12rem]" value={category} onChange={(e) => { setCategory(e.target.value); setOffset(0); }}>
          {categories.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
        {([["", "Tất cả"], [false, "Đang hiện"], [true, "Đã ẩn"]] as const).map(([k, l]) => (
          <button key={String(k)} onClick={() => { setHidden(k); setOffset(0); }}
            className={`chip ${hidden === k ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-brand-300"}`}>{l}</button>
        ))}
        <div className="flex-1" />
        <button onClick={hideEmpty} disabled={busy} className="btn-outline disabled:opacity-60">🙈 Ẩn khóa chưa có nội dung</button>
        <button onClick={() => setModal("create")} className="btn-primary">+ Thêm khóa học</button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Khóa ẩn không hiện trong danh sách, tìm kiếm, sitemap và bản build tĩnh; link trực tiếp vẫn mở được để bạn xem trước.
        Ẩn/hiện xong nhớ bấm <b>Xuất bản</b> để website cập nhật.
      </p>
      <div className="mt-3"><ErrorBox message={error} /></div>

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className={tableCls}>
          <thead><tr>
            <th className={thCls}>Khóa học</th><th className={thCls}>Danh mục</th><th className={thCls}>Giá</th>
            <th className={thCls}>Lượt xem</th><th className={thCls}>Ghi danh</th><th className={thCls}>Nổi bật</th><th className={thCls}>Hiện</th><th className={thCls}></th>
          </tr></thead>
          <tbody>
            {!data && <tr><td className={tdCls} colSpan={7}>Đang tải…</td></tr>}
            {data?.items.length === 0 && <tr><td className={`${tdCls} text-slate-500`} colSpan={7}>Không có khóa học nào.</td></tr>}
            {data?.items.map((c) => (
              <tr key={c.id} className={`hover:bg-slate-50/60 ${c.hidden ? "bg-slate-50 text-slate-400" : ""}`}>
                <td className={tdCls}>
                  <div className="flex items-center gap-3">
                    <span className={`grid h-10 w-14 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-xl ${c.color}`}>{c.emoji}</span>
                    <div className="min-w-0">
                      <div className="max-w-[22rem] truncate font-medium text-slate-900">{c.title}</div>
                      <Link href={`/courses/${c.slug}`} target="_blank" className="font-mono text-xs text-slate-500 hover:text-brand-700">/{c.slug}</Link>
                    </div>
                  </div>
                </td>
                <td className={tdCls}><div className="flex flex-wrap gap-1">{c.tags.map((t) => <Badge key={t} tone={t === "free" ? "green" : "slate"}>{t}</Badge>)}</div></td>
                <td className={`${tdCls} whitespace-nowrap font-semibold ${c.price === 0 ? "text-emerald-600" : "text-slate-900"}`}>{formatVND(c.price)}</td>
                <td className={`${tdCls} whitespace-nowrap text-slate-600`}>{c.views.toLocaleString("vi-VN")}</td>
                <td className={`${tdCls} text-slate-600`}>{c.enrollment_count}</td>
                <td className={tdCls}>
                  <button onClick={() => toggleFeatured(c)} title="Bật/tắt nổi bật" className={`text-lg ${c.featured ? "" : "opacity-25 grayscale"}`}>⭐</button>
                </td>
                <td className={tdCls}>
                  <button onClick={() => toggleHidden(c)} title={c.hidden ? "Đang ẩn — bấm để hiện lại" : "Đang hiện — bấm để ẩn"}
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${c.hidden ? "bg-slate-200 text-slate-600" : "bg-emerald-50 text-emerald-700"}`}>
                    {c.hidden ? "Đã ẩn" : "Hiện"}
                  </button>
                </td>
                <td className={`${tdCls} whitespace-nowrap text-right`}>
                  <button onClick={() => setModal(c)} className="btn-outline !px-2.5 !py-1">Sửa</button>
                  <button onClick={() => remove(c)} className="btn-outline ml-1 !px-2.5 !py-1 !text-rose-600 hover:!border-rose-300">Xoá</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data && <Pager total={data.total} limit={LIMIT} offset={offset} onChange={setOffset} />}

      {modal && (
        <Modal wide title={modal === "create" ? "Thêm khóa học" : `Sửa: ${modal.title}`} onClose={() => setModal(null)}>
          <CourseForm initial={modal === "create" ? undefined : modal} onSubmit={modal === "create" ? create : update(modal.id)} onCancel={() => setModal(null)} />
        </Modal>
      )}
    </div>
  );
}
