import type { Metadata } from "next";
import { Inter, Noto_Sans_Bengali, Patrick_Hand } from "next/font/google";
import "./globals.css";

// Patrick Hand: hand-lettered voice for chrome, buttons, labels (playful UI direction).
// Inter for readable text. Noto Sans Bengali so Bangla headlines stay legible.
const hand = Patrick_Hand({ subsets: ["latin"], weight: "400", variable: "--font-hand", display: "swap" });
const sans = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });
const bengali = Noto_Sans_Bengali({
  subsets: ["bengali"],
  weight: ["400", "500", "600"],
  variable: "--font-bn",
  display: "swap",
});

export const metadata: Metadata = {
  title: "News Archive",
  description: "Search Bangladeshi news archive by topic, tag, date and outlet. A project of Activate Rights.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${hand.variable} ${sans.variable} ${bengali.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
