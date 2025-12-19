import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Github, Globe, Lock, Scale } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0c] text-[#f5f5f7] overflow-x-hidden landing-noise">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-8 py-5 flex justify-between items-center bg-gradient-to-b from-[#0a0a0c] to-transparent backdrop-blur-xl">
        <Link
          to="/"
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <img src="/logo.png" alt="Inboxorcist" className="w-9 h-9" />
          <span className="font-semibold text-lg">Inboxorcist</span>
        </Link>
        <div className="flex gap-8 items-center">
          <Link
            to="/docs/$"
            params={{ _splat: "quick-start" }}
            className="hidden sm:block text-[#a1a1aa] hover:text-[#f5f5f7] text-sm font-medium transition-colors"
          >
            Docs
          </Link>
          <a
            href="https://github.com/inboxorcist/inboxorcist"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:block text-[#a1a1aa] hover:text-[#f5f5f7] text-sm font-medium transition-colors"
          >
            GitHub
          </a>
          <Link
            to="/docs/$"
            params={{ _splat: "quick-start" }}
            className="bg-[#f5f5f7] text-[#0a0a0c] px-5 py-2.5 rounded-lg font-semibold text-sm hover:-translate-y-0.5 hover:shadow-[0_4px_20px_rgba(255,255,255,0.2)] transition-all"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col justify-center items-center text-center px-5 sm:px-8 pt-20 sm:pt-24 pb-12 overflow-hidden">
        {/* Animated gradient orbs - soft, diffused spirits */}
        <div className="absolute w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] rounded-full blur-[60px] sm:blur-[80px] animate-float bg-[radial-gradient(circle,#a855f7_0%,transparent_70%)] -top-[150px] sm:-top-[200px] -left-[150px] sm:-left-[200px]" />
        <div className="absolute w-[350px] sm:w-[500px] h-[350px] sm:h-[500px] rounded-full blur-[60px] sm:blur-[80px] animate-float-delayed bg-[radial-gradient(circle,#f97316_0%,transparent_70%)] -bottom-[100px] sm:-bottom-[150px] -right-[100px] sm:-right-[150px]" />
        <div className="hidden sm:block absolute w-[300px] h-[300px] rounded-full blur-[80px] animate-float-delayed-2 bg-[radial-gradient(circle,#10b981_0%,transparent_70%)] top-[30%] right-[10%]" />
        <div className="hidden sm:block absolute w-[350px] h-[350px] rounded-full blur-[80px] animate-float-delayed-3 bg-[radial-gradient(circle,#3b82f6_0%,transparent_70%)] bottom-[10%] left-[5%]" />

        <div className="relative z-10 max-w-[900px] w-full">
          {/* Badge */}
          <div className="inline-flex items-center gap-3 sm:gap-4 bg-[#18181c]/80 border border-white/10 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full text-[10px] sm:text-xs text-[#a1a1aa] mb-6 sm:mb-8 animate-fade-in-up">
            <span className="inline-flex items-center gap-1 sm:gap-1.5">
              <Globe className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              Open source
            </span>
            <span className="w-px h-2.5 sm:h-3 bg-white/20" />
            <span className="inline-flex items-center gap-1 sm:gap-1.5">
              <Lock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
              Self-hosted
            </span>
          </div>

          {/* Title */}
          <h1 className="font-serif text-[clamp(2.75rem,10vw,5rem)] font-normal leading-[1.1] mb-4 sm:mb-6 px-2 animate-fade-in-up-1">
            Your inbox needs
            <br />
            an <em className="italic text-[#f97316]">exorcism</em>
          </h1>

          {/* Subtitle */}
          <p className="text-sm sm:text-base text-[#a1a1aa] max-w-[520px] mx-auto mb-8 sm:mb-10 font-normal px-2 animate-fade-in-up-2">
            57,000 unread emails. Promos from 2019. Newsletter ghosts that won't
            die. It's time to banish the demons Gmail's UI can't handle.
          </p>

          {/* Install Command Box */}
          <div className="mb-6 sm:mb-8 animate-fade-in-up-3">
            <InstallCommand />
          </div>

          {/* CTA Buttons */}
          <div className="flex gap-2.5 sm:gap-3 justify-center flex-wrap px-2 animate-fade-in-up-4">
            <Link
              to="/docs/$"
              params={{ _splat: "quick-start" }}
              className="inline-flex items-center gap-2 bg-gradient-to-br from-[#a855f7] to-[#7c3aed] text-white px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold text-xs sm:text-sm hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(168,85,247,0.3)] transition-all shadow-[0_4px_20px_rgba(168,85,247,0.15)]"
            >
              Begin the Exorcism
              <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </Link>
            <a
              href="https://github.com/inboxorcist/inboxorcist"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-[#18181c] border border-white/10 text-[#f5f5f7] px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg font-semibold text-xs sm:text-sm hover:bg-[#111115] hover:border-white/20 transition-all"
            >
              <Github className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Star on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Horror Stats Section */}
      <HorrorStatsSection />

      {/* Features Section */}
      <FeaturesSection />

      {/* Privacy Section */}
      <section className="py-32 px-4 sm:px-8 bg-[#0a0a0c] relative">
        <div className="max-w-[900px] mx-auto text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-[#22c55e] to-[#10b981] rounded-2xl flex items-center justify-center text-4xl mx-auto mb-8 shadow-[0_20px_40px_rgba(34,197,94,0.2)]">
            🔒
          </div>
          <h2 className="font-serif text-[clamp(2rem,5vw,3rem)] font-normal mb-6">
            Your data never leaves your machine
          </h2>
          <p className="text-[#a1a1aa] text-lg leading-relaxed mb-12 max-w-[700px] mx-auto">
            Unlike Unroll.me, Cleanfox, and other SaaS vampires that read your
            emails and sell your data — Inboxorcist runs entirely on your
            machine. We don't have servers. We don't phone home. We can't see
            your emails even if we wanted to. Self-hosted means you're in
            complete control.
          </p>
          <div className="flex justify-center gap-6 flex-wrap">
            <PrivacyBadge icon="🏠" text="Self-hosted" />
            <PrivacyBadge icon="👀" text="Open source" />
            <PrivacyBadge icon="🚫" text="No tracking" />
            <PrivacyBadge icon="🔓" text="AGPL-3.0" />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-32 px-5 sm:px-8 bg-gradient-to-b from-[#0a0a0c] via-[#111115] to-[#0a0a0c] text-center relative">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] bg-[radial-gradient(circle,#a855f7_0%,transparent_70%)] opacity-10 blur-[60px] sm:blur-[80px]" />
        <div className="relative z-10 max-w-[700px] mx-auto">
          <h2 className="font-serif text-[clamp(1.75rem,6vw,3.5rem)] font-normal mb-4 sm:mb-6">
            Ready to <em className="italic text-[#f97316]">exorcise</em> your
            inbox?
          </h2>
          <p className="text-[#a1a1aa] text-sm sm:text-lg mb-8 sm:mb-10">
            One command. Two minutes. Total inbox freedom.
          </p>

          <div className="mb-6 sm:mb-8">
            <InstallCommand />
          </div>

          <Link
            to="/docs/$"
            params={{ _splat: "quick-start" }}
            className="inline-flex items-center gap-2 bg-gradient-to-br from-[#a855f7] to-[#7c3aed] text-white px-5 sm:px-8 py-2.5 sm:py-4 rounded-lg sm:rounded-xl font-semibold text-xs sm:text-base hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(168,85,247,0.3)] transition-all shadow-[0_4px_20px_rgba(168,85,247,0.15)]"
          >
            Begin the Exorcism
            <ArrowRight className="w-3.5 h-3.5 sm:w-5 sm:h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 sm:py-16 px-5 sm:px-8 bg-[#0a0a0c] border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 sm:gap-12 mb-10 sm:mb-12">
            {/* Brand */}
            <div className="col-span-2 sm:col-span-1">
              <div className="flex items-center gap-3 mb-4">
                <img src="/logo.png" alt="Inboxorcist" className="w-8 h-8" />
                <span className="font-semibold">Inboxorcist</span>
              </div>
              <p className="text-[#71717a] text-sm leading-relaxed">
                Self-hosted Gmail cleanup tool. Bulk delete emails Gmail's UI can't handle.
              </p>
            </div>

            {/* Documentation */}
            <div>
              <h4 className="font-semibold text-sm mb-4 text-[#a1a1aa]">Documentation</h4>
              <ul className="space-y-2.5">
                <li>
                  <Link to="/docs/$" params={{ _splat: "quick-start" }} className="text-[#71717a] hover:text-[#f5f5f7] text-sm transition-colors">
                    Quick Start
                  </Link>
                </li>
                <li>
                  <Link to="/docs/$" params={{ _splat: "configuration" }} className="text-[#71717a] hover:text-[#f5f5f7] text-sm transition-colors">
                    Configuration
                  </Link>
                </li>
                <li>
                  <Link to="/docs/$" params={{ _splat: "google-oauth-setup" }} className="text-[#71717a] hover:text-[#f5f5f7] text-sm transition-colors">
                    Google OAuth Setup
                  </Link>
                </li>
                <li>
                  <Link to="/docs/$" params={{ _splat: "troubleshooting" }} className="text-[#71717a] hover:text-[#f5f5f7] text-sm transition-colors">
                    Troubleshooting
                  </Link>
                </li>
              </ul>
            </div>

            {/* Deploy */}
            <div>
              <h4 className="font-semibold text-sm mb-4 text-[#a1a1aa]">Deploy</h4>
              <ul className="space-y-2.5">
                <li>
                  <Link to="/docs/$" params={{ _splat: "deployment/docker" }} className="text-[#71717a] hover:text-[#f5f5f7] text-sm transition-colors">
                    Docker
                  </Link>
                </li>
                <li>
                  <Link to="/docs/$" params={{ _splat: "deployment/railway" }} className="text-[#71717a] hover:text-[#f5f5f7] text-sm transition-colors">
                    Railway
                  </Link>
                </li>
                <li>
                  <Link to="/docs/$" params={{ _splat: "deployment/render" }} className="text-[#71717a] hover:text-[#f5f5f7] text-sm transition-colors">
                    Render
                  </Link>
                </li>
                <li>
                  <Link to="/docs/$" params={{ _splat: "deployment/fly-io" }} className="text-[#71717a] hover:text-[#f5f5f7] text-sm transition-colors">
                    Fly.io
                  </Link>
                </li>
                <li>
                  <Link to="/docs/$" params={{ _splat: "deployment/digitalocean" }} className="text-[#71717a] hover:text-[#f5f5f7] text-sm transition-colors">
                    DigitalOcean
                  </Link>
                </li>
              </ul>
            </div>

            {/* Community */}
            <div>
              <h4 className="font-semibold text-sm mb-4 text-[#a1a1aa]">Community</h4>
              <ul className="space-y-2.5">
                <li>
                  <a href="https://github.com/inboxorcist/inboxorcist" target="_blank" rel="noopener noreferrer" className="text-[#71717a] hover:text-[#f5f5f7] text-sm transition-colors">
                    GitHub
                  </a>
                </li>
                <li>
                  <a href="https://github.com/inboxorcist/inboxorcist/issues" target="_blank" rel="noopener noreferrer" className="text-[#71717a] hover:text-[#f5f5f7] text-sm transition-colors">
                    Issues
                  </a>
                </li>
                <li>
                  <a href="https://github.com/inboxorcist/inboxorcist/releases" target="_blank" rel="noopener noreferrer" className="text-[#71717a] hover:text-[#f5f5f7] text-sm transition-colors">
                    Releases
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div className="pt-8 border-t border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-[#71717a] text-sm">
              <Globe className="w-3.5 h-3.5" />
              <span>Open source</span>
              <span className="text-white/20">•</span>
              <Scale className="w-3.5 h-3.5" />
              <span>AGPL-3.0</span>
            </div>
            <div className="text-[#71717a] text-sm">
              Built by{" "}
              <a
                href="https://priyanshrastogi.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#a1a1aa] hover:text-[#f5f5f7] transition-colors"
              >
                @priyanshrastogi
              </a>
              {" & "}
              <a
                href="https://claude.ai"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#a1a1aa] hover:text-[#f5f5f7] transition-colors"
              >
                @claude
              </a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

function HorrorStatsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const cards = [
    {
      icon: "👻",
      iconBg: "bg-[rgba(168,85,247,0.15)]",
      stat: "10+ years",
      title: "of promotional ghosts",
      description:
        "Those Black Friday deals from 2015? Still haunting your storage. Every. Single. One.",
    },
    {
      icon: "📦",
      iconBg: "bg-[rgba(249,115,22,0.15)]",
      stat: "5GB+",
      title: "of bloated attachments",
      description:
        "PDFs you downloaded. Screenshots you forgot. That 50MB video your aunt sent.",
    },
    {
      icon: "🔔",
      iconBg: "bg-[rgba(239,68,68,0.15)]",
      stat: "∞",
      title: "notification demons",
      description:
        '"Someone liked your post." "Your order shipped." A thousand times over.',
    },
    {
      icon: "💀",
      iconBg: "bg-[rgba(6,182,212,0.15)]",
      stat: "50+",
      title: "zombie newsletters",
      description:
        "Services you forgot existed, still emailing you weekly. They never stop.",
    },
    {
      icon: "🛒",
      iconBg: "bg-[rgba(34,197,94,0.15)]",
      stat: "1 purchase",
      title: "= emails forever",
      description:
        "Bought a phone case in 2019. Now you're on 47 mailing lists. Unsubscribe links? They don't work.",
    },
    {
      icon: "💬",
      iconBg: "bg-[rgba(59,130,246,0.15)]",
      stat: "Reply-all",
      title: "apocalypse threads",
      description:
        "Someone hit reply-all. Then 200 people replied \"please remove me.\" You're still CC'd on all of them.",
    },
  ];

  return (
    <section
      ref={sectionRef}
      className="py-24 px-4 sm:px-8 bg-gradient-to-b from-[#0a0a0c] to-[#111115] relative"
    >
      <div className="max-w-6xl mx-auto">
        <span className="inline-block text-xs font-semibold uppercase tracking-wider text-[#a855f7] mb-4">
          The Haunting
        </span>
        <h2 className="font-serif text-[clamp(2rem,5vw,3.5rem)] font-normal mb-12 max-w-[700px]">
          What lurks in your inbox is{" "}
          <em className="italic text-[#ef4444]">terrifying</em>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {cards.map((card, index) => (
            <div
              key={card.title}
              className={`bg-[#18181c] border border-white/5 rounded-2xl p-8 transition-all duration-500 hover:border-white/10 hover:-translate-y-1 hover:shadow-[0_20px_40px_rgba(0,0,0,0.3)] ${
                isVisible
                  ? "opacity-100 translate-y-0"
                  : "opacity-0 translate-y-10"
              }`}
              style={{ transitionDelay: `${index * 100}ms` }}
            >
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl mb-5 ${card.iconBg}`}
              >
                {card.icon}
              </div>
              <div className="font-serif text-4xl text-[#f97316] mb-1">
                {card.stat}
              </div>
              <h3 className="text-lg font-semibold mb-2">{card.title}</h3>
              <p className="text-[#a1a1aa] text-base leading-relaxed">
                {card.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    {
      icon: "⚡",
      title: "Bulk operations at scale",
      description:
        "Gmail's clunky UI makes bulk cleanup painful. Inboxorcist gives you a powerful dashboard to filter, preview, and banish thousands of emails with surgical precision — by sender, category, date range, or attachment size.",
      bullets: [
        "Delete thousands in one click",
        "Filter by date, size, sender, category",
        "Preview before you purge",
      ],
    },
    {
      icon: "📦",
      title: "Hunt the storage hogs",
      description:
        "Find the bloated souls eating your storage. Sort by attachment size, hunt down those ancient PDFs and forgotten videos. Free up gigabytes in minutes.",
      bullets: [
        "Sort by attachment size",
        "See total storage per sender",
        "Target 10MB+ monsters",
      ],
    },
    {
      icon: "📧",
      title: "Subscription management",
      description:
        "See every newsletter and marketing list that found your email. Track when they started, how many they've sent, and banish entire senders with one click.",
      bullets: [
        "Full sender breakdown",
        "First & last email dates",
        "One-click bulk banish",
      ],
    },
    {
      icon: "🧠",
      title: "Eternal memory",
      description:
        "Deleted an email but need to remember who sent it, or when? Inboxorcist remembers everything. We store email metadata forever — even after you delete the emails from Gmail. Your inbox history, preserved.",
      bullets: [
        "Metadata stored permanently",
        "Search deleted emails",
        "Never lose track of senders",
      ],
    },
    {
      icon: "⏪",
      title: "Rules that travel back in time",
      description:
        "Create Gmail rules from Inboxorcist — and unlike Gmail's native rules, ours apply to your existing emails too. Set a rule to auto-archive newsletters? It'll catch the 3,000 you already have.",
      bullets: [
        "Create rules from the dashboard",
        "Retroactively apply to old emails",
        "Synced directly to Gmail",
      ],
    },
  ];

  return (
    <section className="py-32 px-4 sm:px-8 bg-gradient-to-b from-[#111115] to-[#0a0a0c]">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-20">
          <span className="inline-block text-xs font-semibold uppercase tracking-wider text-[#a855f7] mb-4">
            Why Inboxorcist
          </span>
          <h2 className="font-serif text-[clamp(2rem,5vw,3.5rem)] font-normal">
            What Gmail should have been
          </h2>
        </div>

        <div className="flex flex-col gap-16">
          {features.map((feature, index) => (
            <FeatureRow key={feature.title} feature={feature} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}

function FeatureRow({
  feature,
  index,
}: {
  feature: {
    icon: string;
    title: string;
    description: string;
    bullets: string[];
  };
  index: number;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
        }
      },
      { threshold: 0.1 }
    );

    if (rowRef.current) {
      observer.observe(rowRef.current);
    }

    return () => observer.disconnect();
  }, []);

  const isEven = index % 2 === 1;

  return (
    <div
      ref={rowRef}
      className={`grid grid-cols-1 lg:grid-cols-2 gap-16 items-center transition-all duration-700 ${
        isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"
      } ${isEven ? "lg:direction-rtl" : ""}`}
    >
      <div className={isEven ? "lg:order-2" : ""}>
        <h3 className="font-serif text-3xl font-normal mb-4">{feature.title}</h3>
        <p className="text-[#a1a1aa] text-lg leading-relaxed mb-6">
          {feature.description}
        </p>
        <ul className="space-y-3">
          {feature.bullets.map((bullet) => (
            <li
              key={bullet}
              className="flex items-start gap-3 text-[#a1a1aa]"
            >
              <span className="text-[#22c55e] font-semibold shrink-0">✓</span>
              {bullet}
            </li>
          ))}
        </ul>
      </div>
      <div className={`${isEven ? "lg:order-1" : ""}`}>
        <div className="bg-[#18181c] border border-white/5 rounded-2xl p-8 aspect-[4/3] flex items-center justify-center relative overflow-hidden">
          <span className="text-8xl opacity-80">{feature.icon}</span>
        </div>
      </div>
    </div>
  );
}

function PrivacyBadge({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-2 bg-[#18181c] border border-white/10 px-5 py-3 rounded-full text-sm text-[#a1a1aa]">
      <span className="text-xl">{icon}</span>
      {text}
    </div>
  );
}

type Platform = "unix" | "windows";

const commands: Record<Platform, string> = {
  unix: "curl -fsSL https://inboxorcist.com/install.sh | bash",
  windows: "irm inboxorcist.com/install.ps1 | iex",
};

function InstallCommand() {
  const [platform, setPlatform] = useState<Platform>("unix");
  const [copied, setCopied] = useState(false);

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(commands[platform]);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full sm:w-[520px] max-w-full mx-auto px-2 sm:px-0">
      <div className="bg-[#111115] border border-white/10 rounded-xl p-3 sm:p-4">
        {/* Tabs */}
        <div className="flex gap-1 mb-3">
          <button
            type="button"
            onClick={() => setPlatform("unix")}
            className={`px-2.5 sm:px-3 py-1.5 rounded-md text-[11px] sm:text-xs font-medium transition-colors ${
              platform === "unix"
                ? "bg-[#18181c] text-[#f5f5f7]"
                : "text-[#71717a] hover:text-[#a1a1aa]"
            }`}
          >
            Linux & macOS
          </button>
          <button
            type="button"
            onClick={() => setPlatform("windows")}
            className={`px-2.5 sm:px-3 py-1.5 rounded-md text-[11px] sm:text-xs font-medium transition-colors ${
              platform === "windows"
                ? "bg-[#18181c] text-[#f5f5f7]"
                : "text-[#71717a] hover:text-[#a1a1aa]"
            }`}
          >
            Windows
          </button>
        </div>

        {/* Command */}
        <div className="flex items-center gap-2 sm:gap-3 bg-[#0a0a0c] rounded-lg px-3 sm:px-4 py-2.5 sm:py-3">
          <div className="flex-1 overflow-x-auto scrollbar-hide">
            <code className="font-mono text-[10px] sm:text-xs text-[#f5f5f7] whitespace-nowrap">
              <span className="text-[#a855f7]">
                {platform === "unix" ? "$" : ">"}
              </span>{" "}
              {commands[platform]}
            </code>
          </div>
          <button
            type="button"
            onClick={copyToClipboard}
            className="shrink-0 bg-[#18181c] border border-white/10 px-2 sm:px-2.5 py-1 rounded text-[10px] sm:text-xs font-medium text-[#a1a1aa] hover:bg-[#111115] hover:text-[#f5f5f7] transition-colors"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      </div>
    </div>
  );
}
