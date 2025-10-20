import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { MarketOverviewSchema, OHLCVSchema, HeatmapBinSchema } from '@hyperdash/shared-types';

// Type definitions for market data
interface MarketOverview {
  symbol: string;
  exchange: string;
  timestamp: string;
  price: number;
  markPrice: number;
  indexPrice: number;
  fundingRate: number;
  nextFundingTime: string;
  openInterest: number;
  volume24h: number;
  longShortRatio: number;
  volatility24h: number;
}

interface OHLCVData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tradeCount?: number;
}

interface HeatmapBin {
  priceBinCenter: number;
  priceBinWidth: number;
  liquidationVolume: number;
  liquidationCount: number;
  liquidationNotional: number;
  confidenceScore: number;
}

interface MarketState {
  // Current market overview data
  marketOverview: Record<string, MarketOverview | null>;

  // OHLCV data by symbol and timeframe
  ohlcvData: Record<string, Record<string, OHLCVData[]>>;

  // Heatmap data by symbol and window
  heatmapData: Record<string, Record<string, HeatmapBin[]>>;

  // Real-time updates
  realTimeUpdates: Record<string, any>;

  // Loading states
  loading: Record<string, boolean>;

  // Error states
  errors: Record<string, string | null>;

  // Last update timestamps
  lastUpdated: Record<string, Date | null>;

  // WebSocket connection status
  isConnected: boolean;

  // Subscribed symbols
  subscribedSymbols: Set<string>;
}

interface MarketActions {
  // Market overview
  setMarketOverview: (symbol: string, data: MarketOverview) => void;
  updateMarketOverview: (symbol: string, updates: Partial<MarketOverview>) => void;

  // OHLCV data
  setOHLCVData: (symbol: string, timeframe: string, data: OHLCVData[]) => void;
  appendOHLCVData: (symbol: string, timeframe: string, data: OHLCVData) => void;

  // Heatmap data
  setHeatmapData: (symbol: string, window: string, data: HeatmapBin[]) => void;
  updateHeatmapData: (symbol: string, window: string, updates: Partial<HeatmapBin>[]) => void;

  // Real-time updates
  updateRealTimeData: (symbol: string, data: any) => void;

  // Loading and error states
  setLoading: (key: string, isLoading: boolean) => void;
  setError: (key: string, error: string | null) => void;

  // WebSocket management
  setConnected: (isConnected: boolean) => void;
  subscribeSymbol: (symbol: string) => void;
  unsubscribeSymbol: (symbol: string) => void;

  // Batch updates
  updateSymbolData: (symbol: string, data: {
    overview?: MarketOverview;
    ohlcv?: Record<string, OHLCVData[]>;
    heatmap?: Record<string, HeatmapBin[]>;
  }) => void;

  // Cache management
  clearCache: () => void;
  clearSymbolCache: (symbol: string) => void;
}

