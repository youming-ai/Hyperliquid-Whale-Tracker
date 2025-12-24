import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/strategies/$id')({
  component: StrategyDetailPage,
});

const mockStrategyDetail = {
  id: '1',
  name: 'BTC Whale Follow',
  targetAddress: '0x1234567890abcdef1234567890abcdef12345678',
  status: 'ACTIVE',
  allocation: 5000,
  pnl: 1250,
  createdAt: '2024-12-01',
  settings: {
    copyMode: 'PROPORTIONAL',
    leverage: 3,
    maxDailyLoss: 5,
    stopLossPercent: 10,
    takeProfitPercent: 20,
  },
  performance: {
    trades: 24,
    winRate: 66.7,
    avgPnl: 52,
    maxDrawdown: 3.2,
  },
  recentCopies: [
    { symbol: 'BTC-PERP', side: 'LONG', size: 0.12, price: 42350, time: '2h ago', pnl: 85 },
    { symbol: 'ETH-PERP', side: 'LONG', size: 2.5, price: 2285, time: '5h ago', pnl: 120 },
    { symbol: 'BTC-PERP', side: 'SHORT', size: 0.08, price: 42500, time: '12h ago', pnl: -45 },
  ],
};

function StrategyDetailPage() {
  const { id } = Route.useParams();

  const { data: strategy, isLoading } = useQuery({
    queryKey: ['strategy', id],
    queryFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return mockStrategyDetail;
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center py-12 opacity-60">Loading strategy...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">{strategy?.name}</h1>
          <p className="text-sm opacity-60 mt-1">
            Copying: <span className="font-mono">{strategy?.targetAddress}</span>
          </p>
        </div>
        <div className="flex gap-2">
          <button className="px-4 py-2 rounded-lg border border-[hsl(var(--border))] text-sm font-medium hover:bg-[hsl(var(--accent))] transition-colors">
            Edit Settings
          </button>
          <button className="px-4 py-2 rounded-lg bg-yellow-500 text-black text-sm font-medium hover:opacity-90 transition-opacity">
            Pause Strategy
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Total PnL" value={`$${strategy?.pnl.toLocaleString()}`} positive />
        <StatCard label="Allocation" value={`$${strategy?.allocation.toLocaleString()}`} />
        <StatCard label="Win Rate" value={`${strategy?.performance.winRate}%`} />
        <StatCard label="Trades" value={`${strategy?.performance.trades}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Settings */}
        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Strategy Settings</h2>
          <div className="space-y-3">
            <SettingRow label="Copy Mode" value={strategy?.settings.copyMode ?? ''} />
            <SettingRow label="Leverage" value={`${strategy?.settings.leverage}x`} />
            <SettingRow label="Max Daily Loss" value={`${strategy?.settings.maxDailyLoss}%`} />
            <SettingRow label="Stop Loss" value={`${strategy?.settings.stopLossPercent}%`} />
            <SettingRow label="Take Profit" value={`${strategy?.settings.takeProfitPercent}%`} />
          </div>
        </div>

        {/* Performance */}
        <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-6">
          <h2 className="text-lg font-semibold mb-4">Performance Metrics</h2>
          <div className="space-y-3">
            <SettingRow label="Total Trades" value={`${strategy?.performance.trades}`} />
            <SettingRow label="Win Rate" value={`${strategy?.performance.winRate}%`} />
            <SettingRow label="Avg PnL per Trade" value={`$${strategy?.performance.avgPnl}`} />
            <SettingRow label="Max Drawdown" value={`${strategy?.performance.maxDrawdown}%`} />
          </div>
        </div>
      </div>

      {/* Recent Copies */}
      <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Copied Trades</h2>
        <table className="w-full">
          <thead>
            <tr className="text-left text-sm opacity-60 border-b border-[hsl(var(--border))]">
              <th className="pb-3">Symbol</th>
              <th className="pb-3">Side</th>
              <th className="pb-3 text-right">Size</th>
              <th className="pb-3 text-right">Price</th>
              <th className="pb-3 text-right">Time</th>
              <th className="pb-3 text-right">PnL</th>
            </tr>
          </thead>
          <tbody>
            {strategy?.recentCopies.map((copy, i) => (
              <tr key={i} className="border-b border-[hsl(var(--border))] last:border-0">
                <td className="py-3 font-medium">{copy.symbol}</td>
                <td
                  className={`py-3 ${copy.side === 'LONG' ? 'text-success' : 'text-destructive'}`}
                >
                  {copy.side}
                </td>
                <td className="py-3 text-right">{copy.size}</td>
                <td className="py-3 text-right">${copy.price.toLocaleString()}</td>
                <td className="py-3 text-right opacity-60">{copy.time}</td>
                <td
                  className={`py-3 text-right font-medium ${copy.pnl >= 0 ? 'text-success' : 'text-destructive'}`}
                >
                  {copy.pnl >= 0 ? '+' : ''}${copy.pnl}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
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

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between py-2 border-b border-[hsl(var(--border))] last:border-0">
      <span className="opacity-60">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
