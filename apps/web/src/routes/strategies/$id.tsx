import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useState } from 'react';

export const Route = createFileRoute('/strategies/$id')({
  component: StrategyDetailPage,
});

// Mock strategy detail data
const mockStrategyDetail = {
  id: '1',
  name: 'Conservative Portfolio',
  description: 'Low-risk strategy focusing on stable returns from top-performing traders',
  status: 'active',
  mode: 'portfolio',
  riskParams: {
    maxLeverage: 3,
    maxPositionUsd: 50000,
    slippageBps: 10,
    minOrderUsd: 100,
  },
  settings: {
    followNewEntriesOnly: true,
    autoRebalance: true,
    rebalanceThresholdBps: 50,
  },
  performance: {
    totalPnl: 1250,
    totalFees: 45,
    alignmentRate: 98.5,
    totalTrades: 24,
    winRate: 66.7,
    sharpeRatio: 1.85,
    maxDrawdown: 3.2,
  },
  allocations: [
    {
      traderId: '0x1234...5678',
      traderName: 'BTC Whale Alpha',
      weight: 0.5,
      performance: {
        allocatedPnl: 625,
        allocatedFees: 22,
        winRate: 68.5,
        trades: 12,
      },
      stats: {
        pnl7d: 5200,
        pnl30d: 18500,
        totalTrades: 156,
        winRate: 68.5,
      },
    },
    {
      traderId: '0x2345...6789',
      traderName: 'Stable Returns Fund',
      weight: 0.3,
      performance: {
        allocatedPnl: 375,
        allocatedFees: 14,
        winRate: 85.2,
        trades: 8,
      },
      stats: {
        pnl7d: 2100,
        pnl30d: 8900,
        totalTrades: 84,
        winRate: 85.2,
      },
    },
    {
      traderId: '0x3456...789a',
      traderName: 'ETH Scalper Pro',
      weight: 0.2,
      performance: {
        allocatedPnl: 250,
        allocatedFees: 9,
        winRate: 72.1,
        trades: 4,
      },
      stats: {
        pnl7d: 3400,
        pnl30d: 11200,
        totalTrades: 198,
        winRate: 72.1,
      },
    },
  ],
  recentCopies: [
    {
      id: '1',
      symbol: 'BTC-PERP',
      side: 'LONG',
      quantity: '0.05',
      price: 43250,
      status: 'filled',
      pnl: 85,
      timestamp: '2024-12-15T14:25:00.000Z',
    },
    {
      id: '2',
      symbol: 'ETH-PERP',
      side: 'LONG',
      quantity: '1.2',
      price: 2315,
      status: 'filled',
      pnl: 120,
      timestamp: '2024-12-15T12:30:00.000Z',
    },
    {
      id: '3',
      symbol: 'SOL-PERP',
      side: 'SHORT',
      quantity: '15',
      price: 98.5,
      status: 'filled',
      pnl: -32,
      timestamp: '2024-12-15T10:15:00.000Z',
    },
    {
      id: '4',
      symbol: 'BTC-PERP',
      side: 'SHORT',
      quantity: '0.03',
      price: 43400,
      status: 'filled',
      pnl: -45,
      timestamp: '2024-12-15T08:20:00.000Z',
    },
    {
      id: '5',
      symbol: 'AVAX-PERP',
      side: 'LONG',
      quantity: '25',
      price: 42.8,
      status: 'pending',
      pnl: 0,
      timestamp: '2024-12-15T16:40:00.000Z',
    },
  ],
  createdAt: '2024-12-01T00:00:00.000Z',
  updatedAt: '2024-12-15T14:25:00.000Z',
};

// Mock performance timeseries data
const mockPerformanceData = [
  { date: '2024-12-01', value: 100000, pnl: 0 },
  { date: '2024-12-02', value: 100450, pnl: 450 },
  { date: '2024-12-03', value: 100120, pnl: -330 },
  { date: '2024-12-04', value: 100890, pnl: 770 },
  { date: '2024-12-05', value: 100650, pnl: -240 },
  { date: '2024-12-06', value: 101200, pnl: 550 },
  { date: '2024-12-07', value: 100980, pnl: -220 },
  { date: '2024-12-08', value: 101500, pnl: 520 },
  { date: '2024-12-09', value: 101120, pnl: -380 },
  { date: '2024-12-10', value: 101890, pnl: 770 },
  { date: '2024-12-11', value: 101450, pnl: -440 },
  { date: '2024-12-12', value: 102100, pnl: 650 },
  { date: '2024-12-13', value: 101780, pnl: -320 },
  { date: '2024-12-14', value: 101950, pnl: 170 },
  { date: '2024-12-15', value: 101250, pnl: -700 },
];

type Timeframe = '1d' | '7d' | '30d' | 'all';

