import type { Metadata } from "next";
import { Inter, Manrope } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const manrope = Manrope({ subsets: ["latin"], variable: "--font-manrope" });

export const metadata: Metadata = {
  title: "Commune — Community OS",
  description: "The operating system for modern membership communities.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    // Some mobile browsers (in-app AI/proxy renderers in particular) inject their own
    // attributes onto <html> before React hydrates, e.g. __gcrremoteframetoken. That is
    // outside our control and harmless, so it is suppressed rather than left to surface
    // as a full-screen dev-mode hydration error.
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${manrope.variable}`}>{children}</body>
    </html>
  );
}
