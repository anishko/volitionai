"use client";

// Attio-style landing page for Volition.
// Palette mirrors the login page (the app's global light theme): greige
// ground, dark-olive ink, olive primary actions, brass signal accent, warm
// paper surfaces. Values are inlined here so the page stays self-contained.
// The product preview is a live HTML mockup behind tabs — no screenshots to
// go stale.

import { lazy, Suspense, useState } from "react";
import Link from "next/link";
import {
  motion,
  useMotionValue,
  useMotionTemplate,
  type Variants,
} from "framer-motion";

// Green dithering shader (21st.dev-style). Lazy + client-only: it needs WebGL,
// so it must not run during SSR. Fades in once the chunk loads.
const Dithering = lazy(() =>
  import("@paper-design/shaders-react").then((m) => ({ default: m.Dithering })),
);

const BG = "#e7e3d7"; // page ground (login --background)
const INK = "#2c2e23"; // text (--foreground)
const MUTED = "#6c6c58"; // secondary text (--muted-foreground)
const BORDER = "#d4cebd"; // hairlines (--border)
const SURFACE = "#f6f3ec"; // cards / chrome (--card)
const SOFT = "#ece8da"; // subtle fills, hovers
const SIDEBAR = "#e2ddcf"; // mock sidebar (--sidebar)
const ACCENT = "#dfddcb"; // selected fills (--accent)
const OLIVE = "#737f47"; // primary actions (--brand)
const OLIVE_FG = "#f6f4ea"; // text on olive (--brand-foreground)
const GOLD = "#8f7d33"; // signal accent (--signal)

/* ────────────────────────── shared bits ────────────────────────── */

// Code-rendered monogram: a bold ink "V" with a small white "o" dot nested
// onto its right stroke. No image asset. The dot is white, so it only reads
// where it overlaps the dark stroke — hence it sits on the stroke, not beside.
function Monogram({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <path
        d="M6.5 7.5 L16 24.5 L25.5 7.5"
        stroke={INK}
        strokeWidth={5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="22.6" cy="12.6" r="3.1" fill="#fff" />
    </svg>
  );
}

function Wordmark({ size = 28, showText = true }: { size?: number; showText?: boolean }) {
  return (
    <span className="flex items-center gap-2">
      <Monogram size={size} />
      {showText && (
        <span
          className="text-[17px] font-semibold tracking-tight"
          style={{ color: INK }}
        >
          Volition
        </span>
      )}
    </span>
  );
}

function CitationChip({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 font-mono text-[10px] leading-none"
      style={{ borderColor: BORDER, color: MUTED, background: SOFT }}
    >
      <span style={{ color: GOLD }}>↗</span>
      {children}
    </span>
  );
}

/* ─────────────────────── product preview tabs ─────────────────────── */

const TABS = [
  { id: "events", label: "Matched events" },
  { id: "ideas", label: "Idea cards" },
  { id: "receipt", label: "Cost receipt" },
  { id: "profile", label: "Org profile" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function BrowserChrome({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="overflow-hidden rounded-2xl border shadow-[0_24px_60px_-24px_rgba(44,46,35,0.35)]"
      style={{ borderColor: BORDER, background: SURFACE }}
    >
      <div
        className="flex items-center gap-2 border-b px-4 py-2.5"
        style={{ borderColor: BORDER }}
      >
        <span className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: BORDER }}
            />
          ))}
        </span>
        <span
          className="mx-auto rounded-md border px-3 py-0.5 font-mono text-[10px]"
          style={{ borderColor: BORDER, color: MUTED }}
        >
          app.volition.ai/dashboard
        </span>
        <span className="w-10" />
      </div>
      {children}
    </div>
  );
}

function MockSidebar() {
  const items = ["Events", "Ideas", "Drafts", "Receipts"];
  return (
    <aside
      className="hidden w-48 shrink-0 border-r px-3 py-4 sm:block"
      style={{ borderColor: BORDER, background: SIDEBAR }}
    >
      <div className="flex items-center gap-2 px-2">
        <span
          className="grid h-6 w-6 place-items-center rounded-md text-[10px] font-semibold"
          style={{ background: OLIVE, color: OLIVE_FG }}
        >
          B&B
        </span>
        <span className="text-xs font-medium" style={{ color: INK }}>
          Bull &amp; Bear Society
        </span>
      </div>
      <nav className="mt-4 space-y-0.5">
        {items.map((label, i) => (
          <div
            key={label}
            className="rounded-md px-2 py-1.5 text-xs"
            style={
              i === 0
                ? { background: ACCENT, color: INK, fontWeight: 500 }
                : { color: MUTED }
            }
          >
            {label}
          </div>
        ))}
      </nav>
    </aside>
  );
}

