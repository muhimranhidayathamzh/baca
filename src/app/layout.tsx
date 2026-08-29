import type { Metadata, Viewport } from "next";
import { Analytics } from "@vercel/analytics/next";
import AppShell from "@/components/layout/AppShell";
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
        <AppShell>{children}</AppShell>
        {/* Tanpa cookie; hanya aktif di produksi Vercel (SPEC.md langkah 29). */}
        <Analytics />
      </body>
    </html>
  );
}
