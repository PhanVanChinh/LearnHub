// Video của các bài KHÔNG miễn phí — CHỈ dùng cho script seed backend (scripts/export-courses.mts).
// KHÔNG import file này vào app/ hay components/: nội dung ở đó được xuất tĩnh lên GitHub Pages,
// ai cũng đọc được. Video bài trả phí chỉ nằm trong DB và được trả qua API sau khi kiểm tra ghi danh.
// Cấu trúc: slug → { chỉ_số_bài: youtubeId }
export const paidLessonVideos: Record<string, Record<number, string>> = {
  "video-nhap-mon-machine-learning": {
    2: "IHZwWFHWa-w", // Gradient descent
    3: "Ilg3gGewQ5U", // Backpropagation — trực giác
    4: "tIeHLnjs5U8", // Backpropagation — phần tính toán
  },
};
