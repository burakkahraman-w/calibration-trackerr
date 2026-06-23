"use client";

import { usePathname } from "next/navigation";

const TOOLTIP =
  "For errors, issues, and changes, contact Burak Kahraman.";

/**
 * Subtle “?” in the bottom-left; fully visible on hover (or keyboard focus).
 */
export function ContactHelpButton() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;

  return (
    <div
      className="group pointer-events-auto fixed bottom-0 left-0 z-[200] flex h-20 w-20 items-end justify-start p-2"
      style={{
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
        paddingLeft: "max(0.5rem, env(safe-area-inset-left, 0px))",
      }}
    >
      <button
        type="button"
        tabIndex={0}
        aria-label={TOOLTIP}
        className="relative flex h-9 w-9 cursor-help items-center justify-center rounded-full border border-slate-200/60 bg-white/50 text-[13px] font-semibold text-slate-400 opacity-40 shadow-sm transition-all duration-200 hover:border-sky-300/80 hover:bg-white hover:text-sky-700 hover:opacity-100 hover:shadow-md focus-visible:border-sky-400 focus-visible:bg-white focus-visible:text-sky-700 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 group-hover:border-sky-300/80 group-hover:bg-white group-hover:text-sky-700 group-hover:opacity-100 group-hover:shadow-md"
      >
        <span className="select-none leading-none" aria-hidden>
          ?
        </span>
        <span
          className="pointer-events-none absolute bottom-full left-0 mb-2 w-max max-w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-slate-200 bg-white px-3 py-2 text-left text-xs font-normal normal-case tracking-normal text-slate-700 opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100"
          role="tooltip"
        >
          {TOOLTIP}
        </span>
      </button>
    </div>
  );
}
