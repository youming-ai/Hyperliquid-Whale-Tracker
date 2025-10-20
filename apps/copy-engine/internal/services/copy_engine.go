package services

import (
	"context"
	"fmt"
	"math"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/hyperdash/copy-engine/internal/database"
	"github.com/hyperdash/copy-engine/internal/models"
	"github.com/sirupsen/logrus"
)

// CopyEngine interface
type CopyEngine interface {
	Start(ctx context.Context) error
	Stop() error
	ProcessTraderTrade(ctx context.Context, trade *models.Trade) error
	GetRelationshipsForTrader(ctx context.Context, traderID string) ([]*models.CopyRelationship, error)
	GetRelationshipsForFollower(ctx context.Context, followerID string) ([]*models.CopyRelationship, error)
	GetPerformanceMetrics(ctx context.Context, relationshipID string) (*models.PerformanceMetrics, error)
	GetRiskMetrics(ctx context.Context, relationshipID string) (*models.RiskMetrics, error)
}

type copyEngine struct {
	postgres   database.PostgreSQL
	redis      database.Redis
	log        *logrus.Logger
	strategies map[models.StrategyType]CopyStrategy

	// Event channels
	tradeChan chan *models.Trade

	// Control
	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup

	// State
	running bool
	mu      sync.RWMutex
}

// CopyStrategy interface for different copy strategies
type CopyStrategy interface {
	CalculatePositionSize(ctx context.Context, signal *models.CopySignal, originalTrade *models.Trade) (float64, error)
	ShouldExecute(ctx context.Context, signal *models.CopySignal, originalTrade *models.Trade) (bool, error)
	GetStrategyType() models.StrategyType
}

// NewCopyEngine creates a new copy engine instance
func NewCopyEngine(postgres database.PostgreSQL, redis database.Redis, log *logrus.Logger) CopyEngine {
	strategies := make(map[models.StrategyType]CopyStrategy)

	// Register built-in strategies
	strategies[models.StrategyProportional] = NewProportionalStrategy(log)
	strategies[models.StrategyFixed] = NewFixedStrategy(log)
	strategies[models.StrategyAdaptive] = NewAdaptiveStrategy(log)

	return &copyEngine{
		postgres:   postgres,
		redis:      redis,
		log:        log,
		strategies: strategies,
		tradeChan:  make(chan *models.Trade, 1000),
	}
}

func (ce *copyEngine) Start(ctx context.Context) error {
	ce.mu.Lock()
	defer ce.mu.Unlock()

	if ce.running {
		return fmt.Errorf("copy engine is already running")
	}

	ce.ctx, ce.cancel = context.WithCancel(ctx)

	// Start trade processor
	ce.wg.Add(1)
	go ce.tradeProcessor()

	// Start metrics calculator
	ce.wg.Add(1)
	go ce.metricsCalculator()

	ce.running = true
	ce.log.Info("Copy engine started")

	return nil
}

func (ce *copyEngine) Stop() error {
	ce.mu.Lock()
	defer ce.mu.Unlock()

	if !ce.running {
		return nil
	}

	ce.cancel()
	close(ce.tradeChan)

	// Wait for all goroutines to finish
	done := make(chan struct{})
	go func() {
		ce.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		ce.log.Info("Copy engine stopped gracefully")
	case <-time.After(30 * time.Second):
		ce.log.Warn("Copy engine stop timed out")
	}

	ce.running = false
	return nil
}

func (ce *copyEngine) ProcessTraderTrade(ctx context.Context, trade *models.Trade) error {
	if !ce.running {
		return fmt.Errorf("copy engine is not running")
	}

	select {
	case ce.tradeChan <- trade:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	case <-time.After(5 * time.Second):
		return fmt.Errorf("trade channel timeout")
	}
}

func (ce *copyEngine) GetRelationshipsForTrader(ctx context.Context, traderID string) ([]*models.CopyRelationship, error) {
	return ce.postgres.GetCopyRelationshipsByTrader(ctx, traderID)
}

func (ce *copyEngine) GetRelationshipsForFollower(ctx context.Context, followerID string) ([]*models.CopyRelationship, error) {
	return ce.postgres.GetCopyRelationshipsByFollower(ctx, followerID)
}

