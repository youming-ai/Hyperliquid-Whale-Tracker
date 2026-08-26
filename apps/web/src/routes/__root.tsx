/// <reference types="vite/client" />
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { createRootRoute, HeadContent, Link, Outlet, Scripts } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import type { ReactNode } from 'react';
import { AuthButton } from '~/components/AuthButton';
import { Providers } from '~/providers';
import appCss from '~/styles.css?url';

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'HyperDash' },
      { name: 'description', content: 'Copy trading platform for Hyperliquid derivatives.' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  component: RootComponent,
  shellComponent: RootDocument,
});

function RootComponent() {
  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <header className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <Link to="/" className="text-xl font-bold">
                HyperDash
              </Link>
              <div className="hidden md:flex gap-6">
                <Link
                  to="/traders"
                  className="text-sm font-medium opacity-80 hover:opacity-100 transition-opacity"
                  activeProps={{ className: 'opacity-100' }}
                >
                  Traders
                </Link>
                <Link
                  to="/terminal"
                  className="text-sm font-medium opacity-80 hover:opacity-100 transition-opacity"
                  activeProps={{ className: 'opacity-100' }}
                >
                  Terminal
                </Link>
                <Link
                  to="/analytics"
                  className="text-sm font-medium opacity-80 hover:opacity-100 transition-opacity"
                  activeProps={{ className: 'opacity-100' }}
                >
                  Analytics
                </Link>
                <Link
                  to="/strategies"
                  className="text-sm font-medium opacity-80 hover:opacity-100 transition-opacity"
                  activeProps={{ className: 'opacity-100' }}
                >
                  Strategies
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <ConnectButton showBalance={false} accountStatus="address" chainStatus="icon" />
              <AuthButton />
            </div>
          </div>
        </nav>
      </header>

      <main>
        <Outlet />
      </main>

      {import.meta.env.DEV && <TanStackRouterDevtools position="bottom-right" />}
    </div>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Providers>{children}</Providers>
        <Scripts />
      </body>
    </html>
  );
}