function EventsPanel() {
  const rows = [
    {
      name: "Global Student Finance Summit",
      meta: "Mar 14 · Chicago, IL",
      score: 94,
      cite: "gsfs.org/sponsors",
    },
    {
      name: "Midwest Fintech Career Expo",
      meta: "Apr 2 · Columbus, OH",
      score: 88,
      cite: "midwestfintech.com",
    },
    {
      name: "CFA Institute Campus Outreach Day",
      meta: "Apr 18 · Virtual",
      score: 81,
      cite: "cfainstitute.org/events",
    },
  ];
  return (
    <div className="flex-1 p-4 sm:p-5">
      <div className="flex items-baseline justify-between">
        <h3 className="font-sans text-sm font-semibold" style={{ color: INK }}>
          Matched events
        </h3>
        <span className="font-mono text-[10px]" style={{ color: MUTED }}>
          12 found · scanned live 2m ago
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {rows.map((r) => (
          <div
            key={r.name}
            className="flex items-center gap-3 rounded-xl border p-3"
            style={{ borderColor: BORDER }}
          >
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-xs font-semibold tabular-nums"
              style={{ background: "#ece4cb", color: GOLD }}
            >
              {r.score}
            </span>
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-[13px] font-medium"
                style={{ color: INK }}
              >
                {r.name}
              </p>
              <p className="text-[11px]" style={{ color: MUTED }}>
                {r.meta}
              </p>
            </div>
            <span className="hidden md:block">
              <CitationChip>{r.cite}</CitationChip>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function IdeasPanel() {
  const cards = [
    {
      lane: "Comparable",
      title: "Run a paper-trading league, sponsored",
      body: "Top university finance clubs fund competitions through brokerage sponsorships — three named programs found.",
      cite: "wsj.com/university-investing",
    },
    {
      lane: "Opportunity",
      title: "Pitch fintech recruiting budgets",
      body: "Four fintechs are actively recruiting on your campus this term. Sponsorship is a warm intro, not a cold ask.",
      cite: "linkedin.com/jobs",
    },
    {
      lane: "Trend",
      title: "Short-form market explainers",
      body: "Finance explainer content is up 3× with students this quarter. Your niche: live trade breakdowns.",
      cite: "youtube.com/trends",
    },
  ];
  return (
    <div className="flex-1 p-4 sm:p-5">
      <div className="grid gap-2 sm:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.lane}
            className="flex flex-col rounded-xl border p-3.5"
            style={{ borderColor: BORDER }}
          >
            <span
              className="font-mono text-[9px] font-semibold uppercase tracking-[0.14em]"
              style={{ color: GOLD }}
            >
              {c.lane}
            </span>
            <p
              className="mt-1.5 text-[13px] font-semibold leading-snug"
              style={{ color: INK }}
            >
              {c.title}
            </p>
            <p
              className="mt-1.5 flex-1 text-[11px] leading-relaxed"
              style={{ color: MUTED }}
            >
              {c.body}
            </p>
            <span className="mt-3">
              <CitationChip>{c.cite}</CitationChip>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ReceiptPanel() {
  const lines = [
    { stage: "Profile extraction", model: "qwen3:8b · local", cost: "$0.000" },
    { stage: "Research plan", model: "qwen3:8b · local", cost: "$0.000" },
    { stage: "Web research", model: "Tavily × 6 queries", cost: "$0.008" },
    { stage: "Synthesis + citations", model: "Haiku 4.5 · cloud", cost: "$0.031" },
    { stage: "Draft in your voice", model: "qwen3:8b · local", cost: "$0.000" },
  ];
  return (
    <div className="flex flex-1 items-center justify-center p-4 sm:p-6">
      <div
        className="w-full max-w-sm rounded-xl border font-mono text-[11px]"
        style={{ borderColor: BORDER }}
      >
        <div
          className="border-b px-4 py-2.5 text-[10px] uppercase tracking-[0.14em]"
          style={{ borderColor: BORDER, color: MUTED }}
        >
          Cost receipt · run #482
        </div>
        <div className="space-y-2 px-4 py-3">
          {lines.map((l) => (
            <div key={l.stage} className="flex items-baseline gap-2">
              <span style={{ color: INK }}>{l.stage}</span>
              <span
                className="flex-1 border-b border-dotted"
                style={{ borderColor: BORDER }}
              />
              <span style={{ color: MUTED }}>{l.model}</span>
              <span className="tabular-nums" style={{ color: INK }}>
                {l.cost}
              </span>
            </div>
          ))}
        </div>
        <div
          className="flex items-baseline justify-between border-t px-4 py-2.5"
          style={{ borderColor: BORDER }}
        >
          <span style={{ color: MUTED }}>58% of tokens ran locally at $0</span>
          <span className="text-sm font-semibold tabular-nums" style={{ color: INK }}>
            $0.039
          </span>
        </div>
      </div>
    </div>
  );
}

function ProfilePanel() {
  const goals = ["Find sponsors", "Grow membership", "Trading competition"];
  const voice = ["Confident", "Data-first", "Student-casual"];
  return (
    <div className="flex-1 p-4 sm:p-5">
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl border p-4" style={{ borderColor: BORDER }}>
          <p
            className="font-mono text-[9px] uppercase tracking-[0.14em]"
            style={{ color: MUTED }}
          >
            Extracted profile
          </p>
          <p className="mt-2 text-[13px] font-semibold" style={{ color: INK }}>
            Student trading &amp; investing club
          </p>
          <p className="mt-1 text-[11px] leading-relaxed" style={{ color: MUTED }}>
            Large public university · ~140 members · weekly market meetings
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {goals.map((g) => (
              <span
                key={g}
                className="rounded-full border px-2 py-0.5 text-[10px]"
                style={{ borderColor: BORDER, color: INK }}
              >
                {g}
              </span>
            ))}
          </div>
        </div>
        <div className="rounded-xl border p-4" style={{ borderColor: BORDER }}>
          <p
            className="font-mono text-[9px] uppercase tracking-[0.14em]"
            style={{ color: MUTED }}
          >
            Voice · from your past posts
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {voice.map((v) => (
              <span
                key={v}
                className="rounded-full px-2.5 py-1 text-[11px] font-medium"
                style={{ background: ACCENT, color: INK }}
              >
                {v}
              </span>
            ))}
          </div>
          <p className="mt-3 text-[11px] leading-relaxed" style={{ color: MUTED }}>
            Built from 2 uploaded docs, then the raw files were discarded.
            Volition keeps the profile — never your documents.
          </p>
        </div>
      </div>
    </div>
  );
}

function ProductPreview() {
  const [tab, setTab] = useState<TabId>("events");
  const panels: Record<TabId, React.ReactNode> = {
    events: <EventsPanel />,
    ideas: <IdeasPanel />,
    receipt: <ReceiptPanel />,
    profile: <ProfilePanel />,
  };
  return (
    <div>
      <div
        className="flex overflow-x-auto border-b"
        style={{ borderColor: BORDER }}
        role="tablist"
        aria-label="Product preview"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className="-mb-px flex-1 whitespace-nowrap border-b-2 px-6 py-3.5 text-sm transition-colors"
            style={
              tab === t.id
                ? { borderColor: OLIVE, color: INK, fontWeight: 600 }
                : { borderColor: "transparent", color: MUTED }
            }
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="px-3 pb-3 pt-8 sm:px-10">
        <BrowserChrome>
          <div className="flex min-h-[300px]" key={tab}>
            <MockSidebar />
            {panels[tab]}
          </div>
        </BrowserChrome>
      </div>
    </div>
  );
}

/* ───────────────────────────── sections ───────────────────────────── */

function Nav() {
  const links = [
    { label: "How it works", href: "#how" },
    { label: "Why Volition", href: "#why" },
    { label: "Events", href: "/events" },
  ];
  // Frosted-cream "island" surface shared by the nav pill and the outline
  // buttons — translucent so the green dithering reads through it, blurred so
  // whatever scrolls underneath stays legible.
  const island = {
    borderColor: "rgba(212,206,189,0.7)",
    background: "rgba(246,243,236,0.55)",
  };
  return (
    // Transparent, borderless header — the hero + dithering run to the very
    // top of the page and show through behind it.
    <header className="sticky top-0 z-40">
      <div className="mx-auto grid h-20 max-w-6xl grid-cols-[1fr_auto_1fr] items-center px-5 sm:px-8">
        <Link
          href="/"
          aria-label="Volition home"
          className="justify-self-start"
        >
          <Wordmark />
        </Link>

        {/* Center: the translucent island of nav links */}
        <nav
          className="hidden items-center gap-1 rounded-full border px-1.5 py-1 shadow-[0_12px_34px_-18px_rgba(44,46,35,0.55)] backdrop-blur-md md:flex"
          style={island}
        >
          {links.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className="rounded-full px-4 py-1.5 text-sm transition-colors hover:bg-[rgba(236,232,218,0.85)]"
              style={{ color: MUTED }}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2.5 justify-self-end">
          <Link
            href="/login"
            className="hidden rounded-full border px-4 py-2 text-sm font-medium backdrop-blur-md transition-colors hover:bg-[rgba(236,232,218,0.85)] sm:block"
            style={{ ...island, color: INK }}
          >
            Sign in
          </Link>
          <Link
            href="/login"
            className="rounded-full px-4 py-2 text-sm font-medium shadow-[0_12px_34px_-18px_rgba(44,46,35,0.55)] transition-opacity hover:opacity-90"
            style={{ background: OLIVE, color: OLIVE_FG }}
          >
            Start for free
          </Link>
        </div>
      </div>
    </header>
  );
}

// Full-bleed green dithering behind the hero. Transparent back + `multiply`
// blend means only the olive ink lands on the cream (it tints, never darkens
// to a block), and the radial mask fades it out toward the edges and the
// product preview below — so it melts into the page rather than sitting on it.
function HeroDither() {
  const mask =
    "radial-gradient(118% 78% at 50% 20%, #000 0%, #000 32%, transparent 74%)";
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute left-1/2 top-[-120px] z-0 h-[860px] w-screen -translate-x-1/2 select-none"
      style={{
        opacity: 0.26,
        mixBlendMode: "multiply",
        maskImage: mask,
        WebkitMaskImage: mask,
      }}
    >
      <Suspense fallback={null}>
        <Dithering
          className="h-full w-full"
          colorBack="#00000000"
          colorFront={OLIVE}
          shape="warp"
          type="4x4"
          size={2}
          speed={0.3}
        />
      </Suspense>
    </div>
  );
}

function Hero() {
  return (
    <div className="relative px-5 pt-14 text-center sm:px-8 sm:pt-20">
      <HeroDither />
      <div className="relative z-10">
      <Link
        href="/events"
        className="rise inline-flex items-center gap-1.5 rounded-full border px-4 py-1.5 text-sm transition-colors hover:bg-[#ece8da]"
        style={{ borderColor: BORDER, color: MUTED, background: SURFACE }}
      >
        New — live event matching for nonprofits
        <span aria-hidden style={{ color: OLIVE }}>
          ›
        </span>
      </Link>
      <h1
        className="rise mx-auto mt-6 max-w-4xl text-5xl leading-[1.06] tracking-[-0.015em] sm:text-7xl"
        style={{ color: INK, animationDelay: "60ms" }}
      >
        The insights team engineered for your mission.
      </h1>
      <p
        className="rise mx-auto mt-6 max-w-2xl text-lg leading-relaxed sm:text-xl"
        style={{ color: MUTED, animationDelay: "120ms" }}
      >
        Volition researches your world live and finds the donors, sponsors,
        and events your org runs on — every claim cited, every cost printed
        on the receipt.
      </p>
      <div
        className="rise mt-9 flex items-center justify-center gap-3"
        style={{ animationDelay: "180ms" }}
      >
        <Link
          href="/login"
          className="rounded-[10px] px-6 py-3 text-base font-medium transition-opacity hover:opacity-90"
          style={{ background: OLIVE, color: OLIVE_FG }}
        >
          Start for free
        </Link>
        <a
          href="#how"
          className="rounded-[10px] border px-6 py-3 text-base font-medium transition-colors hover:bg-[#ece8da]"
          style={{ borderColor: BORDER, color: INK, background: SURFACE }}
        >
          How it works
        </a>
      </div>
      </div>
    </div>
  );
}

function BuiltForStrip() {
  const orgs = [
    "Student clubs",
    "Nonprofits",
    "Small businesses",
    "Sports teams",
    "Advocacy groups",
    "Associations",
  ];
  return (
    <section className="border-y" style={{ borderColor: BORDER }}>
      <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
        <p
          className="text-center font-mono text-[11px] uppercase tracking-[0.18em]"
          style={{ color: MUTED }}
        >
          One engine, any small org
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-x-10 gap-y-3">
          {orgs.map((o) => (
            <span
              key={o}
              className="text-base font-semibold tracking-tight"
              style={{ color: "#a09e85" }}
            >
              {o}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

// Shared motion for the card sections. Interaction is borrowed from a glassy
// pricing-card reference, but retuned to Volition: warm cream cards (no
// glass), a faint OLIVE cursor spotlight, and the "paper-settling" ease
// instead of bouncy springs. Cards reveal in a stagger on scroll, their
// contents build in after, and each lifts gently on hover.
const EASE: [number, number, number, number] = [0.22, 0.61, 0.36, 1];

const cardGroup: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};

const cardItem: Variants = {
  hidden: { opacity: 0, y: 28, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.55,
      ease: EASE,
      staggerChildren: 0.07,
      delayChildren: 0.12,
    },
  },
};

const legoItem: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE } },
};

function SpotlightCard({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  const mx = useMotionValue(0);
  const my = useMotionValue(0);

  function handleMove(e: React.MouseEvent) {
    const rect = e.currentTarget.getBoundingClientRect();
    mx.set(e.clientX - rect.left);
    my.set(e.clientY - rect.top);
  }

  return (
    <motion.div
      variants={cardItem}
      onMouseMove={handleMove}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.25, ease: EASE }}
      className={`group relative overflow-hidden rounded-2xl border transition-shadow duration-500 hover:shadow-[0_28px_60px_-30px_rgba(44,46,35,0.45)] ${className}`}
      style={{ borderColor: BORDER, background: SURFACE }}
    >
      {/* Cursor-following olive spotlight — faint, fades in on hover */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 opacity-0 transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background: useMotionTemplate`radial-gradient(440px circle at ${mx}px ${my}px, rgba(115,127,71,0.10), transparent 68%)`,
        }}
      />
      <div className="relative z-10 flex h-full flex-col">{children}</div>
    </motion.div>
  );
}

function Pillars() {
  const pillars = [
    {
      title: "Grounded",
      heading: "Citation or no card",
      body: "Every idea ships with the evidence behind it — real URLs from live research, not model recall. If we can't source it, you never see it.",
    },
    {
      title: "Yours",
      heading: "It knows your org",
      body: "A persistent profile and voice built from your actual content. Generic tools restart from zero every conversation; Volition compounds.",
    },
    {
      title: "Auditable",
      heading: "Every answer shows its receipt",
      body: "Hybrid local-and-cloud routing runs roughly half your tokens at $0 on open-weight models — and prints the exact split on every run.",
    },
  ];
  return (
    <section id="why" className="scroll-mt-20">
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <p
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: GOLD }}
        >
          Why Volition
        </p>
        <h2
          className="mt-3 max-w-2xl text-3xl tracking-[-0.01em] sm:text-4xl"
          style={{ color: INK }}
        >
          A chatbot gives you plausible. Volition gives you sourced.
        </h2>
        <motion.div
          className="mt-12 grid gap-4 md:grid-cols-3"
          variants={cardGroup}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {pillars.map((p) => (
            <SpotlightCard key={p.title} className="p-7">
              <motion.span
                variants={legoItem}
                className="font-mono text-[10px] font-semibold uppercase tracking-[0.16em]"
                style={{ color: GOLD }}
              >
                {p.title}
              </motion.span>
              <motion.h3
                variants={legoItem}
                className="mt-3 text-xl tracking-tight"
                style={{ color: INK }}
              >
                {p.heading}
              </motion.h3>
              <motion.p
                variants={legoItem}
                className="mt-2 text-sm leading-relaxed"
                style={{ color: MUTED }}
              >
                {p.body}
              </motion.p>
            </SpotlightCard>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    {
      k: "01",
      title: "Tell us about your org",
      body: "One text box, one optional drop zone. Volition extracts your profile and voice locally — your raw docs are discarded.",
    },
    {
      k: "02",
      title: "We research your world live",
      body: "Agentic search across the live web: events, sponsors, comparable orgs, rising trends — with sources kept for every claim.",
    },
    {
      k: "03",
      title: "You get cards with receipts",
      body: "Concrete ideas with cited evidence, why they fit you, execution steps, and the exact cost of producing that answer.",
    },
  ];
  return (
    <section
      id="how"
      className="scroll-mt-20 border-y"
      style={{ borderColor: BORDER, background: "#ddd8ca" }}
    >
      <div className="mx-auto max-w-6xl px-5 py-24 sm:px-8">
        <p
          className="font-mono text-[11px] font-semibold uppercase tracking-[0.18em]"
          style={{ color: GOLD }}
        >
          How it works
        </p>
        <h2
          className="mt-3 max-w-2xl text-3xl tracking-[-0.01em] sm:text-4xl"
          style={{ color: INK }}
        >
          From “tell me about your org” to a briefing in under three minutes.
        </h2>
        <motion.div
          className="mt-12 grid gap-4 md:grid-cols-3"
          variants={cardGroup}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-100px" }}
        >
          {steps.map((s) => (
            <SpotlightCard key={s.k} className="p-8">
              <motion.span
                variants={legoItem}
                className="grid h-9 w-9 place-items-center rounded-full border font-mono text-sm font-semibold tabular-nums"
                style={{ borderColor: BORDER, color: GOLD, background: BG }}
              >
                {s.k}
              </motion.span>
              <motion.h3
                variants={legoItem}
                className="mt-4 text-xl tracking-tight"
                style={{ color: INK }}
              >
                {s.title}
              </motion.h3>
              <motion.p
                variants={legoItem}
                className="mt-2 text-sm leading-relaxed"
                style={{ color: MUTED }}
              >
                {s.body}
              </motion.p>
            </SpotlightCard>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

function ClosingCta() {
  return (
    <section className="px-5 py-28 text-center sm:px-8">
      <h2
        className="mx-auto max-w-2xl text-4xl tracking-[-0.015em] sm:text-5xl"
        style={{ color: INK }}
      >
        See what Volition finds for you.
      </h2>
      <p className="mx-auto mt-5 max-w-xl text-lg" style={{ color: MUTED }}>
        Your first briefing costs about four cents — and we&apos;ll show you
        the receipt.
      </p>
      <div className="mt-9">
        <Link
          href="/login"
          className="inline-block rounded-[10px] px-7 py-3.5 text-base font-medium transition-opacity hover:opacity-90"
          style={{ background: OLIVE, color: OLIVE_FG }}
        >
          Start for free
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t" style={{ borderColor: BORDER }}>
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-5 py-10 sm:flex-row sm:px-8">
        <div className="flex items-center gap-3">
          <Wordmark size={24} />
          <span className="font-mono text-xs" style={{ color: MUTED }}>
            · citation or no card
          </span>
        </div>
        <nav className="flex items-center gap-6 text-sm" style={{ color: MUTED }}>
          <a href="#how" className="transition-colors hover:text-[#2c2e23]">
            How it works
          </a>
          <a href="#why" className="transition-colors hover:text-[#2c2e23]">
            Why Volition
          </a>
          <Link href="/login" className="transition-colors hover:text-[#2c2e23]">
            Sign in
          </Link>
        </nav>
        <p className="font-mono text-xs" style={{ color: MUTED }}>
          © 2026 Volition
        </p>
      </div>
    </footer>
  );
}

/* ───────────────────────────── page ───────────────────────────── */

export function LandingPage({ fontClassName }: { fontClassName?: string }) {
  return (
    <div
      className={`min-h-screen overflow-x-hidden antialiased ${fontClassName ?? ""}`}
      style={{ background: BG, color: INK }}
    >
      <Nav />
      <main>
        {/* Hero + preview share Attio's dashed guide rails */}
        <div className="mx-auto max-w-6xl lg:border-x lg:border-dashed lg:[border-color:#d4cebd]">
          <Hero />
          <div className="mt-16 sm:mt-20">
            <ProductPreview />
          </div>
        </div>
        <BuiltForStrip />
        <div className="mx-auto max-w-6xl lg:border-x lg:border-dashed lg:[border-color:#d4cebd]">
          <Pillars />
        </div>
        <HowItWorks />
        <div className="mx-auto max-w-6xl lg:border-x lg:border-dashed lg:[border-color:#d4cebd]">
          <ClosingCta />
        </div>
      </main>
      <Footer />
    </div>
  );
}
