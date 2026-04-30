import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowUpDown, Filter, X } from 'lucide-react';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { trpc } from '@/lib/api/trpc';
import { formatCompactNumber, formatPnL } from '@/lib/utils';

export const Route = createFileRoute('/traders/')({
  component: TradersPage,
});

type Timeframe = '7d' | '30d' | 'all';
type SortBy = 'pnl' | 'winrate' | 'trades' | 'sharpe';
type SortOrder = 'asc' | 'desc';

function TradersPage() {
  const [timeframe, setTimeframe] = useState<Timeframe>('7d');
  const [sortBy, setSortBy] = useState<SortBy>('pnl');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  // Use tRPC to fetch traders with current filters
  // @ts-expect-error - AppRouter is any type until proper type generation is set up
  const { data, isLoading } = trpc.traders.list.useQuery({
    limit: 20,
    sortBy,
    sortOrder,
    timeframe,
    isActive: showActiveOnly,
  });

  const handleTimeframeChange = (newTimeframe: Timeframe) => {
    setTimeframe(newTimeframe);
  };

  const handleSortChange = (newSortBy: SortBy) => {
    if (sortBy === newSortBy) {
      // Toggle sort order if clicking the same column
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc'); // Default to descending for new sort column
    }
  };

  const clearFilters = () => {
    setShowActiveOnly(false);
    setSortBy('pnl');
    setSortOrder('desc');
    setTimeframe('7d');
  };

  const hasActiveFilters =
    showActiveOnly || sortBy !== 'pnl' || sortOrder !== 'desc' || timeframe !== '7d';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Top Traders</h1>
          <p className="text-sm opacity-60 mt-1">
            Discover and copy the best performers on Hyperliquid
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleSortChange('pnl')}>
            <ArrowUpDown className="w-4 h-4 mr-2" />
            Sort
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowActiveOnly(!showActiveOnly)}
            className={showActiveOnly ? 'bg-primary text-primary-foreground' : ''}
          >
            <Filter className="w-4 h-4 mr-2" />
            {showActiveOnly ? 'Active Only' : 'All Traders'}
          </Button>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              <X className="w-4 h-4 mr-2" />
              Clear
            </Button>
          )}
        </div>
      </div>

      {/* Time period selector */}
      <div className="flex gap-2 mb-6">
        <Button
          variant={timeframe === '7d' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleTimeframeChange('7d')}
        >
          7D
        </Button>
        <Button
          variant={timeframe === '30d' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleTimeframeChange('30d')}
        >
          30D
        </Button>
        <Button
          variant={timeframe === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleTimeframeChange('all')}
        >
          All Time
        </Button>
      </div>

      {/* Sort options */}
      <div className="flex gap-2 mb-6">
        <span className="text-sm opacity-60 self-center">Sort by:</span>
        <Button
          variant={sortBy === 'pnl' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleSortChange('pnl')}
        >
          PnL {sortBy === 'pnl' && (sortOrder === 'asc' ? '↑' : '↓')}
        </Button>
        <Button
          variant={sortBy === 'winrate' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleSortChange('winrate')}
        >
          Win Rate {sortBy === 'winrate' && (sortOrder === 'asc' ? '↑' : '↓')}
        </Button>
        <Button
          variant={sortBy === 'trades' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleSortChange('trades')}
        >
          Trades {sortBy === 'trades' && (sortOrder === 'asc' ? '↑' : '↓')}
        </Button>
        <Button
          variant={sortBy === 'sharpe' ? 'default' : 'outline'}
          size="sm"
          onClick={() => handleSortChange('sharpe')}
        >
          Sharpe {sortBy === 'sharpe' && (sortOrder === 'asc' ? '↑' : '↓')}
        </Button>
      </div>

      {/* Active filters indicator */}
      {hasActiveFilters && (
        <div className="mb-6 p-3 rounded-lg bg-muted/50 border border-border">
          <div className="text-sm font-medium mb-2">Active Filters:</div>
          <div className="flex flex-wrap gap-2">
            <Badge variant="secondary">Time: {timeframe}</Badge>
            <Badge variant="secondary">
              Sort: {sortBy} ({sortOrder})
            </Badge>
            {showActiveOnly && <Badge variant="secondary">Active only</Badge>}
          </div>
        </div>
      )}

      {/* Traders grid */}
      {isLoading ? (
        <div className="text-center py-12 opacity-60">Loading traders...</div>
      ) : !data || data.length === 0 ? (
        <div className="text-center py-12">
          <p className="opacity-60">No traders found matching your filters.</p>
          {hasActiveFilters && (
            <Button variant="outline" className="mt-4" onClick={clearFilters}>
              Clear Filters
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {data?.map((trader: any) => (
            <TraderCard
              key={trader.address}
              trader={trader}
              rank={trader.rank}
              timeframe={timeframe}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TraderCard({
  trader,
  rank,
  timeframe,
}: {
  trader: {
    address: string;
    pnl7d: number;
    pnl30d: number;
    pnl90d?: number;
    pnlAllTime?: number;
    winRate: number;
    totalTrades: number;
    equity: number;
    sharpe: number;
    maxDrawdown: number;
    traderId: string;
    isActive: boolean;
    lastTradeAt: string | null;
    rank: number;
  };
  rank: number;
  timeframe: Timeframe;
}) {
  // Get the PnL based on selected timeframe
  const getPnLForTimeframe = () => {
    switch (timeframe) {
      case '7d':
        return trader.pnl7d;
      case '30d':
        return trader.pnl30d;
      case 'all':
        return trader.pnlAllTime ?? trader.pnl30d; // Fallback to 30d if all time not available
      default:
        return trader.pnl7d;
    }
  };

  const displayPnL = getPnLForTimeframe();
  const isPositive = displayPnL >= 0;

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
              {rank}
            </div>
            <div>
              <div className="font-mono text-sm font-medium">{trader.address}</div>
              <div className="flex items-center gap-2 mt-1">
                {trader.isActive ? (
                  <Badge variant="success" className="text-xs">
                    Active
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-xs">
                    Inactive
                  </Badge>
                )}
                <span className="text-xs opacity-60">
                  {formatCompactNumber(trader.totalTrades)} trades
                </span>
              </div>
            </div>
          </div>
          <Link to="/traders/$address" params={{ address: trader.address }}>
            <Button variant="outline" size="sm">
              View Details
            </Button>
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs opacity-60 mb-1">{timeframe.toUpperCase()} PnL</div>
            <div
              className={`text-lg font-bold flex items-center gap-1 ${isPositive ? 'text-success' : 'text-destructive'}`}
            >
              {formatPnL(displayPnL)}
            </div>
          </div>
          <div>
            <div className="text-xs opacity-60 mb-1">Win Rate</div>
            <div className="text-lg font-bold">{trader.winRate}%</div>
          </div>
          <div>
            <div className="text-xs opacity-60 mb-1">Equity</div>
            <div className="text-lg font-bold">${formatCompactNumber(trader.equity)}</div>
          </div>
          <div>
            <div className="text-xs opacity-60 mb-1">Sharpe</div>
            <div
              className={`text-lg font-bold ${trader.sharpe >= 0 ? 'text-success' : 'text-destructive'}`}
            >
              {trader.sharpe.toFixed(2)}
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-[hsl(var(--border))]">
          <div className="flex items-center justify-between text-xs">
            <span className="opacity-60">Max Drawdown</span>
            <span className="font-medium">{trader.maxDrawdown.toFixed(1)}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
