/** @type {import('next').NextConfig} */
// GitHub Pages phục vụ tại https://<user>.github.io/<repo>/ nên cần basePath khi build trên CI.
// Local dev: không đặt biến này → basePath rỗng, chạy ở http://localhost:3000 như cũ.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
// STATIC_EXPORT=1 (đặt trong workflow) → xuất HTML tĩnh vào out/. Dev local giữ chế độ server để
// notFound() trả 404 bình thường và không bị ràng buộc generateStaticParams của Next 14.
const staticExport = process.env.STATIC_EXPORT === "1";

const nextConfig = {
  ...(staticExport ? { output: "export" } : {}),
  basePath,
  trailingSlash: true, // mỗi route thành thư-mục/index.html → reload trang không bị 404 trên Pages
  images: { unoptimized: true }, // Pages không có server tối ưu ảnh
};
export default nextConfig;