func (ce *copyEngine) GetPerformanceMetrics(ctx context.Context, relationshipID string) (*models.PerformanceMetrics, error) {
	// Try cache first
	metrics, err := ce.redis.GetPerformanceMetrics(ctx, relationshipID)
	if err == nil {
		return metrics, nil
	}

	// Fallback to database
	metrics, err = ce.postgres.GetPerformanceMetrics(ctx, relationshipID)
	if err != nil {
		return nil, fmt.Errorf("failed to get performance metrics: %w", err)
	}

	// Update cache
	if err := ce.redis.SetPerformanceMetrics(ctx, relationshipID, metrics); err != nil {
		ce.log.Warnf("Failed to cache performance metrics: %v", err)
	}

	return metrics, nil
}

func (ce *copyEngine) GetRiskMetrics(ctx context.Context, relationshipID string) (*models.RiskMetrics, error) {
	// Try cache first
	metrics, err := ce.redis.GetRiskMetrics(ctx, relationshipID)
	if err == nil {
		return metrics, nil
	}

	// Fallback to database
	metrics, err = ce.postgres.GetRiskMetrics(ctx, relationshipID)
	if err != nil {
		return nil, fmt.Errorf("failed to get risk metrics: %w", err)
	}

	// Update cache
	if err := ce.redis.SetRiskMetrics(ctx, relationshipID, metrics); err != nil {
		ce.log.Warnf("Failed to cache risk metrics: %v", err)
	}

	return metrics, nil
}

func (ce *copyEngine) tradeProcessor() {
	defer ce.wg.Done()

	for {
		select {
		case <-ce.ctx.Done():
			return
		case trade, ok := <-ce.tradeChan:
			if !ok {
				return
			}

			if err := ce.processTrade(trade); err != nil {
				ce.log.Errorf("Failed to process trade %s: %v", trade.ID, err)
			}
		}
	}
}

func (ce *copyEngine) processTrade(trade *models.Trade) error {
	ctx, cancel := context.WithTimeout(ce.ctx, 30*time.Second)
	defer cancel()

	if trade.TraderID == nil {
		return fmt.Errorf("trade has no trader ID")
	}

	// Get all active relationships for this trader
	relationships, err := ce.postgres.GetCopyRelationshipsByTrader(ctx, *trade.TraderID)
	if err != nil {
		return fmt.Errorf("failed to get copy relationships: %w", err)
	}

	// Process each relationship concurrently
	var wg sync.WaitGroup
	for _, relationship := range relationships {
		wg.Add(1)
		go func(rel *models.CopyRelationship) {
			defer wg.Done()

			if err := ce.processRelationship(ctx, rel, trade); err != nil {
				ce.log.Errorf("Failed to process relationship %s for trade %s: %v",
					rel.ID, trade.ID, err)
			}
		}(relationship)
	}

	wg.Wait()
	return nil
}

