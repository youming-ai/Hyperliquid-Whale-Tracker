import { describe, expect, it } from 'vitest';
import type { HyperliquidAssetPosition } from './hyperliquid';
import { assetPositionToTraderPositionRow } from './hyperliquid';

describe('assetPositionToTraderPositionRow', () => {
  it('maps a long Hyperliquid position into a trader position row', () => {
    const position: HyperliquidAssetPosition = {
      type: 'oneWay',
      position: {
        coin: 'BTC',
        szi: '0.25',
        entryPx: '60000',
        positionValue: '15000',
        unrealizedPnl: '250',
        marginUsed: '3000',
        liquidationPx: '48000',
        returnOnEquity: '0.0833',
        leverage: { type: 'cross', value: 5 },
      },
    };

    const row = assetPositionToTraderPositionRow(
      position,
      'trader-1',
      '0x1111111111111111111111111111111111111111',
      '61000',
    );

    expect(row).toMatchObject({
      traderId: 'trader-1',
      traderAddress: '0x1111111111111111111111111111111111111111',
      symbol: 'BTC',
      side: 'long',
      quantity: '0.25',
      entryPrice: '60000',
      markPrice: '61000',
      positionValueUsd: '15000',
      unrealizedPnl: '250',
      marginUsed: '3000',
      leverage: '5',
      liquidationPrice: '48000',
    });
  });

  it('maps a short position with absolute quantity', () => {
    const position: HyperliquidAssetPosition = {
      type: 'oneWay',
      position: {
        coin: 'ETH',
        szi: '-2.5',
        entryPx: '3000',
        positionValue: '7500',
        unrealizedPnl: '-100',
        marginUsed: '1500',
        liquidationPx: null,
        returnOnEquity: '-0.0666',
        leverage: { type: 'cross', value: 5 },
      },
    };

    const row = assetPositionToTraderPositionRow(
      position,
      'trader-1',
      '0x1111111111111111111111111111111111111111',
      '2950',
    );

    expect(row.side).toBe('short');
    expect(row.quantity).toBe('2.5');
    expect(row.liquidationPrice).toBeNull();
  });

  it('preserves high-precision short quantity', () => {
    const position: HyperliquidAssetPosition = {
      type: 'oneWay',
      position: {
        coin: 'ETH',
        szi: '-2.500000000000000001',
        entryPx: '3000',
        positionValue: '7500',
        unrealizedPnl: '-100',
        marginUsed: '1500',
        liquidationPx: null,
        returnOnEquity: '-0.0666',
        leverage: { type: 'cross', value: 5 },
      },
    };

    const row = assetPositionToTraderPositionRow(
      position,
      'trader-1',
      '0x1111111111111111111111111111111111111111',
      '2950',
    );

    expect(row.side).toBe('short');
    expect(row.quantity).toBe('2.500000000000000001');
  });
});
