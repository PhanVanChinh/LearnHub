/** @type {import('next').NextConfig} */
// GitHub Pages phục vụ tại https://<user>.github.io/<repo>/ nên cần basePath khi build trên CI.
// Local dev: không đặt biến này → basePath rỗng, chạy ở http://localhost:3000 như cũ.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig = {
  output: "export", // xuất HTML tĩnh vào thư mục out/ (cần cho GitHub Pages)
  basePath,
  trailingSlash: true, // mỗi route thành thư-mục/index.html → reload trang không bị 404 trên Pages
  images: { unoptimized: true }, // Pages không có server tối ưu ảnh
};
export default nextConfig;
