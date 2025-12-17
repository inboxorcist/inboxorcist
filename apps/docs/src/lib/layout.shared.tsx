import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <div className="flex items-center gap-2">
          <img src="/logo.png" alt="Inboxorcist" className="h-6 w-6" />
          <span className="font-semibold">Inboxorcist</span>
        </div>
      ),
    },
    githubUrl: "https://github.com/inboxorcist/inboxorcist",
  };
}
