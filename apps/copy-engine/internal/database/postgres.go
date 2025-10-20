package database

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperdash/copy-engine/internal/models"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/sirupsen/logrus"
)

// PostgreSQL interface
type PostgreSQL interface {
	Close()
	GetActiveCopyRelationships(ctx context.Context) ([]*models.CopyRelationship, error)
	GetCopyRelationship(ctx context.Context, id string) (*models.CopyRelationship, error)
	GetCopyRelationshipsByFollower(ctx context.Context, followerID string) ([]*models.CopyRelationship, error)
	GetCopyRelationshipsByTrader(ctx context.Context, traderID string) ([]*models.CopyRelationship, error)
	CreateCopyExecution(ctx context.Context, execution *models.CopyExecution) error
	UpdateCopyExecution(ctx context.Context, execution *models.CopyExecution) error
	GetTraderPositions(ctx context.Context, traderID string) ([]*models.Position, error)
	GetFollowerPositions(ctx context.Context, followerID string) ([]*models.Position, error)
	CreatePosition(ctx context.Context, position *models.Position) error
	UpdatePosition(ctx context.Context, position *models.Position) error
	CreateTrade(ctx context.Context, trade *models.Trade) error
	GetRecentTradesByTrader(ctx context.Context, traderID string, limit int) ([]*models.Trade, error)
	UpdatePerformanceMetrics(ctx context.Context, metrics *models.PerformanceMetrics) error
	GetPerformanceMetrics(ctx context.Context, relationshipID string) (*models.PerformanceMetrics, error)
	UpdateRiskMetrics(ctx context.Context, metrics *models.RiskMetrics) error
	GetRiskMetrics(ctx context.Context, relationshipID string) (*models.RiskMetrics, error)
}

type postgresql struct {
	pool *pgxpool.Pool
	log  *logrus.Logger
}

// NewPostgreSQL creates a new PostgreSQL instance
func NewPostgreSQL(dsn string, log *logrus.Logger) (PostgreSQL, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	poolConfig, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("failed to parse postgres DSN: %w", err)
	}

	pool, err := pgxpool.NewWithConfig(ctx, poolConfig)
	if err != nil {
		return nil, fmt.Errorf("failed to create postgres pool: %w", err)
	}

	// Test connection
	if err := pool.Ping(ctx); err != nil {
		return nil, fmt.Errorf("failed to ping postgres: %w", err)
	}

	log.Info("Connected to PostgreSQL")

	return &postgresql{
		pool: pool,
		log:  log,
	}, nil
}

func (p *postgresql) Close() {
	if p.pool != nil {
		p.pool.Close()
		p.log.Info("PostgreSQL connection closed")
	}
}

func (p *postgresql) GetActiveCopyRelationships(ctx context.Context) ([]*models.CopyRelationship, error) {
	query := `
		SELECT id, follower_id, trader_id, allocation_percentage, max_allocation,
		       min_allocation, is_active, auto_rebalance, stop_loss_percentage,
		       created_at, updated_at
		FROM copy_relationships
		WHERE is_active = true
		ORDER BY created_at DESC
	`

	rows, err := p.pool.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("failed to query active copy relationships: %w", err)
	}
	defer rows.Close()

	var relationships []*models.CopyRelationship
	for rows.Next() {
		var rel models.CopyRelationship
		err := rows.Scan(
			&rel.ID,
			&rel.FollowerID,
			&rel.TraderID,
			&rel.AllocationPercent,
			&rel.MaxAllocation,
			&rel.MinAllocation,
			&rel.IsActive,
			&rel.AutoRebalance,
			&rel.StopLossPercent,
			&rel.CreatedAt,
			&rel.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan copy relationship: %w", err)
		}
		relationships = append(relationships, &rel)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating copy relationships: %w", err)
	}

	return relationships, nil
}

func (p *postgresql) GetCopyRelationship(ctx context.Context, id string) (*models.CopyRelationship, error) {
	query := `
		SELECT id, follower_id, trader_id, allocation_percentage, max_allocation,
		       min_allocation, is_active, auto_rebalance, stop_loss_percentage,
		       created_at, updated_at
		FROM copy_relationships
		WHERE id = $1
	`

	var rel models.CopyRelationship
	err := p.pool.QueryRow(ctx, query, id).Scan(
		&rel.ID,
		&rel.FollowerID,
		&rel.TraderID,
		&rel.AllocationPercent,
		&rel.MaxAllocation,
		&rel.MinAllocation,
		&rel.IsActive,
		&rel.AutoRebalance,
		&rel.StopLossPercent,
		&rel.CreatedAt,
		&rel.UpdatedAt,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("copy relationship not found: %s", id)
		}
		return nil, fmt.Errorf("failed to get copy relationship: %w", err)
	}

	return &rel, nil
}

