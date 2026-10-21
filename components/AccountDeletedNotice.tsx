"use client";
import { useEffect, useState } from "react";

/** Trang chủ sau khi xóa tài khoản (?deleted=1): báo đã xóa xong thay vì về trang chủ im lặng. Trang xuất tĩnh nên đọc
 *  query sau khi mount, rồi bỏ tham số khỏi URL để tải lại / chia sẻ link không hiện lại thông báo. */
export default function AccountDeletedNotice() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get("deleted") !== "1") return;
    setShow(true);
    sp.delete("deleted");
    const qs = sp.toString();
    window.history.replaceState(window.history.state, "", `${window.location.pathname}${qs ? `?${qs}` : ""}${window.location.hash}`);
  }, []);
  if (!show) return null;
  return (
    <div role="status" className="border-b border-emerald-200 bg-emerald-50">
      <div className="container-x flex items-start justify-between gap-4 py-3 text-sm text-emerald-800">
        <p>
          <b>Tài khoản của bạn đã được xóa.</b> Dữ liệu học tập đã bị xóa; đơn hàng đã thanh toán được giữ ở dạng ẩn danh theo quy định kế toán.
          Cảm ơn bạn đã dùng LearnHub.
        </p>
        <button onClick={() => setShow(false)} aria-label="Đóng thông báo" className="shrink-0 rounded px-2 text-emerald-700 hover:bg-emerald-100">✕</button>
      </div>
    </div>
  );
}
