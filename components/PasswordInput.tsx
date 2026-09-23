"use client";
import { useState } from "react";

type Props = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> & { invalid?: boolean };

/** Ô mật khẩu có nút hiện/ẩn. */
export default function PasswordInput({ invalid, className = "", ...props }: Props) {
    const [show, setShow] = useState(false);
    return (
        <div className="relative">
            <input
                aria-label={typeof props.placeholder === "string" && !props.id ? props.placeholder : undefined}
                {...props}
                type={show ? "text" : "password"}
                className={`input pr-16 ${invalid ? "!border-rose-400 !ring-rose-100" : ""} ${className}`}
            />
            <button
                type="button"
                onClick={() => setShow(!show)}
                tabIndex={-1}
                aria-label={show ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                className="absolute inset-y-0 right-2 my-auto h-7 rounded px-2 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
                {show ? "Ẩn" : "Hiện"}
            </button>
        </div>
    );
}