func (ce *copyEngine) processRelationship(ctx context.Context, relationship *models.CopyRelationship, trade *models.Trade) error {
	// Check if we should execute copy for this relationship
	shouldExecute, err := ce.shouldExecuteCopy(ctx, relationship, trade)
	if err != nil {
		return fmt.Errorf("failed to check execution criteria: %w", err)
	}

	if !shouldExecute {
		ce.log.Debugf("Skipping copy execution for relationship %s", relationship.ID)
		return nil
	}

	// Create copy signal
	signal := &models.CopySignal{
		ID:            uuid.New().String(),
		Relationship:  relationship,
		OriginalTrade: trade,
		SignalType:    ce.determineSignalType(trade),
		Parameters:    make(map[string]interface{}),
		CreatedAt:     time.Now(),
	}

	// Get the strategy for this relationship
	strategy, exists := ce.strategies[models.StrategyProportional] // Default to proportional
	if !exists {
		return fmt.Errorf("strategy not found: %s", models.StrategyProportional)
	}

	// Check if strategy says we should execute
	shouldExecute, err = strategy.ShouldExecute(ctx, signal, trade)
	if err != nil {
		return fmt.Errorf("failed to check strategy execution: %w", err)
	}

	if !shouldExecute {
		ce.log.Debugf("Strategy declined execution for relationship %s", relationship.ID)
		return nil
	}

	// Calculate position size
	positionSize, err := strategy.CalculatePositionSize(ctx, signal, trade)
	if err != nil {
		return fmt.Errorf("failed to calculate position size: %w", err)
	}

	// Create copy execution
	execution := &models.CopyExecution{
		ID:           uuid.New().String(),
		SignalID:     signal.ID,
		Relationship: relationship,
		Status:       models.StatusPending,
		Parameters: map[string]interface{}{
			"calculated_size": positionSize,
			"original_size":   trade.Size,
			"allocation_pct":  relationship.AllocationPercent,
		},
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	// Store signal in Redis for monitoring
	if err := ce.redis.SetCopySignal(ctx, signal); err != nil {
		ce.log.Warnf("Failed to store copy signal: %v", err)
	}

	// Execute the copy trade
	if err := ce.executeCopyTrade(ctx, execution, trade, positionSize); err != nil {
		execution.Status = models.StatusFailed
		execution.ErrorMessage = new(string)
		*execution.ErrorMessage = err.Error()
		ce.log.Errorf("Failed to execute copy trade: %v", err)
	} else {
		execution.Status = models.StatusCompleted
		ce.log.Infof("Successfully executed copy trade for relationship %s", relationship.ID)
	}

	// Update execution status
	if err := ce.postgres.CreateCopyExecution(ctx, execution); err != nil {
		ce.log.Errorf("Failed to create copy execution record: %v", err)
	}

	return nil
}

func (ce *copyEngine) shouldExecuteCopy(ctx context.Context, relationship *models.CopyRelationship, trade *models.Trade) (bool, error) {
	// Check basic relationship criteria
	if !relationship.IsActive {
		return false, nil
	}

	// Check allocation limits
	if trade.Size < relationship.MinAllocation {
		return false, nil
	}

	if relationship.MaxAllocation > 0 && trade.Size > relationship.MaxAllocation {
		return false, nil
	}

	// Check risk limits using risk metrics
	riskMetrics, err := ce.GetRiskMetrics(ctx, relationship.ID)
	if err != nil {
		ce.log.Warnf("Failed to get risk metrics for relationship %s: %v", relationship.ID, err)
		// Continue anyway, don't block execution due to metrics failure
	} else {
		// Check if current exposure exceeds limits
		if riskMetrics.CurrentExposure > riskMetrics.MaxExposure {
			ce.log.Warnf("Current exposure (%.2f) exceeds max exposure (%.2f) for relationship %s",
				riskMetrics.CurrentExposure, riskMetrics.MaxExposure, relationship.ID)
			return false, nil
		}
	}

	return true, nil
}

func (ce *copyEngine) determineSignalType(trade *models.Trade) models.SignalType {
	// Simple logic: determine signal type based on trade characteristics
	if trade.PositionID != nil {
		// This is a position modification trade
		return models.SignalModifySize
	}

	// New position based on trade side
	if trade.Side == models.TradeBuy {
		return models.SignalOpenPosition
	}

	return models.SignalClosePosition
}

func (ce *copyEngine) executeCopyTrade(ctx context.Context, execution *models.CopyExecution, originalTrade *models.Trade, copySize float64) error {
	// Update execution status
	execution.Status = models.StatusExecuting
	if err := ce.postgres.UpdateCopyExecution(ctx, execution); err != nil {
		ce.log.Warnf("Failed to update execution status: %v", err)
	}

	// Create the copy trade
	copyTrade := &models.Trade{
		ID:                 uuid.New().String(),
		UserID:             &execution.Relationship.FollowerID,
		TraderID:           originalTrade.TraderID,
		PositionID:         originalTrade.PositionID,
		TokenSymbol:        originalTrade.TokenSymbol,
		Side:               originalTrade.Side,
		Size:               copySize,
		Price:              originalTrade.Price,
		Fee:                originalTrade.Fee * (copySize / originalTrade.Size), // Scale fee proportionally
		RealizedPnL:        0,                                                   // Will be calculated when position is closed
		TransactionHash:    nil,                                                 // Will be set by blockchain integration
		BlockNumber:        nil,                                                 // Will be set by blockchain integration
		CreatedAt:          time.Now(),
		IsCopyTrade:        true,
		CopyRelationshipID: &execution.Relationship.ID,
	}

	// Store the trade in database
	if err := ce.postgres.CreateTrade(ctx, copyTrade); err != nil {
		return fmt.Errorf("failed to create copy trade: %w", err)
	}

	// Update execution with trade reference
	execution.Trade = copyTrade
	execution.UpdatedAt = time.Now()

	return nil
}

func (ce *copyEngine) metricsCalculator() {
	defer ce.wg.Done()

	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-ce.ctx.Done():
			return
		case <-ticker.C:
			ce.calculateMetrics()
		}
	}
}

