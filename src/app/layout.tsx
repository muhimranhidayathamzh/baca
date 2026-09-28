import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import Script from "next/script";
import AppShell from "@/components/layout/AppShell";
import { FEED_PRELOAD_SCRIPT } from "@/lib/feed-preload";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "baca.",
  description:
    "Platform baca jurnal & paper akademis bergaya feed — paper relevan datang ke kamu, bukan search seperti Google Scholar.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    // iOS tidak membaca manifest untuk ikon homescreen — ia butuh
    // apple-touch-icon sendiri.
    statusBarStyle: "black-translucent",
    title: "baca.",
    startupImage: [],
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1B1E24",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${fontVariables} h-full`}>
      <body className="antialiased">
        {/*
          Preload /api/feed saat HTML diparse (lihat lib/feed-preload.ts).
          `beforeInteractive` hanya ada di HTML awal dan tidak pernah
          di-render ulang saat navigasi client — tag <script> biasa di dalam
          komponen memicu error React ketika dirender di browser.
        */}
        <Script
          id="feed-preload"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{ __html: FEED_PRELOAD_SCRIPT }}
        />
        <AppShell>{children}</AppShell>
        {/* Tanpa cookie; hanya aktif di produksi Vercel (SPEC.md langkah 29). */}
        <Analytics />
      </body>
    </html>
  );
}
