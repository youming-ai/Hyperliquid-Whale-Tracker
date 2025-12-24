import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useMarketData } from '../hooks/useMarketData';
import { formatCompactNumber } from '../lib/utils';

export const Route = createFileRoute('/dashboard')({
  component: DashboardPage,
});

// Mock top traders for the dashboard
const mockTopTraders = [
  { rank: 1, address: '0x1234...5678', pnl7d: 125000, winRate: 68.5, trades: 42 },
  { rank: 2, address: '0x2345...6789', pnl7d: 98000, winRate: 72.3, trades: 38 },
  { rank: 3, address: '0x3456...789a', pnl7d: 85000, winRate: 65.2, trades: 55 },
  { rank: 4, address: '0x4567...89ab', pnl7d: 72000, winRate: 61.8, trades: 29 },
  { rank: 5, address: '0x5678...9abc', pnl7d: 65000, winRate: 59.4, trades: 67 },
];

function DashboardPage() {
  // Use the new market data hook with real-time updates
  const {
    overview,
    isLoading: marketLoading,
    lastUpdated,
  } = useMarketData({
    symbol: 'BTC-PERP',
    enableWebSocket: true,
  });

  // Fetch top traders
  const { data: topTraders } = useQuery({
    queryKey: ['traders', 'top'],
    queryFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return mockTopTraders;
    },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        {lastUpdated && (
          <span className="text-sm opacity-60">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </span>
        )}
      </div>

      {/* Market Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          label="BTC Price"
          value={
            marketLoading
              ? '...'
              : `$${overview?.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
          }
          change={overview?.change24h}
          loading={marketLoading}
        />
        <StatCard
          label="24h Volume"
          value={marketLoading ? '...' : formatCompactNumber(overview?.volume24h ?? 0)}
          loading={marketLoading}
        />
        <StatCard
          label="Open Interest"
          value={marketLoading ? '...' : formatCompactNumber(overview?.openInterest ?? 0)}
          loading={marketLoading}
        />
        <StatCard
          label="Funding Rate"
          value={marketLoading ? '...' : `${((overview?.fundingRate ?? 0) * 100).toFixed(4)}%`}
          loading={marketLoading}
        />
      </div>

      {/* Additional Market Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-6">
          <p className="text-sm opacity-60 mb-1">Long/Short Ratio</p>
          <p className="text-2xl font-bold">{overview?.longShortRatio?.toFixed(2) ?? '...'}</p>
          <div className="mt-2 h-2 bg-[hsl(var(--muted))] rounded-full overflow-hidden">
            <div
              className="h-full bg-success transition-all duration-300"
              style={{
                width: `${overview ? (overview.longShortRatio / (overview.longShortRatio + 1)) * 100 : 50}%`,
              }}
            />
          </div>
          <div className="flex justify-between text-xs mt-1 opacity-60">
            <span>Longs</span>
            <span>Shorts</span>
          </div>
        </div>

        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-6">
          <p className="text-sm opacity-60 mb-1">24h Volatility</p>
          <p className="text-2xl font-bold">{overview?.volatility24h?.toFixed(2) ?? '...'}%</p>
          <div className="mt-2 flex gap-1">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className={`h-4 flex-1 rounded ${
                  i < ((overview?.volatility24h ?? 0) / 10) * 10
                    ? 'bg-warning'
                    : 'bg-[hsl(var(--muted))]'
                }`}
              />
            ))}
          </div>
        </div>

        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-6">
          <p className="text-sm opacity-60 mb-1">Next Funding</p>
          <p className="text-2xl font-bold">
            {overview?.nextFundingTime
              ? new Date(overview.nextFundingTime).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '...'}
          </p>
          <p className="text-sm mt-1 text-success">
            Rate: {((overview?.fundingRate ?? 0) * 100).toFixed(4)}%
          </p>
        </div>
      </div>

      {/* Top Traders Section */}
      <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Top Traders (7d PnL)</h2>
          <Link to="/traders" className="text-sm text-[hsl(var(--primary))] hover:underline">
            View All →
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm opacity-60 border-b border-[hsl(var(--border))]">
                <th className="pb-3 pr-4">#</th>
                <th className="pb-3 pr-4">Address</th>
                <th className="pb-3 pr-4 text-right">7d PnL</th>
                <th className="pb-3 pr-4 text-right">Win Rate</th>
                <th className="pb-3 text-right">Trades</th>
              </tr>
            </thead>
            <tbody>
              {topTraders?.map((trader) => (
                <tr
                  key={trader.rank}
                  className="border-b border-[hsl(var(--border))] last:border-0 hover:bg-[hsl(var(--accent))] transition-colors"
                >
                  <td className="py-4 pr-4 font-medium">{trader.rank}</td>
                  <td className="py-4 pr-4 font-mono text-sm">{trader.address}</td>
                  <td className="py-4 pr-4 text-right text-success font-medium">
                    +${trader.pnl7d.toLocaleString()}
                  </td>
                  <td className="py-4 pr-4 text-right">{trader.winRate}%</td>
                  <td className="py-4 text-right opacity-80">{trader.trades}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  change,
  loading = false,
}: {
  label: string;
  value: string;
  change?: number;
  loading?: boolean;
}) {
  return (
    <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-6">
      <p className="text-sm opacity-60 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${loading ? 'animate-pulse' : ''}`}>{value}</p>
      {change !== undefined && (
        <p className={`text-sm mt-1 ${change >= 0 ? 'text-success' : 'text-destructive'}`}>
          {change >= 0 ? '+' : ''}
          {change.toFixed(2)}%
        </p>
      )}
    </div>
  );
}
