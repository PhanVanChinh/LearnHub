"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

/** Nội dung bài học dạng Markdown (bài đọc, code, bảng, checklist). Không render HTML thô → an toàn với nội dung admin nhập.
 *  Kiểu chữ ở class .md trong globals.css (nền tối của trang học). */
export default function LessonContent({ markdown, className = "" }: { markdown: string; className?: string }) {
  return (
    <article className={`md rounded-xl border border-white/10 bg-white/5 p-5 sm:p-7 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Link ngoài mở tab mới, không lộ referrer; link nội bộ (/courses/...) giữ nguyên
          a: ({ href, children }) => {
            const ext = !!href && /^https?:\/\//.test(href);
            return <a href={href} target={ext ? "_blank" : undefined} rel={ext ? "noopener noreferrer" : undefined}>{children}</a>;
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </article>
  );
}
