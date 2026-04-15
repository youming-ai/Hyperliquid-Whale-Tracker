/**
 * Hyperliquid API Client
 *
 * This module provides functions to interact with the Hyperliquid API
 * for fetching market data, trader information, and trading statistics.
 *
 * API Documentation: https://hyperliquid.xyz/info
 */

interface HyperliquidTrade {
  coin: string;
  side: 'A' | 'B'; // A = Buy (Long), B = Sell (Short)
  px: string; // Price
  sz: string; // Size
  time: number; // Timestamp
  start: string; // Start position
  hash: string;
  positionPosition: string;
}

interface HyperliquidUser {
  assetPosition: {
    [coin: string]: {
      positionValue: string;
      marginUsed: string;
      leverage: {
        value: string;
        rawUsd: string;
      };
      liquidationPx: string;
      returnOnEquity: string;
      unrealizedPnl: string;
      longAccount: {
        leverage: {
          value: string;
          rawUsd: string;
        };
        positionValue: string;
        marginUsed: string;
        size: string;
      };
      shortAccount: {
        leverage: {
          value: string;
          rawUsd: string;
        };
        positionValue: string;
        marginUsed: string;
        size: string;
      };
    };
  };
  crossMarginSummary: {
    accountValue: string;
    totalMarginUsed: string;
    totalNposPos: string;
    totalRawUsd: string;
    totalReturnOnEquity: string;
  };
  marginSummary: {
    [coin: string]: {
      accountValue: string;
      totalMarginUsed: string;
      totalNposPos: string;
      totalRawUsd: string;
      totalReturnOnEquity: string;
    };
  };
  withdrawable: string;
}

interface HyperliquidAllMids {
  [coin: string]: string; // Coin -> Price mapping
}

interface HyperliquidMeta {
  [symbol: string]: {
    maxLeverage: number;
    asset: string;
    type: 'perpetual' | 'perp';
  };
}

const HYPERLIQUID_API_BASE = 'https://api.hyperliquid.xyz';

/**
 * Fetch recent trades for a specific user
 */
export async function getUserTrades(address: string): Promise<HyperliquidTrade[]> {
  const response = await fetch(`${HYPERLIQUID_API_BASE}/info?user=${address}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch user trades: ${response.statusText}`);
  }

  const data = await response.json();

  if (!data || data.length === 0) {
    return [];
  }

  return data;
}

/**
 * Fetch user state including positions and margin
 */
export async function getUserState(address: string): Promise<HyperliquidUser> {
  const response = await fetch(`${HYPERLIQUID_API_BASE}/info?user=${address}&userState=info`);

  if (!response.ok) {
    throw new Error(`Failed to fetch user state: ${response.statusText}`);
  }

  const data = await response.json();

  if (!data || data.length === 0) {
    throw new Error('No user state data found');
  }

  return data[0];
}

/**
 * Fetch all mid prices (market data)
 */
export async function getAllMids(): Promise<HyperliquidAllMids> {
  const response = await fetch(`${HYPERLIQUID_API_BASE}/info`);

  if (!response.ok) {
    throw new Error(`Failed to fetch market data: ${response.statusText}`);
  }

  const data = await response.json();
  return data[0]?.allMids ?? {};
}

/**
 * Fetch meta information for perpetuals
 */
export async function getMeta(): Promise<HyperliquidMeta> {
  const response = await fetch(`${HYPERLIQUID_API_BASE}/meta`);

  if (!response.ok) {
    throw new Error(`Failed to fetch meta: ${response.statusText}`);
  }

  const data = await response.json();
  return data[0] ?? {};
}

/**
 * Calculate trader statistics from trades
 */