func (p *postgresql) GetCopyRelationshipsByFollower(ctx context.Context, followerID string) ([]*models.CopyRelationship, error) {
	query := `
		SELECT id, follower_id, trader_id, allocation_percentage, max_allocation,
		       min_allocation, is_active, auto_rebalance, stop_loss_percentage,
		       created_at, updated_at
		FROM copy_relationships
		WHERE follower_id = $1 AND is_active = true
		ORDER BY created_at DESC
	`

	return p.scanCopyRelationships(ctx, query, followerID)
}

func (p *postgresql) GetCopyRelationshipsByTrader(ctx context.Context, traderID string) ([]*models.CopyRelationship, error) {
	query := `
		SELECT id, follower_id, trader_id, allocation_percentage, max_allocation,
		       min_allocation, is_active, auto_rebalance, stop_loss_percentage,
		       created_at, updated_at
		FROM copy_relationships
		WHERE trader_id = $1 AND is_active = true
		ORDER BY created_at DESC
	`

	return p.scanCopyRelationships(ctx, query, traderID)
}

func (p *postgresql) scanCopyRelationships(ctx context.Context, query string, args ...interface{}) ([]*models.CopyRelationship, error) {
	rows, err := p.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query copy relationships: %w", err)
	}
	defer rows.Close()

	var relationships []*models.CopyRelationship
	for rows.Next() {
		var rel models.CopyRelationship
		err := rows.Scan(
			&rel.ID,
			&rel.FollowerID,
			&rel.TraderID,
			&rel.AllocationPercent,
			&rel.MaxAllocation,
			&rel.MinAllocation,
			&rel.IsActive,
			&rel.AutoRebalance,
			&rel.StopLossPercent,
			&rel.CreatedAt,
			&rel.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan copy relationship: %w", err)
		}
		relationships = append(relationships, &rel)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating copy relationships: %w", err)
	}

	return relationships, nil
}

func (p *postgresql) CreateCopyExecution(ctx context.Context, execution *models.CopyExecution) error {
	query := `
		INSERT INTO copy_executions (id, signal_id, relationship_id, trade_id, status,
		                            error_message, parameters, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
	`

	parametersJSON, err := json.Marshal(execution.Parameters)
	if err != nil {
		return fmt.Errorf("failed to marshal execution parameters: %w", err)
	}

	_, err = p.pool.Exec(ctx, query,
		execution.ID,
		execution.SignalID,
		execution.Relationship.ID,
		execution.Trade.ID,
		execution.Status,
		execution.ErrorMessage,
		parametersJSON,
		execution.CreatedAt,
		execution.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to create copy execution: %w", err)
	}

	return nil
}

func (p *postgresql) UpdateCopyExecution(ctx context.Context, execution *models.CopyExecution) error {
	query := `
		UPDATE copy_executions
		SET status = $2, error_message = $3, updated_at = $4
		WHERE id = $1
	`

	_, err := p.pool.Exec(ctx, query,
		execution.ID,
		execution.Status,
		execution.ErrorMessage,
		execution.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to update copy execution: %w", err)
	}

	return nil
}

func (p *postgresql) GetTraderPositions(ctx context.Context, traderID string) ([]*models.Position, error) {
	query := `
		SELECT id, user_id, trader_id, token_symbol, token_address, side, size,
		       entry_price, current_price, unrealized_pnl, leverage, funding_rate,
		       liquidation_price, created_at, updated_at, is_copy_trade, copy_relationship_id
		FROM positions
		WHERE trader_id = $1 AND size > 0
		ORDER BY created_at DESC
	`

	return p.scanPositions(ctx, query, traderID)
}

func (p *postgresql) GetFollowerPositions(ctx context.Context, followerID string) ([]*models.Position, error) {
	query := `
		SELECT id, user_id, trader_id, token_symbol, token_address, side, size,
		       entry_price, current_price, unrealized_pnl, leverage, funding_rate,
		       liquidation_price, created_at, updated_at, is_copy_trade, copy_relationship_id
		FROM positions
		WHERE user_id = $1 AND is_copy_trade = true AND size > 0
		ORDER BY created_at DESC
	`

	return p.scanPositions(ctx, query, followerID)
}

