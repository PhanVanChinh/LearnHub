"use client";
import { useState } from "react";

/** Dãy 5 sao. Có onChange → chọn được (hover xem trước); không → chỉ hiển thị, hỗ trợ nửa sao theo `value`. */
export default function Stars({ value, onChange, size = "text-xl", label }: { value: number; onChange?: (v: number) => void; size?: string; label?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value;
  return (
    <span className={`inline-flex items-center gap-0.5 ${size}`} role={onChange ? "radiogroup" : "img"} aria-label={label ?? `${value} trên 5 sao`}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = shown >= i ? 1 : shown >= i - 0.5 ? 0.5 : 0;
        const star = (
          <span className="relative inline-block leading-none">
            <span className="text-slate-300">★</span>
            <span className="absolute inset-0 overflow-hidden text-amber-400" style={{ width: `${fill * 100}%` }}>★</span>
          </span>
        );
        return onChange ? (
          <button key={i} type="button" role="radio" aria-checked={value === i} aria-label={`${i} sao`}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => onChange(i)}
            className="cursor-pointer transition hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400">
            {star}
          </button>
        ) : <span key={i}>{star}</span>;
      })}
    </span>
  );
}
