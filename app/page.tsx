// Landing page — Attio-style: one giant centered claim and a tabbed
// live-HTML product preview instead of a screenshot. Palette mirrors the
// login page's olive/greige theme, inlined and scoped to this page. Type
// comes from the global scheme (Gambarino headings / Switzer Light body).
import { LandingPage } from "@/components/landing-page";

export const metadata = {
  title: "Volition — the insights team engineered for your mission",
  description:
    "Volition researches your world live and finds the donors, sponsors, and events your org runs on — every claim cited, every cost printed on the receipt.",
};

export default function Home() {
  return <LandingPage />;
}
