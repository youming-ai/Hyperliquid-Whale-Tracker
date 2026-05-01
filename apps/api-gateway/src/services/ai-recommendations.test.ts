import { describe, expect, it } from 'vitest';
import { buildRecommendationPrompt, parseAiResponse } from './ai-recommendations';

describe('ai-recommendations', () => {
  describe('buildRecommendationPrompt', () => {
    it('builds a prompt with trader data and constraints', () => {
      const prompt = buildRecommendationPrompt({
        traders: [
          {
            traderId: 'trader-1',
            address: '0x1234',
            pnl7d: 5000,
            pnl30d: 15000,
            winrate: 65,
            totalTrades: 100,
            equityUsd: 100000,
            maxDrawdown: 10,
            sharpeRatio: 1.5,
            isActive: true,
          },
        ],
        positions: [
          {
            traderId: 'trader-1',
            symbol: 'BTC',
            side: 'long',
            quantity: 0.5,
            positionValueUsd: 25000,
            unrealizedPnl: 500,
          },
        ],
        currentStrategy: null,
        constraints: {
          maxLeverage: 5,
          maxPositionUsd: 10000,
          riskTolerance: 'moderate',
        },
      });

      expect(prompt).toContain('trader-1');
      expect(prompt).toContain('BTC');
      expect(prompt).toContain('5000');
      expect(prompt).toContain('moderate');
    });
  });

  describe('parseAiResponse', () => {
    it('parses a valid AI response', () => {
      const response = JSON.stringify({
        traders: [
          {
            traderId: 'trader-1',
            reason: 'Strong PnL and winrate',
            confidence: 0.85,
            suggestedWeight: 0.5,
          },
        ],
        overallReasoning: 'Diversified portfolio with strong performer',
        riskAssessment: 'Moderate risk with good upside',
      });

      const result = parseAiResponse(response);

      expect(result.traders).toHaveLength(1);
      expect(result.traders[0].traderId).toBe('trader-1');
      expect(result.traders[0].confidence).toBe(0.85);
    });

    it('throws on invalid JSON', () => {
      expect(() => parseAiResponse('invalid')).toThrow();
    });

    it('throws on missing required fields', () => {
      const response = JSON.stringify({ traders: [] });
      expect(() => parseAiResponse(response)).toThrow();
    });
  });
});
