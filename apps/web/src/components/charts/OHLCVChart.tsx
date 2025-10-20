'use client';

import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatTimestamp } from '@/lib/format';

interface OHLCVData {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  tradeCount?: number;
}

interface OHLCVChartProps {
  data: OHLCVData[];
  height?: number;
  showVolume?: boolean;
  showTrades?: boolean;
  timeframes?: string[];
  selectedTimeframe?: string;
  onTimeframeChange?: (timeframe: string) => void;
}

export function OHLCVChart({
  data,
  height = 400,
  showVolume = true,
  showTrades = false,
  timeframes = ['1m', '5m', '15m', '1h', '4h', '1d'],
  selectedTimeframe = '1h',
  onTimeframeChange
}: OHLCVChartProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hoveredPoint, setHoveredPoint] = useState<any>(null);
  const [tooltip, setTooltip] = useState<any>(null);
  const [candleColors, setCandleColors] = useState<{
    green: string;
    red: string;
    volumeGreen: string;
    volumeRed: string;
    grid: string;
    text: string;
  }>({
    green: '#10b981',
    red: '#ef4444',
    volumeGreen: '#065f46',
    volumeRed: '#991b1b',
    grid: '#e5e7eb',
    text: '#6b7280',
  });

  // Simple candlestick chart implementation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || data.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    // Clear canvas
    ctx.clearRect(0, 0, width, height);

    if (data.length === 0) return;

    // Calculate price range
    const prices = data.flatMap(d => [d.low, d.high]);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const priceRange = maxPrice - minPrice;

    // Calculate volume range
    const volumes = data.map(d => d.volume);
    const maxVolume = Math.max(...volumes);

    // Chart dimensions
    const padding = { top: 20, right: 60, bottom: 40, left: 60 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    const volumeHeight = showVolume ? chartHeight * 0.2 : 0;
    const priceChartHeight = chartHeight - volumeHeight;

    // Candle width
    const candleWidth = Math.max(2, Math.min(chartWidth / data.length * 0.8, 20));
    const candleSpacing = chartWidth / data.length;

    // Draw grid lines
    ctx.strokeStyle = candleColors.grid;
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);

    // Horizontal grid lines
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + (priceChartHeight / 5) * i;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();

      // Price labels
      const price = maxPrice - (priceRange / 5) * i;
      ctx.fillStyle = candleColors.text;
      ctx.font = '11px monospace';
      ctx.textAlign = 'right';
      ctx.fillText(price.toFixed(2), padding.left - 5, y + 3);
    }

    // Vertical grid lines
    const step = Math.ceil(data.length / 6);
    for (let i = 0; i < data.length; i += step) {
      const x = padding.left + candleSpacing * i + candleSpacing / 2;
      ctx.beginPath();
      ctx.moveTo(x, padding.top);
      ctx.lineTo(x, padding.top + priceChartHeight);
      ctx.stroke();
    }

    ctx.setLineDash([]);

    // Draw candles
    data.forEach((candle, index) => {
      const x = padding.left + candleSpacing * index + candleSpacing / 2;
      const candleHeight = (Math.abs(candle.high - candle.low) / priceRange) * priceChartHeight;

      const highY = padding.top + ((maxPrice - candle.high) / priceRange) * priceChartHeight;
      const lowY = highY + candleHeight;

      const isGreen = candle.close >= candle.open;
      const color = isGreen ? candleColors.green : candleColors.red;
      const volumeColor = isGreen ? candleColors.volumeGreen : candleColors.volumeRed;

      // Draw candle body
      const bodyTop = padding.top + ((maxPrice - Math.max(candle.open, candle.close)) / priceRange) * priceChartHeight;
      const bodyBottom = padding.top + ((maxPrice - Math.min(candle.open, candle.close)) / priceRange) * priceChartHeight;
      const bodyHeight = Math.abs(bodyBottom - bodyTop);

      ctx.fillStyle = color;
      ctx.fillRect(x - candleWidth / 2, bodyTop, candleWidth, bodyHeight || 1);

      // Draw wicks
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x, highY);
      ctx.lineTo(x, bodyTop);
      ctx.moveTo(x, bodyBottom);
      ctx.lineTo(x, lowY);
      ctx.stroke();

      // Draw volume
      if (showVolume && volumeHeight > 0) {
        const volumeBarHeight = (candle.volume / maxVolume) * volumeHeight;
        const volumeY = height - padding.bottom - volumeBarHeight;

        ctx.fillStyle = volumeColor;
        ctx.fillRect(x - candleWidth / 2, volumeY, candleWidth, volumeBarHeight);
      }
    });

    // Mouse interaction
    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Find which candle is hovered
      const index = Math.floor((x - padding.left) / candleSpacing);
      if (index >= 0 && index < data.length) {
        const candle = data[index];
        setHoveredPoint({ x: padding.left + candleSpacing * index + candleSpacing / 2, y, candle, index });

        setTooltip({
          x: e.clientX,
          y: e.clientY,
          data: {
            timestamp: candle.timestamp,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume,
            tradeCount: candle.tradeCount,
            change: candle.close - candle.open,
            changePercent: ((candle.close - candle.open) / candle.open) * 100,
          }
        });
      } else {
        setHoveredPoint(null);
        setTooltip(null);
      }
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', () => {
      setHoveredPoint(null);
      setTooltip(null);
    });

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', () => {
        setHoveredPoint(null);
        setTooltip(null);
      });
    };
  }, [data, height, showVolume, showTrades, candleColors]);

  const formatCandleData = (candle: OHLCVData) => {
    const change = candle.close - candle.open;
    const changePercent = (change / candle.open) * 100;
    const isPositive = change >= 0;

    return {
      open: formatCurrency(candle.open),
      high: formatCurrency(candle.high),
      low: formatCurrency(candle.low),
      close: formatCurrency(candle.close),
      volume: formatCurrency(candle.volume),
      change: `${isPositive ? '+' : ''}${formatCurrency(change)}`,
      changePercent: `${isPositive ? '+' : ''}${changePercent.toFixed(2)}%`,
      isPositive,
    };
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Price Chart</CardTitle>
          {onTimeframeChange && timeframes && (
            <div className="flex gap-1">
              {timeframes.map((tf) => (
                <button
                  key={tf}
                  onClick={() => onTimeframeChange(tf)}
                  className={`px-3 py-1 text-sm rounded-md transition-colors ${
                    selectedTimeframe === tf
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  {tf}
                </button>
              ))}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative">
          <canvas
            ref={canvasRef}
            className="w-full cursor-crosshair"
            style={{ height: `${height}px` }}
          />

          {tooltip && (
            <div
              className="absolute z-10 bg-black bg-opacity-90 text-white p-2 rounded-lg text-xs pointer-events-none"
              style={{
                left: `${tooltip.x + 10}px`,
                top: `${tooltip.y - 10}px`,
                transform: 'translateY(-100%)'
              }}
            >
              <div className="font-mono mb-1">
                {formatTimestamp(tooltip.data.timestamp)}
              </div>
              <div className="space-y-1">
                <div>O: {formatCandleData(tooltip.data).open}</div>
                <div>H: {formatCandleData(tooltip.data).high}</div>
                <div>L: {formatCandleData(tooltip.data).low}</div>
                <div>C: {formatCandleData(tooltip.data).close}</div>
                <div className={`font-bold ${tooltip.data.isPositive ? 'text-green-400' : 'text-red-400'}`}>
                  {tooltip.data.change} ({tooltip.data.changePercent})
                </div>
                <div>Vol: {tooltip.data.volume}</div>
                {showTrades && tooltip.data.tradeCount && (
                  <div>Trades: {tooltip.data.tradeCount}</div>
                )}
              </div>
            </div>
          )}
        </div>

        {showVolume && (
          <div className="flex items-center justify-between px-6 pb-2 text-xs text-gray-600">
            <span>Volume</span>
            <span>{formatCurrency(Math.max(...data.map(d => d.volume)))}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
