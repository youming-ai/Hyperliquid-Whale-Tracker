import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { z } from 'zod';
import { generateMockTrades, VirtualTradeList } from '../../components/tables/VirtualTradeList';
import { shortenAddress } from '../../lib/utils';

// Type-safe route with address validation
export const Route = createFileRoute('/traders/$address')({
  parseParams: (params) => ({
    address: z.string().min(42).max(42).parse(params.address),
  }),
  component: TraderDetailPage,
});

// Mock trader detail data
const mockTraderDetail = {
  pnl24h: 12500,
  pnl7d: 125000,
  pnl30d: 450000,
  winRate: 68.5,
  totalTrades: 1240,
  avgHoldingTime: '4.2h',
  maxDrawdown: 8.5,
  sharpeRatio: 2.4,
  positions: [
    { symbol: 'BTC-PERP', side: 'LONG' as const, size: 2.5, entryPrice: 42100, pnl: 3250 },
    { symbol: 'ETH-PERP', side: 'SHORT' as const, size: 15, entryPrice: 2280, pnl: -450 },
  ],
};

// Generate 500 mock trades for virtual list demo
const mockTrades = generateMockTrades(500);

function TraderDetailPage() {
  const { address } = Route.useParams();

  const { data: trader, isLoading } = useQuery({
    queryKey: ['trader', address],
    queryFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return mockTraderDetail;
    },
  });

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center py-12 opacity-60">Loading trader data...</div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link to="/traders" className="opacity-60 hover:opacity-100 transition-opacity">
          ← Back
        </Link>
        <div>
          <h1 className="text-2xl font-bold font-mono">{shortenAddress(address)}</h1>
          <p className="text-sm opacity-60">Trader Profile</p>
        </div>
        <button className="ml-auto px-4 py-2 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm font-medium hover:opacity-90 transition-opacity">
          Copy This Trader
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          label="24h PnL"
          value={`$${trader?.pnl24h.toLocaleString()}`}
          positive={(trader?.pnl24h ?? 0) >= 0}
        />
        <StatCard
          label="7d PnL"
          value={`$${trader?.pnl7d.toLocaleString()}`}
          positive={(trader?.pnl7d ?? 0) >= 0}
        />
        <StatCard label="Win Rate" value={`${trader?.winRate}%`} />
        <StatCard
          label="Sharpe Ratio"
          value={`${trader?.sharpeRatio}`}
          positive={(trader?.sharpeRatio ?? 0) >= 0}
        />
        <StatCard label="Total Trades" value={`${trader?.totalTrades.toLocaleString()}`} />
        <StatCard label="Avg Holding" value={trader?.avgHoldingTime ?? ''} />
        <StatCard label="Max Drawdown" value={`${trader?.maxDrawdown}%`} negative />
        <StatCard
          label="30d PnL"
          value={`$${trader?.pnl30d.toLocaleString()}`}
          positive={(trader?.pnl30d ?? 0) >= 0}
        />
      </div>

      {/* Open Positions */}
      <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">Open Positions</h2>
        <table className="w-full">
          <thead>
            <tr className="text-left text-sm opacity-60 border-b border-[hsl(var(--border))]">
              <th className="pb-3">Symbol</th>
              <th className="pb-3">Side</th>
              <th className="pb-3 text-right">Size</th>
              <th className="pb-3 text-right">Entry</th>
              <th className="pb-3 text-right">PnL</th>
            </tr>
          </thead>
          <tbody>
            {trader?.positions.map((pos, i) => (
              <tr key={i} className="border-b border-[hsl(var(--border))] last:border-0">
                <td className="py-3 font-medium">{pos.symbol}</td>
                <td className={`py-3 ${pos.side === 'LONG' ? 'text-success' : 'text-destructive'}`}>
                  {pos.side}
                </td>
                <td className="py-3 text-right">{pos.size}</td>
                <td className="py-3 text-right">${pos.entryPrice.toLocaleString()}</td>
                <td
                  className={`py-3 text-right font-medium ${pos.pnl >= 0 ? 'text-success' : 'text-destructive'}`}
                >
                  {pos.pnl >= 0 ? '+' : ''}${pos.pnl.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Trade History with Virtual Scrolling */}
      <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Trade History</h2>
          <span className="text-sm opacity-60">Using TanStack Virtual for smooth scrolling</span>
        </div>
        <VirtualTradeList trades={mockTrades} height={400} />
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  positive,
  negative,
}: {
  label: string;
  value: string;
  positive?: boolean;
  negative?: boolean;
}) {
  let colorClass = '';
  if (positive) colorClass = 'text-success';
  if (negative) colorClass = 'text-destructive';

  return (
    <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-lg p-4">
      <p className="text-sm opacity-60 mb-1">{label}</p>
      <p className={`text-xl font-bold ${colorClass}`}>{value}</p>
    </div>
  );
}
