import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Admin — Calibration tracker",
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <div className="admin-surface min-h-screen px-4 py-10 sm:px-6">
      <div className="pointer-events-none fixed inset-0 -z-10 admin-admin-bg" aria-hidden />
      {children}
    </div>
  );
}
