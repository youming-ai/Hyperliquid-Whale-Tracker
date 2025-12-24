import { ConnectButton } from '@rainbow-me/rainbowkit';
import { TanStackDevtools } from '@tanstack/react-devtools';
import { createRootRoute, Link, Outlet } from '@tanstack/react-router';
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools';

export const Route = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  return (
    <div className="min-h-screen bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      {/* Header */}
      <header className="border-b border-[hsl(var(--border))] bg-[hsl(var(--card))]">
        <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-8">
              <Link to="/" className="text-xl font-bold">
                HyperDash
              </Link>
              <div className="hidden md:flex gap-6">
                <Link
                  to="/dashboard"
                  className="text-sm font-medium opacity-80 hover:opacity-100 transition-opacity"
                  activeProps={{ className: 'opacity-100' }}
                >
                  Dashboard
                </Link>
                <Link
                  to="/traders"
                  className="text-sm font-medium opacity-80 hover:opacity-100 transition-opacity"
                  activeProps={{ className: 'opacity-100' }}
                >
                  Traders
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
              {/* RainbowKit Connect Button */}
              <ConnectButton showBalance={false} accountStatus="address" chainStatus="icon" />
            </div>
          </div>
        </nav>
      </header>

      {/* Main Content */}
      <main>
        <Outlet />
      </main>

      {/* Devtools (only in development) */}
      {import.meta.env.DEV && (
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
      )}
    </div>
  );
}
