import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Ghost, Mail, Github, Lock, Cpu, Trash2 } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";

interface ConnectAccountProps {
  onConnect: () => void;
  isLoading?: boolean;
}

export function ConnectAccount({ onConnect, isLoading }: ConnectAccountProps) {
  const { isExorcistMode, toggleExorcistMode, t } = useLanguage();

  return (
    <div className="min-h-screen bg-[#09090b] text-white flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Gradient orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-violet-600/30 rounded-full blur-[128px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/20 rounded-full blur-[128px]" />

        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Ghost className="h-5 w-5 text-white" />
            </div>
            <span className="text-xl font-semibold">Inboxorcist</span>
          </div>

          {/* Tagline */}
          <div className="max-w-md">
            <h1 className="text-4xl font-bold tracking-tight mb-4 leading-tight">
              {t("getStarted.tagline1")}
              <br />
              <span className="text-violet-400">{t("getStarted.tagline2")}</span>
            </h1>
            <p className="text-zinc-400 text-lg leading-relaxed">
              {t("getStarted.description")}
            </p>
          </div>

          {/* GitHub */}
          <a
            href="https://github.com/priyanshrastogi/inboxorcist"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors w-fit"
          >
            <Github className="h-5 w-5" />
            <span className="text-sm">Star on GitHub</span>
          </a>
        </div>
      </div>

      {/* Right side - Connect */}
      <div className="flex-1 flex flex-col p-8">
        {/* Top bar with Exorcist Mode toggle */}
        <div className="flex justify-end mb-8 lg:mb-0">
          <label className="flex items-center gap-3 cursor-pointer group">
            <div className="flex items-center gap-2 text-sm text-zinc-400 group-hover:text-zinc-300 transition-colors">
              <Ghost className={`h-4 w-4 ${isExorcistMode ? "text-violet-400" : ""}`} />
              <span>{t("settings.exorcistMode")}</span>
            </div>
            <Switch
              checked={isExorcistMode}
              onCheckedChange={toggleExorcistMode}
              className="data-[state=checked]:bg-violet-600"
            />
          </label>
        </div>

        {/* Center content */}
        <div className="flex-1 flex items-center justify-center">
          <div className="w-full max-w-sm">
            {/* Mobile logo */}
            <div className="flex items-center gap-3 mb-12 lg:hidden">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Ghost className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-semibold">Inboxorcist</span>
            </div>

            {/* Connect card */}
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-semibold mb-2">{t("getStarted.title")}</h2>
                <p className="text-zinc-500">
                  {t("getStarted.subtitle")}
                </p>
              </div>

              <Button
                size="lg"
                onClick={onConnect}
                disabled={isLoading}
                className="w-full h-12 bg-white text-black hover:bg-zinc-200 font-medium transition-all"
              >
                <Mail className="h-5 w-5 mr-2" />
                {t("getStarted.connectButton")}
              </Button>

              {/* Trust indicators */}
              <div className="space-y-3 pt-4 border-t border-zinc-800">
                <div className="flex items-center gap-3 text-sm text-zinc-500">
                  <Lock className="h-4 w-4 text-zinc-600" />
                  <span>{t("getStarted.trust1")}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-zinc-500">
                  <Cpu className="h-4 w-4 text-zinc-600" />
                  <span>{t("getStarted.trust2")}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-zinc-500">
                  <Trash2 className="h-4 w-4 text-zinc-600" />
                  <span>{t("getStarted.trust3")}</span>
                </div>
              </div>
            </div>

            {/* Mobile GitHub */}
            <div className="mt-12 pt-8 border-t border-zinc-800 lg:hidden">
              <a
                href="https://github.com/priyanshrastogi/inboxorcist"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-zinc-500 hover:text-white transition-colors"
              >
                <Github className="h-5 w-5" />
                <span className="text-sm">Star on GitHub</span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
