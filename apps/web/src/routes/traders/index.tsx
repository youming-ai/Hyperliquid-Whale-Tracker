import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { ArrowUpDown, Filter, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Badge } from '~/components/ui/badge';
import { Button } from '~/components/ui/button';
import { Card, CardContent } from '~/components/ui/card';
import { api } from '~/lib/api-client';
import { FEED_COINS, getFeedClient } from '~/lib/feed-client';
import { formatCompactNumber, formatNumber, formatPnL } from '~/lib/utils';

export const Route = createFileRoute('/traders/')({
  component: TradersPage,
});

type Timeframe = '7d' | '30d' | 'all';
type SortBy = 'pnl' | 'winrate' | 'trades' | 'sharpe';
type SortOrder = 'asc' | 'desc';

interface Trader {
  address: string;
  traderId: string;
  pnl7d: number;
  pnl30d: number;
  pnlAll?: number;
  winRate: number;
  totalTrades: number;
  equity: number;
  sharpe: number;
  maxDrawdown: number;
  isActive: boolean;
  lastTradeAt: string | null;
  rank: number;
}

function isRecentlyActive(lastTradeAt: string | null | undefined): boolean {
  if (!lastTradeAt) return false;
  const ms = Date.now() - new Date(lastTradeAt).getTime();
  return ms >= 0 && ms < 7 * 24 * 60 * 60 * 1000;
}

function TradersPage() {
  const [timeframe, setTimeframe] = useState<Timeframe>('7d');
  const [sortBy, setSortBy] = useState<SortBy>('pnl');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [showActiveOnly, setShowActiveOnly] = useState(false);

  const { data: rawTraders, isLoading } = useQuery({
    queryKey: ['traders', { sortBy, sortOrder, timeframe, isActive: showActiveOnly }],
    queryFn: async () => {
      const res = await api.traders.$get({
        query: {
          limit: '20',
          sortBy,
          sortOrder,
          timeframe,
          isActive: showActiveOnly ? 'true' : 'false',
        },
      });
      if (!res.ok) throw new Error('failed to load traders');
      const body = (await res.json()) as unknown as {
        traders: Array<{
          rank?: number;
          address: string;
          traderId: string;
          lastTradeAt: string | null;
          equityUsd?: string | number | null;
          winrate?: string | number | null;
          sharpeRatio?: string | number | null;
          maxDrawdown?: string | number | null;
          pnl7d?: string | number | null;
          pnl30d?: string | number | null;
          pnlAll?: string | number | null;
          totalTrades?: number | null;
        }>;
      };
      return body;
    },
  });

  const traders: Trader[] = (rawTraders?.traders ?? []).map((trader) => ({
    ...trader,
    rank: trader.rank ?? 0,
    isActive: isRecentlyActive(trader.lastTradeAt),
    equity: Number(trader.equityUsd ?? 0),
    winRate: Number(trader.winrate ?? 0),
    sharpe: Number(trader.sharpeRatio ?? 0),
    maxDrawdown: Number(trader.maxDrawdown ?? 0),
    pnl7d: Number(trader.pnl7d ?? 0),
    pnl30d: Number(trader.pnl30d ?? 0),
    pnlAll: Number(trader.pnlAll ?? 0),
    totalTrades: Number(trader.totalTrades ?? 0),
  }));

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
      ) : traders.length === 0 ? (
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
          {traders.map((trader) => (
            <TraderCard
              key={trader.address}
              trader={trader}
              rank={trader.rank}
              timeframe={timeframe}
            />
          ))}
        </div>
      )}

      {/* Live market tape */}
      <LiveMarketTape />
    </div>
  );
}

/**
 * Live trade tape across the major feed coins — a real-time window into the
 * market while browsing leaderboards (api-gateway feed; degrades silently).
 */
function LiveMarketTape() {
  const [trades, setTrades] = useState<
    Array<{ coin: string; side: string; px: string; sz: string; time: number }>
  >([]);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    const client = getFeedClient();
    const channels = FEED_COINS.map((c) => `trades:${c}`);
    client.subscribe(channels);
    const off = client.on((message) => {
      if (message.type === 'state' && 'data' in message) {
        const state = message.data;
        setConnected('connected' in state ? state.connected : false);
        const seed: typeof trades = [];
        for (const coin of FEED_COINS) {
          const list = state.trades?.[coin] ?? [];
          for (const t of list.slice(-8))
            seed.push({ coin, side: t.side, px: t.px, sz: t.sz, time: t.time });
        }
        if (seed.length > 0) setTrades((prev) => [...seed.reverse(), ...prev].slice(0, 60));
        return;
      }
      if (message.type === 'data' && message.channel === 'trades') {
        const list = message.data as Array<{
          coin: string;
          side: string;
          px: string;
          sz: string;
          time: number;
        }>;
        setTrades((prev) =>
          [
            ...list
              .slice(-8)
              .reverse()
              .map((t) => t),
            ...prev,
          ].slice(0, 60),
        );
      }
    });
    void client.fetchState();
    return () => {
      off();
      client.unsubscribe(channels);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (trades.length === 0) return null;

  return (
    <div className="mt-8 rounded-xl border border-border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 bg-muted/30 text-xs uppercase tracking-wide opacity-70">
        <span>Live market tape</span>
        <span className={connected ? 'text-green-500' : 'text-amber-500'}>
          {connected ? '● feed live' : '○ reconnecting'}
        </span>
      </div>
      <div className="flex gap-5 px-3 py-2 overflow-x-auto">
        {trades.map((t) => (
          <div
            key={`${t.coin}-${t.time}`}
            className="flex items-center gap-2 text-xs font-mono whitespace-nowrap"
          >
            <span className="font-semibold opacity-80">{t.coin}</span>
            <span className={t.side === 'A' ? 'text-green-500' : 'text-red-500'}>
              {formatNumber(parseFloat(t.px))}
            </span>
            <span className="opacity-60">{formatNumber(parseFloat(t.sz))}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TraderCard({
  trader,
  rank,
  timeframe,
}: {
  trader: Trader;
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
        return trader.pnlAll ?? trader.pnl30d; // Fallback to 30d if all time not available
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
