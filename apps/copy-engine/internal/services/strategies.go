package services

import (
	"context"
	"math"

	"github.com/hyperdash/copy-engine/internal/models"
	"github.com/sirupsen/logrus"
)

// ProportionalStrategy implements proportional position sizing
type ProportionalStrategy struct {
	log *logrus.Logger
}

func NewProportionalStrategy(log *logrus.Logger) *ProportionalStrategy {
	return &ProportionalStrategy{log: log}
}

func (s *ProportionalStrategy) CalculatePositionSize(ctx context.Context, signal *models.CopySignal, originalTrade *models.Trade) (float64, error) {
	// Calculate size based on allocation percentage
	allocationPercent := signal.Relationship.AllocationPercent / 100.0
	calculatedSize := originalTrade.Size * allocationPercent

	// Apply min/max constraints
	if calculatedSize < signal.Relationship.MinAllocation {
		calculatedSize = signal.Relationship.MinAllocation
		s.log.Debugf("Applied minimum allocation constraint for relationship %s: %.2f",
			signal.Relationship.ID, calculatedSize)
	}

	if signal.Relationship.MaxAllocation > 0 && calculatedSize > signal.Relationship.MaxAllocation {
		calculatedSize = signal.Relationship.MaxAllocation
		s.log.Debugf("Applied maximum allocation constraint for relationship %s: %.2f",
			signal.Relationship.ID, calculatedSize)
	}

	return calculatedSize, nil
}

func (s *ProportionalStrategy) ShouldExecute(ctx context.Context, signal *models.CopySignal, originalTrade *models.Trade) (bool, error) {
	// Proportional strategy executes for all trades by default
	// Additional logic can be added here for risk management
	return true, nil
}

func (s *ProportionalStrategy) GetStrategyType() models.StrategyType {
	return models.StrategyProportional
}

// FixedStrategy implements fixed position sizing
type FixedStrategy struct {
	log *logrus.Logger
}

func NewFixedStrategy(log *logrus.Logger) *FixedStrategy {
	return &FixedStrategy{log: log}
}

func (s *FixedStrategy) CalculatePositionSize(ctx context.Context, signal *models.CopySignal, originalTrade *models.Trade) (float64, error) {
	// Use fixed size from relationship max allocation as base
	fixedSize := signal.Relationship.MaxAllocation
	if fixedSize == 0 {
		// If no max allocation set, use a default based on allocation percentage
		fixedSize = originalTrade.Size * (signal.Relationship.AllocationPercent / 100.0)
	}

	// Ensure it doesn't exceed minimum
	if fixedSize < signal.Relationship.MinAllocation {
		fixedSize = signal.Relationship.MinAllocation
	}

	s.log.Debugf("Using fixed position size %.2f for relationship %s", fixedSize, signal.Relationship.ID)
	return fixedSize, nil
}

func (s *FixedStrategy) ShouldExecute(ctx context.Context, signal *models.CopySignal, originalTrade *models.Trade) (bool, error) {
	// Fixed strategy executes only for positions above minimum threshold
	return originalTrade.Size >= signal.Relationship.MinAllocation, nil
}

func (s *FixedStrategy) GetStrategyType() models.StrategyType {
	return models.StrategyFixed
}

// AdaptiveStrategy implements adaptive position sizing based on performance
type AdaptiveStrategy struct {
	log *logrus.Logger
}

func NewAdaptiveStrategy(log *logrus.Logger) *AdaptiveStrategy {
	return &AdaptiveStrategy{log: log}
}

func (s *AdaptiveStrategy) CalculatePositionSize(ctx context.Context, signal *models.CopySignal, originalTrade *models.Trade) (float64, error) {
	// Get performance metrics to adjust size
	// This would typically fetch from a metrics service
	baseSize := originalTrade.Size * (signal.Relationship.AllocationPercent / 100.0)

	// Adaptive multiplier based on win rate (placeholder logic)
	// In practice, this would fetch actual performance metrics
	adaptiveMultiplier := 1.0
	winRate := 0.5 // Placeholder - would fetch actual metrics

	if winRate > 0.7 {
		// High win rate, increase size by 20%
		adaptiveMultiplier = 1.2
	} else if winRate < 0.3 {
		// Low win rate, decrease size by 30%
		adaptiveMultiplier = 0.7
	}

	calculatedSize := baseSize * adaptiveMultiplier

	// Apply constraints
	if calculatedSize < signal.Relationship.MinAllocation {
		calculatedSize = signal.Relationship.MinAllocation
	}

	if signal.Relationship.MaxAllocation > 0 && calculatedSize > signal.Relationship.MaxAllocation {
		calculatedSize = signal.Relationship.MaxAllocation
	}

	s.log.Debugf("Adaptive strategy calculated size %.2f (multiplier: %.2f) for relationship %s",
		calculatedSize, adaptiveMultiplier, signal.Relationship.ID)

	return calculatedSize, nil
}

