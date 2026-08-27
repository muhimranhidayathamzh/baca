import { Inter, Space_Grotesk, Spectral } from "next/font/google";

// Hook & heading: pede, penasaran, sampul majalah sains (SPEC.md Bagian 3)
export const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-space-grotesk",
  display: "swap",
});

// Badan bacaan: nyaman buat tenggelam (reading view)
export const spectral = Spectral({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-spectral",
  display: "swap",
});

// UI: label, meta, navigasi — netral, bersih
export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-inter",
  display: "swap",
});

export const fontVariables = `${spaceGrotesk.variable} ${spectral.variable} ${inter.variable}`;
