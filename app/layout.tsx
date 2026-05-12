import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Suspense } from "react";
import "./globals.css";
import { SecretAdminButton } from "@/components/SecretAdminButton";

export const metadata: Metadata = {
  title: "Vehicle calibration tracker",
  description: "Shared vehicle calibration status for the team",
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-[#eef2fa] font-sans text-slate-900 antialiased">
        {children}
        <Suspense fallback={null}>
          <SecretAdminButton />
        </Suspense>
      </body>
    </html>
  );
}