func (s *AdaptiveStrategy) ShouldExecute(ctx context.Context, signal *models.CopySignal, originalTrade *models.Trade) (bool, error) {
	// Adaptive strategy can include more complex logic
	// For example, only execute if certain market conditions are met
	// or if performance metrics meet criteria

	// Placeholder logic: execute if trade size is reasonable
	return originalTrade.Size >= signal.Relationship.MinAllocation, nil
}

func (s *AdaptiveStrategy) GetStrategyType() models.StrategyType {
	return models.StrategyAdaptive
}

// RiskBasedStrategy implements risk-adjusted position sizing
type RiskBasedStrategy struct {
	log *logrus.Logger
}

func NewRiskBasedStrategy(log *logrus.Logger) *RiskBasedStrategy {
	return &RiskBasedStrategy{log: log}
}

func (s *RiskBasedStrategy) CalculatePositionSize(ctx context.Context, signal *models.CopySignal, originalTrade *models.Trade) (float64, error) {
	// Calculate size based on risk metrics
	baseSize := originalTrade.Size * (signal.Relationship.AllocationPercent / 100.0)

	// Risk adjustments (placeholder values)
	volatilityAdjustment := 0.8    // Reduce size for high volatility
	concentrationAdjustment := 1.0 // Adjust for concentration risk
	leverageAdjustment := 1.0      // Adjust for leverage

	// Apply risk adjustments
	riskAdjustedSize := baseSize * volatilityAdjustment * concentrationAdjustment * leverageAdjustment

	// Apply stop loss consideration
	if signal.Relationship.StopLossPercent != nil {
		// Reduce size if stop loss is tight to maintain risk/reward ratio
		stopLossAdjustment := math.Min(1.0, *signal.Relationship.StopLossPercent/2.0)
		riskAdjustedSize *= stopLossAdjustment
	}

	// Apply constraints
	if riskAdjustedSize < signal.Relationship.MinAllocation {
		riskAdjustedSize = signal.Relationship.MinAllocation
	}

	if signal.Relationship.MaxAllocation > 0 && riskAdjustedSize > signal.Relationship.MaxAllocation {
		riskAdjustedSize = signal.Relationship.MaxAllocation
	}

	s.log.Debugf("Risk-based strategy calculated size %.2f for relationship %s",
		riskAdjustedSize, signal.Relationship.ID)

	return riskAdjustedSize, nil
}

func (s *RiskBasedStrategy) ShouldExecute(ctx context.Context, signal *models.CopySignal, originalTrade *models.Trade) (bool, error) {
	// Risk-based strategy includes risk checks
	// For example, don't execute if risk metrics are too high

	// Placeholder risk checks
	maxRiskPerTrade := 0.02                                      // 2% risk per trade
	tradeRisk := originalTrade.Size * originalTrade.Price * 0.01 // Assume 1% price risk

	if tradeRisk > maxRiskPerTrade*originalTrade.Size*originalTrade.Price {
		s.log.Debugf("Skipping trade due to high risk: %.4f > %.4f", tradeRisk, maxRiskPerTrade*originalTrade.Size*originalTrade.Price)
		return false, nil
	}

	return true, nil
}

func (s *RiskBasedStrategy) GetStrategyType() models.StrategyType {
	return "risk_based"
}

// MartingaleStrategy implements martingale-style position sizing
type MartingaleStrategy struct {
	log *logrus.Logger
}

func NewMartingaleStrategy(log *logrus.Logger) *MartingaleStrategy {
	return &MartingaleStrategy{log: log}
}