export const useMarketStore = create<MarketState & MarketActions>()(
  devtools(
    (set, get) => ({
      // Initial state
      marketOverview: {},
      ohlcvData: {},
      heatmapData: {},
      realTimeUpdates: {},
      loading: {},
      errors: {},
      lastUpdated: {},
      isConnected: false,
      subscribedSymbols: new Set(),

      // Market overview actions
      setMarketOverview: (symbol, data) => {
        const parsedData = MarketOverviewSchema.parse(data);
        set((state) => ({
          marketOverview: {
            ...state.marketOverview,
            [symbol]: parsedData,
          },
          lastUpdated: {
            ...state.lastUpdated,
            [`overview:${symbol}`]: new Date(),
          },
        }));
      },

      updateMarketOverview: (symbol, updates) => {
        set((state) => {
          const current = state.marketOverview[symbol];
          if (!current) return state;

          const updated = {
            ...current,
            ...updates,
            timestamp: new Date().toISOString(),
          };

          const validatedData = MarketOverviewSchema.parse(updated);

          return {
            ...state,
            marketOverview: {
              ...state.marketOverview,
              [symbol]: validatedData,
            },
            lastUpdated: {
              ...state.lastUpdated,
              [`overview:${symbol}`]: new Date(),
            },
          };
        });
      },

      // OHLCV data actions
      setOHLCVData: (symbol, timeframe, data) => {
        const parsedData = data.map(item => OHLCVSchema.parse(item));
        set((state) => ({
          ohlcvData: {
            ...state.ohlcvData,
            [symbol]: {
              ...state.ohlcvData[symbol],
              [timeframe]: parsedData,
            },
          },
          lastUpdated: {
            ...state.lastUpdated,
            [`ohlcv:${symbol}:${timeframe}`]: new Date(),
          },
        }));
      },

      appendOHLCVData: (symbol, timeframe, data) => {
        const parsedData = OHLCVSchema.parse(data);
        set((state) => {
          const currentData = state.ohlcvData[symbol]?.[timeframe] || [];
          const newData = [...currentData, parsedData].slice(-200); // Keep last 200 candles

          return {
            ...state,
            ohlcvData: {
              ...state.ohlcvData,
              [symbol]: {
                ...state.ohlcvData[symbol],
                [timeframe]: newData,
              },
            },
            lastUpdated: {
              ...state.lastUpdated,
              [`ohlcv:${symbol}:${timeframe}`]: new Date(),
            },
          };
        });
      },

      // Heatmap data actions
      setHeatmapData: (symbol, window, data) => {
        const parsedData = data.map(item => HeatmapBinSchema.parse(item));
        set((state) => ({
          heatmapData: {
            ...state.heatmapData,
            [symbol]: {
              ...state.heatmapData[symbol],
              [window]: parsedData,
            },
          },
          lastUpdated: {
            ...state.lastUpdated,
            [`heatmap:${symbol}:${window}`]: new Date(),
          },
        }));
      },

      updateHeatmapData: (symbol, window, updates) => {
        set((state) => {
          const currentData = state.heatmapData[symbol]?.[window] || [];
          const updatedData = currentData.map((item, index) => {
            const update = updates[index];
            if (update) {
              const merged = { ...item, ...update };
              return HeatmapBinSchema.parse(merged);
            }
            return item;
          });

          return {
            ...state,
            heatmapData: {
              ...state.heatmapData,
              [symbol]: {
                ...state.heatmapData[symbol],
                [window]: updatedData,
              },
            },
            lastUpdated: {
              ...state.lastUpdated,
              [`heatmap:${symbol}:${window}`]: new Date(),
            },
          };
        });
      },

      // Real-time updates
      updateRealTimeData: (symbol, data) => {
        set((state) => ({
          realTimeUpdates: {
            ...state.realTimeUpdates,
            [symbol]: data,
          },
        }));
      },

      // Loading and error states
      setLoading: (key, isLoading) => {
        set((state) => ({
          loading: {
            ...state.loading,
            [key]: isLoading,
          },
        }));
      },

      setError: (key, error) => {
        set((state) => ({
          errors: {
            ...state.errors,
            [key]: error,
          },
        }));
      },

      // WebSocket management
      setConnected: (isConnected) => {
        set({ isConnected });
      },

      subscribeSymbol: (symbol) => {
        set((state) => ({
          subscribedSymbols: new Set([...state.subscribedSymbols, symbol]),
        }));
      },

      unsubscribeSymbol: (symbol) => {
        set((state) => {
          const newSubscriptions = new Set(state.subscribedSymbols);
          newSubscriptions.delete(symbol);

          // Clear cached data for unsubscribed symbol
          delete state.marketOverview[symbol];
          delete state.ohlcvData[symbol];
          delete state.heatmapData[symbol];
          delete state.realTimeUpdates[symbol];

          return {
            ...state,
            subscribedSymbols: newSubscriptions,
          };
        });
      },

      // Batch updates
      updateSymbolData: (symbol, { overview, ohlcv, heatmap }) => {
        set((state) => {
          const updatedState = { ...state };

          const now = new Date();

          if (overview) {
            const parsedData = MarketOverviewSchema.parse(overview);
            updatedState.marketOverview = {
              ...updatedState.marketOverview,
              [symbol]: parsedData,
            };
            updatedState.lastUpdated[`overview:${symbol}`] = now;
          }

          if (ohlcv) {
            updatedState.ohlcvData = {
              ...updatedState.ohlcvData,
              [symbol]: {
                ...updatedState.ohlcvData[symbol],
                ...ohlcv,
              },
            };
            Object.keys(ohlcv).forEach((timeframe) => {
              updatedState.lastUpdated[`ohlcv:${symbol}:${timeframe}`] = now;
            });
          }

          if (heatmap) {
            updatedState.heatmapData = {
              ...updatedState.heatmapData,
              [symbol]: {
                ...updatedState.heatmapData[symbol],
                ...heatmap,
              },
            };
            Object.keys(heatmap).forEach((window) => {
              updatedState.lastUpdated[`heatmap:${symbol}:${window}`] = now;
            });
          }

          return updatedState;
        });
      },

      // Cache management
      clearCache: () => {
        set({
          marketOverview: {},
          ohlcvData: {},
          heatmapData: {},
          realTimeUpdates: {},
          loading: {},
          errors: {},
          lastUpdated: {},
          subscribedSymbols: new Set(),
        });
      },

      clearSymbolCache: (symbol) => {
        set((state) => {
          const { [symbol]: removedOverview, ...restOverview } = state.marketOverview;
          const { [symbol]: removedOHLCV, ...restOHLCV } = state.ohlcvData;
          const { [symbol]: removedHeatmap, ...restHeatmap } = state.heatmapData;
          const { [symbol]: removedUpdates, ...restUpdates } = state.realTimeUpdates;

          return {
            ...state,
            marketOverview: restOverview,
            ohlcvData: restOHLCV,
            heatmapData: restHeatmap,
            realTimeUpdates: restUpdates,
          };
        });
      },
    }),
    {
      name: 'market-store',
    }
  )
);