func (ce *copyEngine) calculateMetrics() {
	ctx, cancel := context.WithTimeout(ce.ctx, 5*time.Minute)
	defer cancel()

	// Get all active relationships
	relationships, err := ce.postgres.GetActiveCopyRelationships(ctx)
	if err != nil {
		ce.log.Errorf("Failed to get active relationships for metrics calculation: %v", err)
		return
	}

	// Calculate metrics for each relationship
	for _, relationship := range relationships {
		if err := ce.calculateRelationshipMetrics(ctx, relationship); err != nil {
			ce.log.Errorf("Failed to calculate metrics for relationship %s: %v",
				relationship.ID, err)
		}
	}
}

func (ce *copyEngine) calculateRelationshipMetrics(ctx context.Context, relationship *models.CopyRelationship) error {
	// Get recent trades for performance calculation
	trades, err := ce.postgres.GetRecentTradesByTrader(ctx, relationship.TraderID, 100)
	if err != nil {
		return fmt.Errorf("failed to get recent trades: %w", err)
	}

	// Calculate performance metrics
	performanceMetrics := ce.calculatePerformanceMetrics(relationship.ID, trades)

	// Update database and cache
	if err := ce.postgres.UpdatePerformanceMetrics(ctx, performanceMetrics); err != nil {
		return fmt.Errorf("failed to update performance metrics: %w", err)
	}

	if err := ce.redis.SetPerformanceMetrics(ctx, relationship.ID, performanceMetrics); err != nil {
		ce.log.Warnf("Failed to cache performance metrics: %v", err)
	}

	// Calculate risk metrics
	riskMetrics, err := ce.calculateRiskMetrics(ctx, relationship)
	if err != nil {
		return fmt.Errorf("failed to calculate risk metrics: %w", err)
	}

	// Update database and cache
	if err := ce.postgres.UpdateRiskMetrics(ctx, riskMetrics); err != nil {
		return fmt.Errorf("failed to update risk metrics: %w", err)
	}

	if err := ce.redis.SetRiskMetrics(ctx, relationship.ID, riskMetrics); err != nil {
		ce.log.Warnf("Failed to cache risk metrics: %v", err)
	}

	return nil
}

func (ce *copyEngine) calculatePerformanceMetrics(relationshipID string, trades []*models.Trade) *models.PerformanceMetrics {
	if len(trades) == 0 {
		return &models.PerformanceMetrics{
			RelationshipID: relationshipID,
			TotalPnL:       0,
			WinRate:        0,
			TotalTrades:    0,
			WinningTrades:  0,
			LosingTrades:   0,
			AvgWinSize:     0,
			AvgLossSize:    0,
			MaxDrawdown:    0,
			SharpeRatio:    0,
			LastUpdated:    time.Now(),
		}
	}

	var totalPnL float64
	var winningTrades, losingTrades int
	var winSizes, lossSizes []float64

	for _, trade := range trades {
		totalPnL += trade.RealizedPnL
		if trade.RealizedPnL > 0 {
			winningTrades++
			winSizes = append(winSizes, trade.RealizedPnL)
		} else if trade.RealizedPnL < 0 {
			losingTrades++
			lossSizes = append(lossSizes, math.Abs(trade.RealizedPnL))
		}
	}

	avgWinSize := 0.0
	if len(winSizes) > 0 {
		for _, size := range winSizes {
			avgWinSize += size
		}
		avgWinSize /= float64(len(winSizes))
	}

	avgLossSize := 0.0
	if len(lossSizes) > 0 {
		for _, size := range lossSizes {
			avgLossSize += size
		}
		avgLossSize /= float64(len(lossSizes))
	}

	winRate := 0.0
	if len(trades) > 0 {
		winRate = float64(winningTrades) / float64(len(trades))
	}

	return &models.PerformanceMetrics{
		RelationshipID: relationshipID,
		TotalPnL:       totalPnL,
		WinRate:        winRate,
		TotalTrades:    len(trades),
		WinningTrades:  winningTrades,
		LosingTrades:   losingTrades,
		AvgWinSize:     avgWinSize,
		AvgLossSize:    avgLossSize,
		MaxDrawdown:    ce.calculateMaxDrawdown(trades),
		SharpeRatio:    ce.calculateSharpeRatio(trades),
		LastUpdated:    time.Now(),
	}
}

