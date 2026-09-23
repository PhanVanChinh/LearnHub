// Font có đủ dấu tiếng Việt cho ảnh Open Graph (ImageResponse mặc định không có glyph tiếng Việt → chữ ô vuông).
// Tải Be Vietnam Pro từ Google Fonts LÚC BUILD; không có mạng → trả null, ImageResponse dùng font mặc định.
let cache: Promise<ArrayBuffer | null> | null = null;

export function ogFont(): Promise<ArrayBuffer | null> {
  cache ??= (async () => {
    try {
      const css = await fetch("https://fonts.googleapis.com/css2?family=Be+Vietnam+Pro:wght@700&display=swap",
        { headers: { "User-Agent": "Mozilla/5.0" } }).then((r) => r.text());
      const url = css.match(/src: url\((https:[^)]+\.(?:ttf|woff2?))\)/)?.[1] ?? css.match(/url\((https:[^)]+)\)/)?.[1];
      if (!url) return null;
      const res = await fetch(url);
      return res.ok ? await res.arrayBuffer() : null;
    } catch { return null; }
  })();
  return cache;
}
