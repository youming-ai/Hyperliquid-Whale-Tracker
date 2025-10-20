'use client';

import { useState, useEffect } from 'react';
import { MarketOverviewCard } from '@/components/market/MarketOverviewCard';
import { OHLCVChart } from '@/components/charts/OHLCVChart';
import { LiquidationHeatmap } from '@/components/heatmap/LiquidationHeatmap';
import { TopTradersTable } from '@/components/traders/TopTradersTable';
import { useMarketData } from '@/hooks/useMarketData';
import { useWebSocket } from '@/hooks/useWebSocket';

// Mock data for now - in real implementation, this would come from API
const mockMarketData = {
  symbol: 'BTC-PERP',
  price: 42000.50,
  markPrice: 42001.25,
  indexPrice: 41999.75,
  fundingRate: 0.0001,
  nextFundingTime: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
  openInterest: 125000000,
  volume24h: 2500000000,
  longShortRatio: 0.65,
  volatility24h: 0.045,
};

const mockOHLCVData = Array.from({ length: 100 }, (_, i) => ({
  timestamp: new Date(Date.now() - (100 - i) * 60 * 60 * 1000).toISOString(),
  open: 42000 + Math.random() * 100,
  high: 42100 + Math.random() * 100,
  low: 41900 + Math.random() * 100,
  close: 42000 + Math.random() * 100,
  volume: 1000000 + Math.random() * 500000,
  tradeCount: Math.floor(100 + Math.random() * 400),
}));

const mockHeatmapData = Array.from({ length: 50 }, (_, i) => {
  const price = 41000 + i * 200;
  return {
    priceBinCenter: price,
    priceBinWidth: 200,
    liquidationVolume: Math.random() * 1000000,
    liquidationCount: Math.floor(Math.random() * 100),
    liquidationNotional: Math.random() * 1000000 * price,
    confidenceScore: 0.7 + Math.random() * 0.3,
  };
});

const mockTraders = Array.from({ length: 10 }, (_, i) => ({
  id: `trader-${i + 1}`,
  alias: `Whale ${i + 1}`,
  publicScore: 75 + Math.random() * 25,
  tags: ['Aggressive', 'High Volume', 'Pro'].slice(0, Math.floor(Math.random() * 3) + 1),
  performance: {
    pnl: (Math.random() - 0.5) * 500000,
    returnPct: (Math.random() - 0.3) * 50,
    sharpeRatio: 1.2 + Math.random() * 2,
    maxDrawdown: -0.05 - Math.random() * 0.15,
    winRate: 0.45 + Math.random() * 0.35,
    avgHoldTimeHours: 2 + Math.random() * 12,
  },
  tradingActivity: {
    tradeCount: Math.floor(500 + Math.random() * 2000),
    volume: 50000000 + Math.random() * 100000000,
    turnover: 100000000 + Math.random() * 500000000,
    avgTradeSize: 50000 + Math.random() * 100000,
  },
  riskMetrics: {
    avgLeverage: 3 + Math.random() * 4,
    maxLeverage: 5 + Math.random() * 10,
    var95: 0.02 + Math.random() * 0.08,
  },
  symbolPreferences: Array.from({ length: 5 }, (_, j) => ({
    symbol: ['BTC-PERP', 'ETH-PERP', 'SOL-PERP', 'XRP-PERP', 'MATIC-PERP'][j],
    volumePct: Math.random() * 100,
    pnl: (Math.random() - 0.5) * 100000,
  })),
}));