func (ce *copyEngine) calculateRiskMetrics(ctx context.Context, relationship *models.CopyRelationship) (*models.RiskMetrics, error) {
	// Get follower positions to calculate current exposure
	positions, err := ce.postgres.GetFollowerPositions(ctx, relationship.FollowerID)
	if err != nil {
		return nil, fmt.Errorf("failed to get follower positions: %w", err)
	}

	var currentExposure float64
	var totalValue float64

	for _, position := range positions {
		if position.CurrentPrice != nil {
			value := position.Size * *position.CurrentPrice
			currentExposure += value
			totalValue += value
		}
	}

	// Simple risk calculations
	maxExposure := relationship.MaxAllocation
	if maxExposure == 0 {
		maxExposure = totalValue * 0.1 // Default to 10% of total value
	}

	leverageRatio := 0.0
	if totalValue > 0 {
		leverageRatio = currentExposure / totalValue
	}

	return &models.RiskMetrics{
		RelationshipID:    relationship.ID,
		CurrentExposure:   currentExposure,
		MaxExposure:       maxExposure,
		VaR:               ce.calculateVaR(positions), // Simple VaR calculation
		LeverageRatio:     leverageRatio,
		ConcentrationRisk: ce.calculateConcentrationRisk(positions),
		LiquidityRisk:     0.1, // Placeholder - would need market data
		LastUpdated:       time.Now(),
	}, nil
}

func (ce *copyEngine) calculateMaxDrawdown(trades []*models.Trade) float64 {
	if len(trades) == 0 {
		return 0
	}

	var peak, maxDrawdown float64
	runningPnL := 0.0

	for _, trade := range trades {
		runningPnL += trade.RealizedPnL
		if runningPnL > peak {
			peak = runningPnL
		}
		drawdown := peak - runningPnL
		if drawdown > maxDrawdown {
			maxDrawdown = drawdown
		}
	}

	return maxDrawdown
}

func (ce *copyEngine) calculateSharpeRatio(trades []*models.Trade) float64 {
	if len(trades) < 2 {
		return 0
	}

	// Simple Sharpe ratio calculation
	var returns []float64
	for _, trade := range trades {
		if trade.Size > 0 {
			returns = append(returns, trade.RealizedPnL/trade.Size)
		}
	}

	if len(returns) < 2 {
		return 0
	}

	mean := 0.0
	for _, r := range returns {
		mean += r
	}
	mean /= float64(len(returns))

	variance := 0.0
	for _, r := range returns {
		diff := r - mean
		variance += diff * diff
	}
	variance /= float64(len(returns))

	if variance == 0 {
		return 0
	}

	return mean / math.Sqrt(variance)
}

func (ce *copyEngine) calculateVaR(positions []*models.Position) float64 {
	if len(positions) == 0 {
		return 0
	}

	// Simple 95% VaR calculation using historical simulation approach
	var totalValue float64
	for _, position := range positions {
		if position.CurrentPrice != nil {
			totalValue += position.Size * *position.CurrentPrice
		}
	}

	// Assume 2% VaR for simplicity (would use historical returns in practice)
	return totalValue * 0.02
}

func (ce *copyEngine) calculateConcentrationRisk(positions []*models.Position) float64 {
	if len(positions) == 0 {
		return 0
	}

	// Calculate Herfindahl-Hirschman Index for concentration
	var totalValue float64
	symbolValues := make(map[string]float64)

	for _, position := range positions {
		if position.CurrentPrice != nil {
			value := position.Size * *position.CurrentPrice
			totalValue += value
			symbolValues[position.TokenSymbol] += value
		}
	}

	if totalValue == 0 {
		return 0
	}

	var hhi float64
	for _, value := range symbolValues {
		share := value / totalValue
		hhi += share * share
	}

	return hhi
}
