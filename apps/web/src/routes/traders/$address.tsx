import { createFileRoute, Link } from '@tanstack/react-router';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  DollarSign,
  TrendingUp,
} from 'lucide-react';
import { z } from 'zod';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { trpc } from '@/lib/api/trpc';
import { formatCompactNumber, formatPnL } from '@/lib/utils';

// Type-safe route with address validation
export const Route = createFileRoute('/traders/$address')({
  parseParams: (params) => ({
    address: z.string().min(42).max(42).parse(params.address),
  }),
  component: TraderDetailPage,
});

function StatCard({
  label,
  value,
  icon: Icon,
  positive,
  negative,
  description,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
  positive?: boolean;
  negative?: boolean;
  description?: string;
}) {
  let colorClass = '';
  if (positive) colorClass = 'text-success';
  if (negative) colorClass = 'text-destructive';

  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm opacity-60">{label}</p>
          {Icon && <Icon className="w-4 h-4 opacity-60" />}
        </div>
        <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
        {description && <p className="text-xs opacity-60 mt-1">{description}</p>}
      </CardContent>
    </Card>
  );
}

function TraderDetailPage() {
  const { address } = Route.useParams();

  // Fetch trader profile data
  // @ts-expect-error - AppRouter is any type until proper type generation is set up
  const { data: trader, isLoading: isLoadingProfile } =
    // @ts-expect-error
    trpc.traders.byAddress.useQuery(
      { address },
      {
        staleTime: 30_000, // 30 seconds
      },
    );

  // Fetch trader trades
  // @ts-expect-error - AppRouter is any type until proper type generation is set up
  const { data: trades = [], isLoading: isLoadingTrades } =
    // @ts-expect-error
    trpc.traders.trades.useQuery(
      { address, limit: 10 },
      {
        staleTime: 30_000,
      },
    );

  if (isLoadingProfile) {
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
        <Link to="/traders">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Traders
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-mono">{trader?.address}</h1>
            {trader?.nickname && <Badge variant="secondary">{trader.nickname}</Badge>}
            {trader?.isActive && (
              <Badge variant="success" className="text-xs">
                Active
              </Badge>
            )}
          </div>
          <p className="text-sm opacity-60 mt-1">
            Last trade:{' '}
            {trader?.lastTradeAt ? new Date(trader.lastTradeAt).toLocaleString() : 'N/A'}
          </p>
        </div>
        <Button className="gap-2">
          <TrendingUp className="w-4 h-4" />
          Copy This Trader
        </Button>
      </div>

      {/* Performance Stats */}
      <div className="mb-8">
        <h2 className="text-lg font-semibold mb-4">Performance</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            label="Equity"
            value={`$${formatCompactNumber(trader?.equity ?? 0)}`}
            icon={DollarSign}
          />
          <StatCard
            label="7d PnL"
            value={formatPnL(trader?.pnl7d ?? 0)}
            icon={Activity}
            positive={(trader?.pnl7d ?? 0) >= 0}
          />
          <StatCard
            label="30d PnL"
            value={formatPnL(trader?.pnl30d ?? 0)}
            icon={BarChart3}
            positive={(trader?.pnl30d ?? 0) >= 0}
          />
          <StatCard
            label="Win Rate"
            value={`${trader?.winRate}%`}
            description={`${trader?.winningTrades}W / ${trader?.losingTrades}L`}
          />
          <StatCard
            label="Sharpe Ratio"
            value={(trader?.sharpeRatio ?? 0).toFixed(2)}
            positive={(trader?.sharpeRatio ?? 0) >= 0}
          />
          <StatCard
            label="Max Drawdown"
            value={`${trader?.maxDrawdown}%`}
            icon={AlertTriangle}
            negative
          />
          <StatCard label="Total Trades" value={`${trader?.totalTrades?.toLocaleString()}`} />
          <StatCard
            label="Avg Position Size"
            value={`$${formatCompactNumber(trader?.avgPositionSize ?? 0)}`}
          />
        </div>
      </div>

      {/* Trading Style */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Trading Style</CardTitle>
          <CardDescription>Position preferences and trading patterns</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <p className="text-sm opacity-60 mb-1">Long vs Short</p>
              <p className="text-lg font-bold">
                {trader?.longTrades}L / {trader?.shortTrades}S
              </p>
            </div>
            <div>
              <p className="text-sm opacity-60 mb-1">Avg Holding Time</p>
              <p className="text-lg font-bold">{trader?.avgHoldingTime}</p>
            </div>
            <div>
              <p className="text-sm opacity-60 mb-1">Long Bias</p>
              <p className="text-lg font-bold">
                {(((trader?.longTrades ?? 0) / (trader?.totalTrades ?? 1)) * 100).toFixed(0)}%
              </p>
            </div>
            <div>
              <p className="text-sm opacity-60 mb-1">Activity Level</p>
              <p className="text-lg font-bold">
                {trader?.totalTrades && trader.totalTrades > 1000
                  ? 'Very High'
                  : trader.totalTrades && trader.totalTrades > 500
                    ? 'High'
                    : 'Moderate'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Open Positions */}
      {/* TODO: Implement positions API */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Open Positions</CardTitle>
          <CardDescription>Current active positions</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 opacity-60">
            Open positions data will be available once connected to Hyperliquid API
          </div>
        </CardContent>
      </Card>

      {/* Recent Trades */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Trade History</CardTitle>
          <CardDescription>Last {trades.length} closed positions</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingTrades ? (
            <div className="text-center py-8 opacity-60">Loading trades...</div>
          ) : trades.length === 0 ? (
            <div className="text-center py-8 opacity-60">No trade history available</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-left text-sm opacity-60 border-b border-[hsl(var(--border))]">
                    <th className="pb-3">Symbol</th>
                    <th className="pb-3">Side</th>
                    <th className="pb-3 text-right">Size</th>
                    <th className="pb-3 text-right">Entry</th>
                    <th className="pb-3 text-right">Exit</th>
                    <th className="pb-3 text-right">PnL</th>
                    <th className="pb-3 text-right">Time</th>
                  </tr>
                </thead>
                <tbody>
                  {trades.map((trade: any, i: number) => (
                    <tr key={i} className="border-b border-[hsl(var(--border))] last:border-0">
                      <td className="py-3 font-medium">{trade.symbol}</td>
                      <td className="py-3">
                        <Badge
                          variant={trade.side === 'LONG' ? 'success' : 'destructive'}
                          className="text-xs"
                        >
                          {trade.side}
                        </Badge>
                      </td>
                      <td className="py-3 text-right">{trade.size}</td>
                      <td className="py-3 text-right">${trade.entryPrice.toLocaleString()}</td>
                      <td className="py-3 text-right">${trade.exitPrice.toLocaleString()}</td>
                      <td
                        className={`py-3 text-right font-medium ${trade.pnl >= 0 ? 'text-success' : 'text-destructive'}`}
                      >
                        {formatPnL(trade.pnl)}
                      </td>
                      <td className="py-3 text-right text-sm opacity-60">
                        {new Date(trade.closedAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