function StrategyDetailPage() {
  const { id } = Route.useParams();
  const [timeframe, setTimeframe] = useState<Timeframe>('7d');

  const { data: strategy, isLoading } = useQuery({
    queryKey: ['strategy', id],
    queryFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return mockStrategyDetail;
    },
  });

  const { data: performanceData } = useQuery({
    queryKey: ['strategy', id, 'performance', timeframe],
    queryFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return mockPerformanceData;
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center py-12 opacity-60">Loading strategy...</div>
      </div>
    );
  }

  if (!strategy) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center py-12">
          <p className="text-lg mb-4">Strategy not found</p>
          <Link
            to="/strategies"
            className="px-4 py-2 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
          >
            Back to Strategies
          </Link>
        </div>
      </div>
    );
  }

  // Calculate stats for selected timeframe
  const relevantData =
    performanceData?.slice(
      -timeframe === '1d'
        ? 1
        : timeframe === '7d'
          ? 7
          : timeframe === '30d'
            ? 30
            : performanceData.length,
    ) || [];
  const periodPnl =
    relevantData.length > 0
      ? relevantData[relevantData.length - 1].value - relevantData[0].value
      : 0;
  const periodReturn = relevantData.length > 0 ? (periodPnl / relevantData[0].value) * 100 : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-2xl font-bold">{strategy.name}</h1>
            <StatusBadge status={strategy.status} />
            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-500/20 text-blue-500">
              {strategy.mode === 'portfolio' ? 'Portfolio' : 'Single'}
            </span>
          </div>
          {strategy.description && <p className="text-sm opacity-60">{strategy.description}</p>}
          <p className="text-xs opacity-40 mt-2">
            Created: {new Date(strategy.createdAt).toLocaleDateString()} • Last updated:{' '}
            {new Date(strategy.updatedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/strategies/new"
            params={{ id }}
            className="px-4 py-2 rounded-lg border border-[hsl(var(--border))] text-sm font-medium hover:bg-[hsl(var(--accent))] transition-colors"
          >
            Edit Settings
          </Link>
          {strategy.status === 'active' ? (
            <button className="px-4 py-2 rounded-lg bg-yellow-500 text-black text-sm font-medium hover:opacity-90 transition-opacity">
              Pause
            </button>
          ) : strategy.status === 'paused' ? (
            <button className="px-4 py-2 rounded-lg bg-green-500 text-white text-sm font-medium hover:opacity-90 transition-opacity">
              Resume
            </button>
          ) : null}
        </div>
      </div>

      {/* Main Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="Total PnL"
          value={`$${strategy.performance.totalPnl.toLocaleString()}`}
          positive={strategy.performance.totalPnl >= 0}
        />
        <StatCard
          label="Total Fees"
          value={`$${strategy.performance.totalFees.toLocaleString()}`}
        />
        <StatCard label="Win Rate" value={`${strategy.performance.winRate}%`} />
        <StatCard
          label="Alignment Rate"
          value={`${strategy.performance.alignmentRate}%`}
          positive
        />
      </div>

      {/* Performance Chart */}
      <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Portfolio Value</h2>
          <div className="flex gap-2">
            {(['1d', '7d', '30d', 'all'] as Timeframe[]).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 text-sm rounded-md transition-colors ${
                  timeframe === tf
                    ? 'bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]'
                    : 'border border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]'
                }`}
              >
                {tf === 'all' ? 'All' : tf.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="mb-4">
          <p className="text-2xl font-bold">
            ${performanceData?.[performanceData.length - 1]?.value.toLocaleString() || '0'}
          </p>
          <p className={`text-sm ${periodReturn >= 0 ? 'text-success' : 'text-destructive'}`}>
            {periodReturn >= 0 ? '+' : ''}
            {periodReturn.toFixed(2)}% ({timeframe === 'all' ? 'all' : timeframe})
          </p>
        </div>
        {/* Simple bar chart visualization */}
        <div className="h-32 flex items-end gap-1">
          {relevantData.map((data, i) => {
            const min = Math.min(...relevantData.map((d) => d.value));
            const max = Math.max(...relevantData.map((d) => d.value));
            const height = ((data.value - min) / (max - min)) * 100;
            return (
              <div
                key={i}
                className="flex-1 bg-[hsl(var(--primary))] rounded-t transition-all hover:opacity-80"
                style={{ height: `${Math.max(height, 5)}%` }}
                title={`${data.date}: $${data.value.toLocaleString()}`}
              />
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Allocations */}
        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Trader Allocations</h2>
          <div className="space-y-4">
            {strategy.allocations.map((alloc) => (
              <div
                key={alloc.traderId}
                className="p-4 rounded-lg bg-[hsl(var(--muted)/0.3)] border border-[hsl(var(--border))]"
              >
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-medium">{alloc.traderName}</p>
                    <p className="text-xs opacity-60 font-mono">{alloc.traderId}</p>
                  </div>
                  <span className="text-sm font-medium">{Math.round(alloc.weight * 100)}%</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="opacity-60">PnL:</span>{' '}
                    <span
                      className={
                        alloc.performance.allocatedPnl >= 0 ? 'text-success' : 'text-destructive'
                      }
                    >
                      ${alloc.performance.allocatedPnl.toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="opacity-60">Win Rate:</span> {alloc.performance.winRate}%
                  </div>
                  <div>
                    <span className="opacity-60">Trades:</span> {alloc.performance.trades}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Strategy Settings */}
        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Strategy Settings</h2>
          <div className="space-y-3">
            <SettingRow
              label="Mode"
              value={strategy.mode === 'portfolio' ? 'Portfolio' : 'Single Trader'}
            />
            <SettingRow label="Max Leverage" value={`${strategy.riskParams.maxLeverage}x`} />
            {strategy.riskParams.maxPositionUsd && (
              <SettingRow
                label="Max Position"
                value={`$${strategy.riskParams.maxPositionUsd.toLocaleString()}`}
              />
            )}
            <SettingRow label="Slippage" value={`${strategy.riskParams.slippageBps / 100}%`} />
            <SettingRow label="Min Order" value={`$${strategy.riskParams.minOrderUsd}`} />
            <hr className="border-[hsl(var(--border))]" />
            <SettingRow
              label="New Entries Only"
              value={strategy.settings.followNewEntriesOnly ? 'Yes' : 'No'}
            />
            <SettingRow
              label="Auto Rebalance"
              value={strategy.settings.autoRebalance ? 'Yes' : 'No'}
            />
            {strategy.settings.autoRebalance && (
              <SettingRow
                label="Rebalance Threshold"
                value={`${strategy.settings.rebalanceThresholdBps / 100}%`}
              />
            )}
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Performance Metrics</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard label="Total Trades" value={strategy.performance.totalTrades} />
          <MetricCard label="Win Rate" value={`${strategy.performance.winRate}%`} />
          <MetricCard label="Sharpe Ratio" value={strategy.performance.sharpeRatio.toFixed(2)} />
          <MetricCard label="Max Drawdown" value={`${strategy.performance.maxDrawdown}%`} />
        </div>
      </div>

      {/* Recent Copied Trades */}
      <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Copied Trades</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="text-left text-sm opacity-60 border-b border-[hsl(var(--border))]">
                <th className="pb-3">Symbol</th>
                <th className="pb-3">Side</th>
                <th className="pb-3 text-right">Quantity</th>
                <th className="pb-3 text-right">Price</th>
                <th className="pb-3">Status</th>
                <th className="pb-3 text-right">PnL</th>
                <th className="pb-3 text-right">Time</th>
              </tr>
            </thead>
            <tbody>
              {strategy.recentCopies.map((trade) => (
                <tr key={trade.id} className="border-b border-[hsl(var(--border))] last:border-0">
                  <td className="py-3 font-medium">{trade.symbol}</td>
                  <td
                    className={`py-3 ${trade.side === 'LONG' ? 'text-success' : 'text-destructive'}`}
                  >
                    {trade.side}
                  </td>
                  <td className="py-3 text-right">{trade.quantity}</td>
                  <td className="py-3 text-right">${trade.price.toLocaleString()}</td>
                  <td className="py-3">
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full ${
                        trade.status === 'filled'
                          ? 'bg-green-500/20 text-green-500'
                          : 'bg-yellow-500/20 text-yellow-500'
                      }`}
                    >
                      {trade.status}
                    </span>
                  </td>
                  <td
                    className={`py-3 text-right font-medium ${trade.pnl >= 0 ? 'text-success' : 'text-destructive'}`}
                  >
                    {trade.pnl >= 0 ? '+' : ''}${trade.pnl}
                  </td>
                  <td className="py-3 text-right opacity-60 text-sm">
                    {formatRelativeTime(trade.timestamp)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles = {
    active: 'bg-green-500/20 text-green-500',
    paused: 'bg-yellow-500/20 text-yellow-500',
    error: 'bg-red-500/20 text-red-500',
    terminated: 'bg-gray-500/20 text-gray-500',
  };
  const style = styles[status.toLowerCase() as keyof typeof styles] || styles.paused;
  return <span className={`px-2 py-0.5 text-xs rounded-full ${style}`}>{status}</span>;
}

function StatCard({
  label,
  value,
  positive,
}: {
  label: string;
  value: string;
  positive?: boolean;
}) {
  return (
    <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg p-4">
      <p className="text-sm opacity-60 mb-1">{label}</p>
      <p className={`text-xl font-bold ${positive ? 'text-success' : ''}`}>{value}</p>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="p-3 rounded-lg bg-[hsl(var(--muted)/0.3)]">
      <p className="text-xs opacity-60 mb-1">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
    </div>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2">
      <span className="opacity-60">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function formatRelativeTime(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  return `${diffDays}d ago`;
}