func (p *postgresql) scanPositions(ctx context.Context, query string, args ...interface{}) ([]*models.Position, error) {
	rows, err := p.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query positions: %w", err)
	}
	defer rows.Close()

	var positions []*models.Position
	for rows.Next() {
		var pos models.Position
		err := rows.Scan(
			&pos.ID,
			&pos.UserID,
			&pos.TraderID,
			&pos.TokenSymbol,
			&pos.TokenAddress,
			&pos.Side,
			&pos.Size,
			&pos.EntryPrice,
			&pos.CurrentPrice,
			&pos.UnrealizedPnL,
			&pos.Leverage,
			&pos.FundingRate,
			&pos.LiquidationPrice,
			&pos.CreatedAt,
			&pos.UpdatedAt,
			&pos.IsCopyTrade,
			&pos.CopyRelationshipID,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan position: %w", err)
		}
		positions = append(positions, &pos)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating positions: %w", err)
	}

	return positions, nil
}

func (p *postgresql) CreatePosition(ctx context.Context, position *models.Position) error {
	query := `
		INSERT INTO positions (id, user_id, trader_id, token_symbol, token_address, side,
		                      size, entry_price, current_price, unrealized_pnl, leverage,
		                      funding_rate, liquidation_price, created_at, updated_at,
		                      is_copy_trade, copy_relationship_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
	`

	_, err := p.pool.Exec(ctx, query,
		position.ID,
		position.UserID,
		position.TraderID,
		position.TokenSymbol,
		position.TokenAddress,
		position.Side,
		position.Size,
		position.EntryPrice,
		position.CurrentPrice,
		position.UnrealizedPnL,
		position.Leverage,
		position.FundingRate,
		position.LiquidationPrice,
		position.CreatedAt,
		position.UpdatedAt,
		position.IsCopyTrade,
		position.CopyRelationshipID,
	)

	if err != nil {
		return fmt.Errorf("failed to create position: %w", err)
	}

	return nil
}

func (p *postgresql) UpdatePosition(ctx context.Context, position *models.Position) error {
	query := `
		UPDATE positions
		SET size = $2, current_price = $3, unrealized_pnl = $4, funding_rate = $5,
		    liquidation_price = $6, updated_at = $7
		WHERE id = $1
	`

	_, err := p.pool.Exec(ctx, query,
		position.ID,
		position.Size,
		position.CurrentPrice,
		position.UnrealizedPnL,
		position.FundingRate,
		position.LiquidationPrice,
		position.UpdatedAt,
	)

	if err != nil {
		return fmt.Errorf("failed to update position: %w", err)
	}

	return nil
}

func (p *postgresql) CreateTrade(ctx context.Context, trade *models.Trade) error {
	query := `
		INSERT INTO trades (id, user_id, trader_id, position_id, token_symbol, side,
		                  size, price, fee, realized_pnl, transaction_hash, block_number,
		                  created_at, is_copy_trade, copy_relationship_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
	`

	_, err := p.pool.Exec(ctx, query,
		trade.ID,
		trade.UserID,
		trade.TraderID,
		trade.PositionID,
		trade.TokenSymbol,
		trade.Side,
		trade.Size,
		trade.Price,
		trade.Fee,
		trade.RealizedPnL,
		trade.TransactionHash,
		trade.BlockNumber,
		trade.CreatedAt,
		trade.IsCopyTrade,
		trade.CopyRelationshipID,
	)

	if err != nil {
		return fmt.Errorf("failed to create trade: %w", err)
	}

	return nil
}

func (p *postgresql) GetRecentTradesByTrader(ctx context.Context, traderID string, limit int) ([]*models.Trade, error) {
	query := `
		SELECT id, user_id, trader_id, position_id, token_symbol, side, size, price,
		       fee, realized_pnl, transaction_hash, block_number, created_at,
		       is_copy_trade, copy_relationship_id
		FROM trades
		WHERE trader_id = $1
		ORDER BY created_at DESC
		LIMIT $2
	`

	return p.scanTrades(ctx, query, traderID, limit)
}

func (p *postgresql) scanTrades(ctx context.Context, query string, args ...interface{}) ([]*models.Trade, error) {
	rows, err := p.pool.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("failed to query trades: %w", err)
	}
	defer rows.Close()

	var trades []*models.Trade
	for rows.Next() {
		var trade models.Trade
		err := rows.Scan(
			&trade.ID,
			&trade.UserID,
			&trade.TraderID,
			&trade.PositionID,
			&trade.TokenSymbol,
			&trade.Side,
			&trade.Size,
			&trade.Price,
			&trade.Fee,
			&trade.RealizedPnL,
			&trade.TransactionHash,
			&trade.BlockNumber,
			&trade.CreatedAt,
			&trade.IsCopyTrade,
			&trade.CopyRelationshipID,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan trade: %w", err)
		}
		trades = append(trades, &trade)
	}

	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("error iterating trades: %w", err)
	}

	return trades, nil
}