func (s *MartingaleStrategy) CalculatePositionSize(ctx context.Context, signal *models.CopySignal, originalTrade *models.Trade) (float64, error) {
	// Martingale strategy increases size after losses
	baseSize := originalTrade.Size * (signal.Relationship.AllocationPercent / 100.0)

	// Get recent performance to determine multiplier
	// This would fetch actual trading history
	consecutiveLosses := 0 // Placeholder - would fetch actual data

	multiplier := math.Pow(2, float64(consecutiveLosses))
	calculatedSize := baseSize * multiplier

	// Apply maximum constraints to prevent unlimited growth
	maxMultiplier := 4.0 // Maximum 4x base size
	if multiplier > maxMultiplier {
		calculatedSize = baseSize * maxMultiplier
		s.log.Debugf("Applied maximum martingale multiplier for relationship %s", signal.Relationship.ID)
	}

	// Apply hard limits
	if calculatedSize < signal.Relationship.MinAllocation {
		calculatedSize = signal.Relationship.MinAllocation
	}

	if signal.Relationship.MaxAllocation > 0 && calculatedSize > signal.Relationship.MaxAllocation {
		calculatedSize = signal.Relationship.MaxAllocation
	}

	s.log.Debugf("Martingale strategy calculated size %.2f (multiplier: %.2f) for relationship %s",
		calculatedSize, multiplier, signal.Relationship.ID)

	return calculatedSize, nil
}

func (s *MartingaleStrategy) ShouldExecute(ctx context.Context, signal *models.CopySignal, originalTrade *models.Trade) (bool, error) {
	// Martingale strategy can include logic to pause after too many losses
	maxConsecutiveLosses := 5 // Safety limit

	// Get actual consecutive losses (placeholder)
	consecutiveLosses := 0

	if consecutiveLosses >= maxConsecutiveLosses {
		s.log.Warnf("Martingale strategy paused due to max consecutive losses for relationship %s",
			signal.Relationship.ID)
		return false, nil
	}

	return true, nil
}

func (s *MartingaleStrategy) GetStrategyType() models.StrategyType {
	return "martingale"
}

// AntiMartingaleStrategy implements anti-martingale position sizing
type AntiMartingaleStrategy struct {
	log *logrus.Logger
}

func NewAntiMartingaleStrategy(log *logrus.Logger) *AntiMartingaleStrategy {
	return &AntiMartingaleStrategy{log: log}
}

func (s *AntiMartingaleStrategy) CalculatePositionSize(ctx context.Context, signal *models.CopySignal, originalTrade *models.Trade) (float64, error) {
	// Anti-martingale strategy increases size after wins
	baseSize := originalTrade.Size * (signal.Relationship.AllocationPercent / 100.0)

	// Get recent performance
	consecutiveWins := 0 // Placeholder - would fetch actual data

	multiplier := math.Pow(1.5, float64(consecutiveWins)) // Increase by 50% per win
	calculatedSize := baseSize * multiplier

	// Apply maximum constraints
	maxMultiplier := 3.0 // Maximum 3x base size
	if multiplier > maxMultiplier {
		calculatedSize = baseSize * maxMultiplier
	}

	// Reduce size after losses
	if consecutiveWins == 0 {
		calculatedSize = baseSize * 0.8 // Reduce by 20% after loss
	}

	// Apply hard limits
	if calculatedSize < signal.Relationship.MinAllocation {
		calculatedSize = signal.Relationship.MinAllocation
	}

	if signal.Relationship.MaxAllocation > 0 && calculatedSize > signal.Relationship.MaxAllocation {
		calculatedSize = signal.Relationship.MaxAllocation
	}

	s.log.Debugf("Anti-martingale strategy calculated size %.2f (multiplier: %.2f) for relationship %s",
		calculatedSize, multiplier, signal.Relationship.ID)

	return calculatedSize, nil
}

func (s *AntiMartingaleStrategy) ShouldExecute(ctx context.Context, signal *models.CopySignal, originalTrade *models.Trade) (bool, error) {
	// Anti-martingale strategy generally always executes
	// But can include conditions based on market state or performance
	return true, nil
}

func (s *AntiMartingaleStrategy) GetStrategyType() models.StrategyType {
	return "anti_martingale"
}
