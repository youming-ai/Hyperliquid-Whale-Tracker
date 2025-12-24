import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function HomePage() {
  return (
    <div className="flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center p-8 md:p-24">
      {/* Hero Section */}
      <div className="text-center mb-16">
        <h1 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
          Trading Intelligence Platform
        </h1>
        <p className="text-lg md:text-xl opacity-80 max-w-2xl mx-auto mb-8">
          Real-time market analytics and copy trading for Hyperliquid derivatives
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            to="/dashboard"
            className="px-6 py-3 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium hover:opacity-90 transition-opacity"
          >
            Launch Dashboard
          </Link>
          <Link
            to="/traders"
            className="px-6 py-3 rounded-lg border border-[hsl(var(--border))] font-medium hover:bg-[hsl(var(--accent))] transition-colors"
          >
            Explore Traders
          </Link>
        </div>
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl w-full">
        <FeatureCard
          title="Market Intelligence"
          description="Real-time market data, liquidation heatmaps, and comprehensive analytics"
        />
        <FeatureCard
          title="Trader Discovery"
          description="Find and analyze top performing traders with detailed performance metrics"
        />
        <FeatureCard
          title="Copy Trading"
          description="Strategic copy trading with advanced risk management and portfolio allocation"
        />
        <FeatureCard
          title="Risk Management"
          description="Comprehensive monitoring, alerts, and automated risk responses"
        />
      </div>

      {/* Footer */}
      <div className="mt-16 text-sm opacity-60">
        Powered by{' '}
        <a
          href="https://hyperliquid.xyz"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold hover:opacity-100 transition-opacity"
        >
          Hyperliquid
        </a>
      </div>
    </div>
  );
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="group p-6 rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--card))] hover:border-[hsl(var(--primary))] transition-colors cursor-pointer">
      <h3 className="text-xl font-semibold mb-3 group-hover:text-[hsl(var(--primary))] transition-colors">
        {title}
      </h3>
      <p className="text-sm opacity-80">{description}</p>
    </div>
  );
}
