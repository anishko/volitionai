import type { Metadata } from "next";
import localFont from "next/font/local";
import { IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Site-wide type system:
//  · Gambarino (regular) — display serif, all headings
//  · Switzer — body sans; light (300) is the default weight for small text,
//    with heavier cuts available for buttons/labels
//  · Plex Mono — the machine-evidence voice: citations, costs, the ledger
// Gambarino & Switzer are Fontshare faces, self-hosted from app/fonts.
const gambarino = localFont({
  src: "./fonts/Gambarino-Regular.woff2",
  weight: "400",
  variable: "--font-display",
});

const switzer = localFont({
  src: [
    { path: "./fonts/Switzer-Light.woff2", weight: "300", style: "normal" },
    { path: "./fonts/Switzer-Regular.woff2", weight: "400", style: "normal" },
    { path: "./fonts/Switzer-Medium.woff2", weight: "500", style: "normal" },
    { path: "./fonts/Switzer-Semibold.woff2", weight: "600", style: "normal" },
  ],
  variable: "--font-sans",
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Volition — find the rooms where your donors already are",
  description:
    "Fundraising-event intelligence for nonprofits: matched conferences, donor signals from 990 filings, every claim cited and every cost on the receipt.",
  icons: { icon: "/volition-logo.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${gambarino.variable} ${switzer.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
