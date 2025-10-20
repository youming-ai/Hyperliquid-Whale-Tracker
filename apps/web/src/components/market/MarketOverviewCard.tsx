'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatNumber, formatPercentage } from '@/lib/format';
import { ArrowUpIcon, ArrowDownIcon, MinusIcon } from 'lucide-react';

interface MarketOverviewCardProps {
  symbol: string;
  data: {
    price: number;
    markPrice: number;
    indexPrice: number;
    fundingRate: number;
    nextFundingTime: string;
    openInterest: number;
    volume24h: number;
    longShortRatio: number;
    volatility24h: number;
  };
  isLive?: boolean;
  className?: string;
}

export function MarketOverviewCard({
  symbol,
  data,
  isLive = false,
  className
}: MarketOverviewCardProps) {
  const [prevPrice, setPrevPrice] = useState(data.price);
  const [priceChange, setPriceChange] = useState(0);
  const [priceChangePercent, setPriceChangePercent] = useState(0);

  useEffect(() => {
    if (prevPrice !== data.price && prevPrice !== 0) {
      const change = data.price - prevPrice;
      const changePercent = (change / prevPrice) * 100;
      setPriceChange(change);
      setPriceChangePercent(changePercent);
      setPrevPrice(data.price);
    }
  }, [data.price, prevPrice]);

  const ChangeIcon = priceChange > 0 ? ArrowUpIcon :
                   priceChange < 0 ? ArrowDownIcon : MinusIcon;

  const changeColor = priceChange > 0 ? 'text-green-600' :
                     priceChange < 0 ? 'text-red-600' : 'text-gray-600';

  const changeBgColor = priceChange > 0 ? 'bg-green-50 text-green-700' :
                      priceChange < 0 ? 'bg-red-50 text-red-700' : 'bg-gray-50 text-gray-700';

  const formatPrice = (price: number) => {
    if (symbol.startsWith('BTC')) {
      return `$${price.toLocaleString(undefined, {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      })}`;
    }
    return formatCurrency(price);
  };

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center space-x-2">
          <CardTitle className="text-xl font-bold">
            {symbol}
          </CardTitle>
          {isLive && (
            <Badge variant="outline" className="animate-pulse">
              Live
            </Badge>
          )}
        </div>
        <div className={cn('flex items-center space-x-2 px-3 py-1 rounded-md', changeBgColor)}>
          <ChangeIcon className={cn('h-4 w-4', changeColor)} />
          <span className={cn('font-medium', changeColor)}>
            {formatCurrency(Math.abs(priceChange))}
          </span>
          <span className={cn('font-medium', changeColor)}>
            ({priceChangePercent >= 0 ? '+' : ''}{formatPercentage(priceChangePercent)})
          </span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {/* Current Price */}
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-600">Current Price</p>
            <p className="text-2xl font-bold">
              {formatPrice(data.price)}
            </p>
          </div>

          {/* Mark Price */}
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-600">Mark Price</p>
            <p className="text-lg font-semibold">
              {formatPrice(data.markPrice)}
            </p>
            <p className="text-xs text-gray-500">
              Diff: {formatCurrency(data.markPrice - data.price)}
            </p>
          </div>

          {/* Index Price */}
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-600">Index Price</p>
            <p className="text-lg font-semibold">
              {formatPrice(data.indexPrice)}
            </p>
          </div>

          {/* 24h Volume */}
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-600">24h Volume</p>
            <p className="text-lg font-semibold">
              {formatCurrency(data.volume24h)}
            </p>
          </div>

          {/* Funding Rate */}
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-600">Funding Rate</p>
            <p className="text-lg font-semibold">
              {formatPercentage(data.fundingRate * 100)}
              <span className="text-sm text-gray-500 ml-1">
                ({data.fundingRate >= 0 ? 'Longs pay Shorts' : 'Shorts pay Longs'})
              </span>
            </p>
            <p className="text-xs text-gray-500">
              Next: {new Date(data.nextFundingTime).toLocaleString()}
            </p>
          </div>

          {/* Open Interest */}
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-600">Open Interest</p>
            <p className="text-lg font-semibold">
              {formatCurrency(data.openInterest)}
            </p>
          </div>

          {/* Long/Short Ratio */}
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-600">L/S Ratio</p>
            <p className="text-lg font-semibold">
              {formatPercentage(data.longShortRatio * 100)}
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${data.longShortRatio * 100}%` }}
              />
            </div>
          </div>

          {/* 24h Volatility */}
          <div className="space-y-1">
            <p className="text-sm font-medium text-gray-600">24h Volatility</p>
            <p className="text-lg font-semibold">
              {formatPercentage(data.volatility24h * 100)}
            </p>
            <div className="flex items-center space-x-2 mt-1">
              <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="bg-orange-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${Math.min(data.volatility24h * 500, 100)}%` }}
                />
              </div>
              <span className="text-xs text-gray-500">
                {formatPercentage(data.volatility24h * 100)}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
