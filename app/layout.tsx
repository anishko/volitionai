import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// The Evidence Dossier type system:
//  · Fraunces  — warm literary serif, the human/mission voice (display)
//  · Plex Sans — humanist grotesque, credible workhorse (body)
//  · Plex Mono — the machine-evidence voice: citations, costs, the ledger
const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  axes: ["opsz", "SOFT"],
});

const plexSans = IBM_Plex_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
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
      className={`${fraunces.variable} ${plexSans.variable} ${plexMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