export function calculateTraderStats(
  trades: HyperliquidTrade[],
  userState: HyperliquidUser,
  address: string,
) {
  if (trades.length === 0) {
    return null;
  }

  // Sort trades by time (newest first)
  const sortedTrades = [...trades].sort((a, b) => b.time - a.time);

  // Calculate PnL for different time periods
  const now = Date.now();
  const periods = {
    d1: now - 24 * 60 * 60 * 1000,
    d7: now - 7 * 24 * 60 * 60 * 1000,
    d30: now - 30 * 24 * 60 * 60 * 1000,
    d90: now - 90 * 24 * 60 * 60 * 1000,
  };

  const pnlByPeriod = {
    d1: 0,
    d7: 0,
    d30: 0,
    d90: 0,
    all: 0,
  };

  let winningTrades = 0;
  const totalTrades = trades.length;

  for (const trade of sortedTrades) {
    const side = trade.side === 'A' ? 1 : -1; // A = Long (1), B = Short (-1)
    const size = parseFloat(trade.sz);
    const price = parseFloat(trade.px);
    const pnl = side * size * price; // Simplified PnL calculation

    // Aggregate by time period
    if (trade.time >= periods.d1) pnlByPeriod.d1 += pnl;
    if (trade.time >= periods.d7) pnlByPeriod.d7 += pnl;
    if (trade.time >= periods.d30) pnlByPeriod.d30 += pnl;
    if (trade.time >= periods.d90) pnlByPeriod.d90 += pnl;
    pnlByPeriod.all += pnl;

    if (pnl > 0) winningTrades++;
  }

  const winRate = totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0;

  // Calculate equity and margin from user state
  const accountValue = userState.crossMarginSummary
    ? parseFloat(userState.crossMarginSummary.accountValue)
    : 0;

  // Calculate Sharpe ratio (simplified - using mean/std of returns would be more accurate)
  const sharpeRatio = accountValue > 0 ? (pnlByPeriod.d30 / accountValue) * Math.sqrt(365) : 0;

  // Calculate max drawdown (simplified - would need more detailed tracking)
  const maxDrawdown = accountValue > 0 ? Math.max(0, (-pnlByPeriod.d30 / accountValue) * 100) : 0;

  // Determine if active (traded in last 24 hours)
  const isActive = sortedTrades[0] && sortedTrades[0].time >= periods.d1;

  return {
    address,
    equity: accountValue,
    pnl1d: pnlByPeriod.d1,
    pnl7d: pnlByPeriod.d7,
    pnl30d: pnlByPeriod.d30,
    pnl90d: pnlByPeriod.d90,
    pnlAllTime: pnlByPeriod.all,
    winRate,
    totalTrades,
    winningTrades,
    losingTrades: totalTrades - winningTrades,
    sharpeRatio,
    maxDrawdown,
    isActive,
    lastTradeAt: sortedTrades[0] ? new Date(sortedTrades[0].time).toISOString() : null,
  };
}

/**
 * Format a list of trades for database insertion
 */
export function formatTradesForDB(trades: HyperliquidTrade[], traderAddress: string) {
  return trades.map((trade) => ({
    traderAddress,
    symbol: trade.coin,
    side: trade.side === 'A' ? 'LONG' : 'SHORT',
    size: parseFloat(trade.sz),
    entryPrice: parseFloat(trade.px),
    exitPrice: parseFloat(trade.px), // Simplified - would need closing trade
    quantity: parseFloat(trade.sz),
    leverage: 1, // Would need to fetch from user state
    realizedPnl: 0, // Would need to calculate from position close
    isOpen: false,
    executedAt: new Date(trade.time).toISOString(),
    hash: trade.hash,
  }));
}

/**
 * Fetch and process trader data from Hyperliquid API
 */
export async function fetchTraderData(address: string) {
  try {
    const [trades, userState] = await Promise.all([
      getUserTrades(address),
      getUserState(address).catch(() => null), // User state might fail for new addresses
    ]);

    if (!userState || !userState.crossMarginSummary) {
      // If no user state, create minimal stats from trades
      if (trades.length === 0) {
        return null;
      }

      const minimalStats = {
        address,
        equity: 0,
        pnl1d: 0,
        pnl7d: 0,
        pnl30d: 0,
        pnl90d: 0,
        pnlAllTime: 0,
        winRate: 0,
        totalTrades: trades.length,
        winningTrades: 0,
        losingTrades: trades.length,
        sharpeRatio: 0,
        maxDrawdown: 0,
        isActive: false,
        lastTradeAt: new Date(trades[0].time).toISOString(),
      };

      return {
        stats: minimalStats,
        trades: formatTradesForDB(trades, address),
      };
    }

    const stats = calculateTraderStats(trades, userState, address);

    return {
      stats,
      trades: formatTradesForDB(trades, address),
    };
  } catch (error) {
    console.error(`Failed to fetch trader data for ${address}:`, error);
    return null;
  }
}
