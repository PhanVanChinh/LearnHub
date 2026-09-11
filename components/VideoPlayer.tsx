/** Nhúng video YouTube theo khung 16:9, dùng domain nocookie để hạn chế tracking. */
export default function VideoPlayer({ videoId, title, autoplay = false, className = "" }: {
  videoId: string; title: string; autoplay?: boolean; className?: string;
}) {
  const params = new URLSearchParams({ rel: "0", modestbranding: "1", playsinline: "1", ...(autoplay ? { autoplay: "1" } : {}) });
  return (
    <div className={`relative aspect-video w-full overflow-hidden rounded-2xl bg-black shadow-card ${className}`}>
      <iframe
        key={videoId}
        src={`https://www.youtube-nocookie.com/embed/${videoId}?${params}`}
        title={title}
        loading="lazy"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        className="absolute inset-0 h-full w-full"
      />
    </div>
  );
}

export const youtubeThumb = (videoId: string) => `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
