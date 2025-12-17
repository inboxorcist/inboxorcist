import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BookOpen,
  Check,
  Copy,
  Cpu,
  Github,
  Shield,
  Star,
  Trash2,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <div className="min-h-screen bg-[#09090b] text-white overflow-hidden">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-transparent backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center gap-2 sm:gap-3 hover:opacity-80 transition-opacity"
          >
            <img
              src="/logo.png"
              alt="Inboxorcist"
              className="h-7 w-7 sm:h-8 sm:w-8"
            />
            <span className="font-semibold text-base sm:text-lg">
              Inboxorcist
            </span>
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              to="/docs/$"
              params={{ _splat: "quick-start" }}
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 text-sm font-medium text-white bg-white/10 hover:bg-white/20 rounded-lg transition-all border border-white/10"
            >
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Read the Docs</span>
              <span className="sm:hidden">Docs</span>
            </Link>
            <a
              href="https://github.com/inboxorcist/inboxorcist"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1.5 text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-all"
            >
              <Star className="h-4 w-4" />
              <span className="hidden sm:inline">Star on GitHub</span>
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-16">
        {/* Background gradient effects */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-[20%] left-[20%] w-[500px] h-[500px] bg-violet-600/40 rounded-full blur-[180px] animate-pulse" />
          <div className="absolute bottom-[20%] right-[20%] w-[400px] h-[400px] bg-purple-500/30 rounded-full blur-[150px]" />
          <div className="absolute top-[40%] right-[30%] w-[300px] h-[300px] bg-fuchsia-500/20 rounded-full blur-[120px]" />
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 text-center">
          {/* Logo with glow */}
          <div className="mb-6 sm:mb-10 flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-violet-500/50 blur-[60px] sm:blur-[80px] scale-150 rounded-full animate-pulse" />
              <div className="absolute inset-0 bg-purple-400/30 blur-[30px] sm:blur-[40px] scale-110 rounded-full" />
              <img
                src="/logo.png"
                alt="Inboxorcist"
                className="relative z-10 h-24 w-24 sm:h-36 sm:w-36 drop-shadow-[0_0_40px_rgba(139,92,246,0.5)]"
              />
            </div>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-4 sm:mb-6 leading-[1.1]">
            The power of delete
            <br />
            <span className="bg-gradient-to-r from-violet-400 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
              compels you
            </span>
          </h1>

          <p className="text-base sm:text-lg md:text-xl text-zinc-400 mb-8 sm:mb-12 max-w-2xl mx-auto leading-relaxed px-2">
            Self-hosted, privacy-first Gmail cleanup tool. Bulk delete 100k+
            emails from Promotions, Social, Updates — operations Gmail's UI
            can't handle.
          </p>

          {/* Install Command */}
          <InstallCommand />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 sm:py-32 px-4 sm:px-6 relative">
        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-950/10 to-transparent" />
        <div className="max-w-6xl mx-auto relative z-10">
          <p className="text-violet-400 text-sm font-medium text-center mb-4 tracking-wide uppercase">
            Why Inboxorcist?
          </p>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-4 sm:mb-6">
            Gmail's UI wasn't built for this
          </h2>
          <p className="text-zinc-400 text-center mb-12 sm:mb-20 max-w-xl mx-auto text-sm sm:text-base">
            Inboxorcist handles the bulk operations that Gmail's interface
            simply can't manage.
          </p>

          <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-6">
            <FeatureCard
              icon={<Shield className="h-6 w-6" />}
              title="Privacy First"
              description="Your data never leaves your machine. Self-hosted means complete control over your email data."
            />
            <FeatureCard
              icon={<Trash2 className="h-6 w-6" />}
              title="Bulk Delete"
              description="Delete thousands of emails at once. Filter by sender, category, date range, or email size."
            />
            <FeatureCard
              icon={<Cpu className="h-6 w-6" />}
              title="Zero Dependencies"
              description="Single binary deployment. No Docker, no Node.js — just download and run in seconds."
            />
          </div>
        </div>
      </section>

      {/* Deployment Section */}
      <section className="py-16 sm:py-32 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <p className="text-violet-400 text-sm font-medium text-center mb-4 tracking-wide uppercase">
            Deployment
          </p>
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-center mb-4 sm:mb-6">
            Deploy anywhere in minutes
          </h2>
          <p className="text-zinc-400 text-center mb-10 sm:mb-16 max-w-xl mx-auto text-sm sm:text-base">
            Run locally, on your VPS, or deploy to your favorite cloud platform.
          </p>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <DeployCard
              title="Binary"
              description="Download & run"
              href="deployment/binary"
              highlight
            />
            <DeployCard
              title="Docker"
              description="docker compose up"
              href="deployment/docker"
            />
            <DeployCard
              title="Railway"
              description="One-click deploy"
              href="deployment/railway"
            />
            <DeployCard
              title="More..."
              description="Render, Fly.io, VPS"
              href="deployment"
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-16 sm:py-32 px-4 sm:px-6 relative">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] sm:w-[600px] h-[400px] sm:h-[600px] bg-violet-600/20 rounded-full blur-[150px] sm:blur-[200px]" />
        </div>
        <div className="max-w-2xl mx-auto text-center relative z-10">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 sm:mb-6">
            Ready to clean your inbox?
          </h2>
          <p className="text-zinc-400 mb-8 sm:mb-10 text-sm sm:text-base">
            Get started in under 2 minutes. No credit card required.
          </p>
          <Link
            to="/docs/$"
            params={{ _splat: "quick-start" }}
            className="inline-flex items-center gap-2 px-6 sm:px-8 py-3 sm:py-4 bg-violet-600 text-white font-semibold rounded-xl hover:bg-violet-500 transition-all hover:scale-105 shadow-lg shadow-violet-500/25 text-sm sm:text-base"
          >
            Get Started Free
            <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 sm:py-12 px-4 sm:px-6 border-t border-zinc-800/50">
        <div className="max-w-6xl mx-auto flex flex-col items-center gap-4 sm:gap-6">
          <div className="flex flex-col sm:flex-row items-center justify-between w-full gap-4 sm:gap-6">
            <div className="flex items-center gap-2 sm:gap-3">
              <img
                src="/logo.png"
                alt="Inboxorcist"
                className="h-5 w-5 sm:h-6 sm:w-6 opacity-60"
              />
              <span className="text-zinc-500 text-xs sm:text-sm">
                Open source • MIT License
              </span>
            </div>
            <div className="flex items-center gap-6 sm:gap-8">
              <Link
                to="/docs/$"
                params={{ _splat: "" }}
                className="text-xs sm:text-sm text-zinc-500 hover:text-white transition-colors"
              >
                Documentation
              </Link>
              <a
                href="https://github.com/inboxorcist/inboxorcist"
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs sm:text-sm text-zinc-500 hover:text-white transition-colors inline-flex items-center gap-1.5 sm:gap-2"
              >
                <Github className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                GitHub
              </a>
            </div>
          </div>
          <div className="text-zinc-600 text-xs sm:text-sm">
            Built by{" "}
            <a
              href="https://priyanshrastogi.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-zinc-400 hover:text-white transition-colors"
            >
              @priyanshrastogi
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="group p-5 sm:p-8 rounded-xl sm:rounded-2xl bg-zinc-900/50 border border-zinc-800/50 hover:border-violet-500/30 hover:bg-zinc-900/80 transition-all duration-300">
      <div className="h-10 w-10 sm:h-14 sm:w-14 rounded-lg sm:rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center text-violet-400 mb-4 sm:mb-6 group-hover:scale-110 transition-transform">
        {icon}
      </div>
      <h3 className="text-lg sm:text-xl font-semibold mb-2 sm:mb-3">{title}</h3>
      <p className="text-zinc-400 leading-relaxed text-sm sm:text-base">
        {description}
      </p>
    </div>
  );
}