func (p *postgresql) UpdatePerformanceMetrics(ctx context.Context, metrics *models.PerformanceMetrics) error {
	query := `
		INSERT INTO performance_metrics (relationship_id, total_pnl, win_rate, total_trades,
		                               winning_trades, losing_trades, avg_win_size, avg_loss_size,
		                               max_drawdown, sharpe_ratio, last_updated)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
		ON CONFLICT (relationship_id) DO UPDATE SET
			total_pnl = EXCLUDED.total_pnl,
			win_rate = EXCLUDED.win_rate,
			total_trades = EXCLUDED.total_trades,
			winning_trades = EXCLUDED.winning_trades,
			losing_trades = EXCLUDED.losing_trades,
			avg_win_size = EXCLUDED.avg_win_size,
			avg_loss_size = EXCLUDED.avg_loss_size,
			max_drawdown = EXCLUDED.max_drawdown,
			sharpe_ratio = EXCLUDED.sharpe_ratio,
			last_updated = EXCLUDED.last_updated
	`

	_, err := p.pool.Exec(ctx, query,
		metrics.RelationshipID,
		metrics.TotalPnL,
		metrics.WinRate,
		metrics.TotalTrades,
		metrics.WinningTrades,
		metrics.LosingTrades,
		metrics.AvgWinSize,
		metrics.AvgLossSize,
		metrics.MaxDrawdown,
		metrics.SharpeRatio,
		metrics.LastUpdated,
	)

	if err != nil {
		return fmt.Errorf("failed to update performance metrics: %w", err)
	}

	return nil
}

func (p *postgresql) GetPerformanceMetrics(ctx context.Context, relationshipID string) (*models.PerformanceMetrics, error) {
	query := `
		SELECT relationship_id, total_pnl, win_rate, total_trades, winning_trades,
		       losing_trades, avg_win_size, avg_loss_size, max_drawdown, sharpe_ratio, last_updated
		FROM performance_metrics
		WHERE relationship_id = $1
	`

	var metrics models.PerformanceMetrics
	err := p.pool.QueryRow(ctx, query, relationshipID).Scan(
		&metrics.RelationshipID,
		&metrics.TotalPnL,
		&metrics.WinRate,
		&metrics.TotalTrades,
		&metrics.WinningTrades,
		&metrics.LosingTrades,
		&metrics.AvgWinSize,
		&metrics.AvgLossSize,
		&metrics.MaxDrawdown,
		&metrics.SharpeRatio,
		&metrics.LastUpdated,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("performance metrics not found for relationship: %s", relationshipID)
		}
		return nil, fmt.Errorf("failed to get performance metrics: %w", err)
	}

	return &metrics, nil
}

func (p *postgresql) UpdateRiskMetrics(ctx context.Context, metrics *models.RiskMetrics) error {
	query := `
		INSERT INTO risk_metrics (relationship_id, current_exposure, max_exposure, var,
		                        leverage_ratio, concentration_risk, liquidity_risk, last_updated)
		VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
		ON CONFLICT (relationship_id) DO UPDATE SET
			current_exposure = EXCLUDED.current_exposure,
			max_exposure = EXCLUDED.max_exposure,
			var = EXCLUDED.var,
			leverage_ratio = EXCLUDED.leverage_ratio,
			concentration_risk = EXCLUDED.concentration_risk,
			liquidity_risk = EXCLUDED.liquidity_risk,
			last_updated = EXCLUDED.last_updated
	`

	_, err := p.pool.Exec(ctx, query,
		metrics.RelationshipID,
		metrics.CurrentExposure,
		metrics.MaxExposure,
		metrics.VaR,
		metrics.LeverageRatio,
		metrics.ConcentrationRisk,
		metrics.LiquidityRisk,
		metrics.LastUpdated,
	)

	if err != nil {
		return fmt.Errorf("failed to update risk metrics: %w", err)
	}

	return nil
}

func (p *postgresql) GetRiskMetrics(ctx context.Context, relationshipID string) (*models.RiskMetrics, error) {
	query := `
		SELECT relationship_id, current_exposure, max_exposure, var, leverage_ratio,
		       concentration_risk, liquidity_risk, last_updated
		FROM risk_metrics
		WHERE relationship_id = $1
	`

	var metrics models.RiskMetrics
	err := p.pool.QueryRow(ctx, query, relationshipID).Scan(
		&metrics.RelationshipID,
		&metrics.CurrentExposure,
		&metrics.MaxExposure,
		&metrics.VaR,
		&metrics.LeverageRatio,
		&metrics.ConcentrationRisk,
		&metrics.LiquidityRisk,
		&metrics.LastUpdated,
	)

	if err != nil {
		if err == pgx.ErrNoRows {
			return nil, fmt.Errorf("risk metrics not found for relationship: %s", relationshipID)
		}
		return nil, fmt.Errorf("failed to get risk metrics: %w", err)
	}

	return &metrics, nil
}