export default function DashboardPage() {
  const [selectedSymbol, setSelectedSymbol] = useState('BTC-PERP');
  const [selectedTimeframe, setSelectedTimeframe] = useState('1h');
  const [selectedWindow, setSelectedWindow] = useState('4h');
  const [selectedMetric, setSelectedMetric] = useState('sharpe');
  const [isLive, setIsLive] = useState(false);

  // Use WebSocket for real-time updates
  useWebSocket({
    rooms: [`market:${selectedSymbol}`],
    onMessage: (message) => {
      if (message.type === 'market_update') {
        // Update market data in real-time
        console.log('Market update:', message.data);
      }
    },
  });

  // Fetch market data (mock for now)
  const { data: marketData, isLoading, error } = useMarketData(selectedSymbol);

  const handleSymbolChange = (symbol: string) => {
    setSelectedSymbol(symbol);
  };

  const handleTimeframeChange = (timeframe: string) => {
    setSelectedTimeframe(timeframe);
  };

  const handleWindowChange = (window: string) => {
    setSelectedWindow(window);
  };

  const handleMetricChange = (metric: string) => {
    setSelectedMetric(metric);
  };

  const toggleLiveMode = () => {
    setIsLive(!isLive);
  };

  if (error) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-600 mb-2">Error</h1>
          <p className="text-gray-600">Failed to load market data. Please try again.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
          <p className="mt-2 text-gray-600">Loading market data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Market Intelligence</h1>
          <p className="text-gray-600">Real-time analytics and insights</p>
        </div>
        <div className="flex items-center space-x-4">
          <select
            value={selectedSymbol}
            onChange={(e) => handleSymbolChange(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="BTC-PERP">BTC-PERP</option>
            <option value="ETH-PERP">ETH-PERP</option>
            <option value="SOL-PERP">SOL-PERP</option>
            <option value="XRP-PERP">XRP-PERP</option>
            <option value="MATIC-PERP">MATIC-PERP</option>
          </select>
          <button
            onClick={toggleLiveMode}
            className={`px-4 py-2 rounded-md text-sm font-medium ${
              isLive
                ? 'bg-red-600 text-white hover:bg-red-700'
                : 'bg-green-600 text-white hover:bg-green-700'
            }`}
          >
            {isLive ? 'Stop Live' : 'Start Live'}
          </button>
        </div>
      </div>

      {/* Market Overview */}
      <div className="grid grid-cols-1 gap-6">
        <MarketOverviewCard
          symbol={selectedSymbol}
          data={mockMarketData}
          isLive={isLive}
        />
      </div>

      {/* Charts and Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* OHLCV Chart */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Price Chart</h2>
            <select
              value={selectedTimeframe}
              onChange={(e) => handleTimeframeChange(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="1m">1m</option>
              <option value="5m">5m</option>
              <option value="15m">15m</option>
              <option value="1h">1h</option>
              <option value="4h">4h</option>
              <option value="1d">1d</option>
            </select>
          </div>
          <div className="h-96">
            <OHLCVChart data={mockOHLCVData} />
          </div>
        </div>

        {/* Liquidation Heatmap */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-semibold">Liquidation Heatmap</h2>
            <select
              value={selectedWindow}
              onChange={(e) => handleWindowChange(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="1h">1h</option>
              <option value="4h">4h</option>
              <option value="12h">12h</option>
              <option value="24h">24h</option>
            </select>
          </div>
          <div className="h-96">
            <LiquidationHeatmap data={mockHeatmapData} />
          </div>
        </div>
      </div>

      {/* Top Traders */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="text-xl font-semibold">Top Traders</h2>
          <select
            value={selectedMetric}
            onChange={(e) => handleMetricChange(e.target.value)}
            className="px-3 py-1 border border-gray-300 rounded-md bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="pnl">PnL</option>
            <option value="return">Return</option>
            <option value="sharpe">Sharpe Ratio</option>
            <option value="win_rate">Win Rate</option>
            <option value="volume">Volume</option>
          </select>
        </div>
        <div className="rounded-lg border bg-card">
          <TopTradersTable traders={mockTraders} />
        </div>
      </div>

      {/* Status Bar */}
      <div className="fixed bottom-4 right-4 bg-black bg-opacity-75 text-white px-3 py-2 rounded-lg text-sm">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${isLive ? 'bg-red-500' : 'bg-gray-500'}`}></div>
            <span>Server: {isLive ? 'Live' : 'Offline'}</span>
          </div>
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 rounded-full bg-green-500"></div>
            <span>WebSocket: Connected</span>
          </div>
        </div>
      </div>
    </div>
  );
}
