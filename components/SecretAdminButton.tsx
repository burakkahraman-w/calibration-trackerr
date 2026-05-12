"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Invisible until you hover the bottom-right corner (or Tab to focus).
 * Keeps the affordance off casual viewers’ radar.
 */
export function SecretAdminButton() {
  const pathname = usePathname();
  if (pathname?.startsWith("/admin")) return null;

  return (
    <div
      className="group pointer-events-auto fixed bottom-0 right-0 z-[100] flex h-16 w-16 items-end justify-end p-2"
      style={{
        paddingBottom: "max(0.5rem, env(safe-area-inset-bottom, 0px))",
        paddingRight: "max(0.5rem, env(safe-area-inset-right, 0px))",
      }}
    >
      <Link
        href="/admin"
        tabIndex={0}
        title=""
        aria-label="Admin"
        className="flex h-9 w-9 cursor-default items-center justify-center rounded-full border border-transparent bg-transparent text-[11px] text-transparent opacity-0 shadow-none transition-all duration-200 pointer-events-none group-hover:pointer-events-auto group-hover:cursor-pointer group-hover:border-violet-300/70 group-hover:bg-white/95 group-hover:text-violet-600 group-hover:opacity-100 group-hover:shadow-md focus-visible:pointer-events-auto focus-visible:cursor-pointer focus-visible:border-violet-400 focus-visible:bg-white focus-visible:text-violet-600 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300"
      >
        <span className="select-none font-mono leading-none" aria-hidden>
          ◆
        </span>
      </Link>
    </div>
  );
}
