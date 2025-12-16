import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from '@tanstack/react-router';
import * as React from 'react';
import appCss from '@/styles/app.css?url';
import { RootProvider } from 'fumadocs-ui/provider/tanstack';

const siteConfig = {
  title: 'Inboxorcist',
  description: 'Self-hosted, privacy-first Gmail cleanup tool. Bulk delete 100k+ emails from Promotions, Social, Updates — operations Gmail\'s UI can\'t handle.',
  url: 'https://inboxorcist.com',
  image: 'https://inboxorcist.com/og-image.png',
};

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: siteConfig.title },
      { name: 'description', content: siteConfig.description },
      // Open Graph
      { property: 'og:type', content: 'website' },
      { property: 'og:title', content: siteConfig.title },
      { property: 'og:description', content: siteConfig.description },
      { property: 'og:url', content: siteConfig.url },
      { property: 'og:image', content: siteConfig.image },
      { property: 'og:site_name', content: siteConfig.title },
      // Twitter
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: siteConfig.title },
      { name: 'twitter:description', content: siteConfig.description },
      { name: 'twitter:image', content: siteConfig.image },
      // Additional SEO
      { name: 'robots', content: 'index, follow' },
      { name: 'theme-color', content: '#8b5cf6' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: '/logo.png', type: 'image/png' },
      { rel: 'canonical', href: siteConfig.url },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="flex flex-col min-h-screen">
        <RootProvider>{children}</RootProvider>
        <Scripts />
      </body>
    </html>
  );
}