function DeployCard({
  title,
  description,
  href,
  highlight,
}: {
  title: string;
  description: string;
  href: string;
  highlight?: boolean;
}) {
  return (
    <Link
      to="/docs/$"
      params={{ _splat: href }}
      className={`group p-4 sm:p-6 rounded-xl sm:rounded-2xl border transition-all duration-300 ${
        highlight
          ? "bg-violet-500/10 border-violet-500/30 hover:border-violet-500/50 hover:bg-violet-500/15"
          : "bg-zinc-900/50 border-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-900/80"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h3
            className={`font-semibold mb-0.5 sm:mb-1 text-sm sm:text-base ${highlight ? "text-violet-300" : ""}`}
          >
            {title}
          </h3>
          <p className="text-zinc-500 text-xs sm:text-sm truncate">
            {description}
          </p>
        </div>
        <ArrowRight
          className={`h-4 w-4 sm:h-5 sm:w-5 shrink-0 transition-all group-hover:translate-x-1 ${highlight ? "text-violet-400" : "text-zinc-600 group-hover:text-zinc-400"}`}
        />
      </div>
    </Link>
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
    <div className="mb-8 w-full px-4 sm:px-0 flex justify-center">
      <div className="w-full max-w-[340px] sm:max-w-xl">
        {/* Tabs Row */}
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setPlatform("unix")}
            className={`px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-t-lg transition-colors ${
              platform === "unix"
                ? "bg-violet-500 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Linux & macOS
          </button>
          <button
            type="button"
            onClick={() => setPlatform("windows")}
            className={`px-3 sm:px-5 py-2 sm:py-2.5 text-xs sm:text-sm font-medium rounded-t-lg transition-colors ${
              platform === "windows"
                ? "bg-violet-500 text-white"
                : "bg-zinc-800 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Windows
          </button>
        </div>

        {/* Command Box */}
        <div className="flex items-center bg-zinc-900 border-2 border-violet-500 rounded-xl rounded-tl-none px-3 sm:px-5 py-3 sm:py-4 font-mono text-xs sm:text-sm">
          <div className="flex items-center gap-2 sm:gap-3 overflow-x-auto flex-1 min-w-0">
            <span className="text-violet-400 shrink-0">$</span>
            <code className="text-zinc-300 whitespace-nowrap">
              {commands[platform]}
            </code>
          </div>
          <button
            type="button"
            onClick={copyToClipboard}
            className="p-1 ml-3 text-zinc-500 hover:text-white transition-colors shrink-0"
            title="Copy to clipboard"
          >
            {copied ? (
              <Check className="h-4 w-4 sm:h-5 sm:w-5 text-green-400" />
            ) : (
              <Copy className="h-4 w-4 sm:h-5 sm:w-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
