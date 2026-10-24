/** Emoji dùng làm biểu tượng. Mặc định là trang trí → ẩn khỏi trình đọc màn hình (không đọc "books", "eye"...).
 *  Có `label` khi emoji mang nghĩa mà chữ bên cạnh không nói ra (vd 🔒 = cần ghi danh): đọc đúng label, hiện tooltip. */
export default function Emoji({ children, label, className }: { children: string; label?: string; className?: string }) {
  return label
    ? <span role="img" aria-label={label} title={label} className={className}>{children}</span>
    : <span aria-hidden="true" className={className}>{children}</span>;
}
