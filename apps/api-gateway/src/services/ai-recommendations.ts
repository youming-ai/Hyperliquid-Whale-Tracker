import OpenAI from 'openai';

export interface TraderData {
  traderId: string;
  address: string;
  pnl7d: number;
  pnl30d: number;
  winrate: number;
  totalTrades: number;
  equityUsd: number;
  maxDrawdown: number;
  sharpeRatio: number;
  isActive: boolean;
}

export interface PositionData {
  traderId: string;
  symbol: string;
  side: string;
  quantity: number;
  positionValueUsd: number;
  unrealizedPnl: number;
}

export interface UserConstraints {
  maxLeverage: number;
  maxPositionUsd: number;
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
}

export interface RecommendationInput {
  traders: TraderData[];
  positions: PositionData[];
  currentStrategy: Record<string, unknown> | null;
  constraints: UserConstraints;
}

export interface TraderRecommendation {
  traderId: string;
  reason: string;
  confidence: number;
  suggestedWeight: number;
}

export interface AiRecommendationOutput {
  traders: TraderRecommendation[];
  overallReasoning: string;
  riskAssessment: string;
}

export function buildRecommendationPrompt(input: RecommendationInput): string {
  const traderSummaries = input.traders
    .map(
      (t) =>
        `- ${t.traderId} (${t.address}): PnL 7d=$${t.pnl7d}, 30d=$${t.pnl30d}, WinRate=${t.winrate}%, Trades=${t.totalTrades}, Equity=$${t.equityUsd}, MaxDD=${t.maxDrawdown}%, Sharpe=${t.sharpeRatio}, Active=${t.isActive}`,
    )
    .join('\n');

  const positionSummaries = input.positions
    .map(
      (p) =>
        `- ${p.traderId}: ${p.side} ${p.quantity} ${p.symbol} ($${p.positionValueUsd}, PnL=$${p.unrealizedPnl})`,
    )
    .join('\n');

  const strategyInfo = input.currentStrategy
    ? `Current strategy: ${JSON.stringify(input.currentStrategy)}`
    : 'No existing strategy.';

  return `You are a Hyperliquid copy trading advisor. Analyze the following trader data and provide recommendations.

## Available Traders
${traderSummaries}

## Current Trader Positions
${positionSummaries || 'No open positions.'}

## ${strategyInfo}

## User Constraints
- Max Leverage: ${input.constraints.maxLeverage}
- Max Position Size: $${input.constraints.maxPositionUsd}
- Risk Tolerance: ${input.constraints.riskTolerance}

Provide recommendations in JSON format:
{
  "traders": [
    {
      "traderId": "uuid",
      "reason": "Why this trader is recommended",
      "confidence": 0.85,
      "suggestedWeight": 0.3
    }
  ],
  "overallReasoning": "Overall strategy explanation",
  "riskAssessment": "Risk analysis of the recommendation"
}`;
}

export function parseAiResponse(response: string): AiRecommendationOutput {
  const parsed = JSON.parse(response);

  if (!parsed.traders || !Array.isArray(parsed.traders)) {
    throw new Error('Invalid response: missing traders array');
  }

  if (!parsed.overallReasoning || typeof parsed.overallReasoning !== 'string') {
    throw new Error('Invalid response: missing overallReasoning');
  }

  if (!parsed.riskAssessment || typeof parsed.riskAssessment !== 'string') {
    throw new Error('Invalid response: missing riskAssessment');
  }

  for (const trader of parsed.traders) {
    if (!trader.traderId || typeof trader.traderId !== 'string') {
      throw new Error('Invalid trader: missing traderId');
    }
    if (typeof trader.confidence !== 'number' || trader.confidence < 0 || trader.confidence > 1) {
      throw new Error('Invalid trader: confidence must be 0-1');
    }
    if (
      typeof trader.suggestedWeight !== 'number' ||
      trader.suggestedWeight < 0 ||
      trader.suggestedWeight > 1
    ) {
      throw new Error('Invalid trader: suggestedWeight must be 0-1');
    }
  }

  return parsed as AiRecommendationOutput;
}

export async function getAiRecommendations(
  input: RecommendationInput,
): Promise<AiRecommendationOutput> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY not configured');
  }

  const openai = new OpenAI({ apiKey });
  const prompt = buildRecommendationPrompt(input);

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    response_format: { type: 'json_object' },
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from OpenAI');
  }

  return parseAiResponse(content);
}
