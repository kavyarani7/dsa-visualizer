import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "DSA Visualizer",
  description: "Practice DSA problems and watch your algorithm run, step by step.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-10">
            <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
              <Link href="/" className="font-semibold text-lg tracking-tight">
                <span className="text-emerald-400">DSA</span> Visualizer
              </Link>
              <div className="flex items-center gap-4">
                <span className="text-xs text-slate-400 hidden sm:inline">
                  submit correct JS → watch it animate
                </span>
                <Link href="/admin" className="text-xs text-slate-400 hover:text-slate-200">
                  Admin
                </Link>
              </div>
            </div>
          </header>
          <main className="flex-1">{children}</main>
        </div>
      </body>
    </html>
  );
}
