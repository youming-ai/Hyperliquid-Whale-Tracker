package models

import (
	"database/sql/driver"
	"encoding/json"
	"time"
)

// CopyRelationship represents a copy trading relationship between a follower and a trader
type CopyRelationship struct {
	ID                string    `json:"id" db:"id"`
	FollowerID        string    `json:"follower_id" db:"follower_id"`
	TraderID          string    `json:"trader_id" db:"trader_id"`
	AllocationPercent float64   `json:"allocation_percentage" db:"allocation_percentage"`
	MaxAllocation     float64   `json:"max_allocation" db:"max_allocation"`
	MinAllocation     float64   `json:"min_allocation" db:"min_allocation"`
	IsActive          bool      `json:"is_active" db:"is_active"`
	AutoRebalance     bool      `json:"auto_rebalance" db:"auto_rebalance"`
	StopLossPercent   *float64  `json:"stop_loss_percentage" db:"stop_loss_percentage"`
	CreatedAt         time.Time `json:"created_at" db:"created_at"`
	UpdatedAt         time.Time `json:"updated_at" db:"updated_at"`
}

// CopyStrategy represents a copy trading strategy
type CopyStrategy struct {
	ID             string         `json:"id" db:"id"`
	RelationshipID string         `json:"relationship_id" db:"relationship_id"`
	Name           string         `json:"name" db:"name"`
	StrategyType   StrategyType   `json:"strategy_type" db:"strategy_type"`
	Parameters     StrategyParams `json:"parameters" db:"parameters"`
	IsActive       bool           `json:"is_active" db:"is_active"`
	CreatedAt      time.Time      `json:"created_at" db:"created_at"`
	UpdatedAt      time.Time      `json:"updated_at" db:"updated_at"`
}

// StrategyType represents the type of copy strategy
type StrategyType string

const (
	StrategyProportional StrategyType = "proportional"
	StrategyFixed        StrategyType = "fixed"
	StrategyAdaptive     StrategyType = "adaptive"
)

// StrategyParams represents strategy parameters
type StrategyParams map[string]interface{}

// Value implements driver.Valuer for StrategyParams
func (sp StrategyParams) Value() (driver.Value, error) {
	return json.Marshal(sp)
}

// Scan implements sql.Scanner for StrategyParams
func (sp *StrategyParams) Scan(value interface{}) error {
	if value == nil {
		*sp = make(StrategyParams)
		return nil
	}

	switch v := value.(type) {
	case []byte:
		return json.Unmarshal(v, sp)
	case string:
		return json.Unmarshal([]byte(v), sp)
	default:
		*sp = make(StrategyParams)
		return nil
	}
}

// Position represents a trading position
type Position struct {
	ID                 string       `json:"id" db:"id"`
	UserID             *string      `json:"user_id" db:"user_id"`
	TraderID           *string      `json:"trader_id" db:"trader_id"`
	TokenSymbol        string       `json:"token_symbol" db:"token_symbol"`
	TokenAddress       string       `json:"token_address" db:"token_address"`
	Side               PositionSide `json:"side" db:"side"`
	Size               float64      `json:"size" db:"size"`
	EntryPrice         float64      `json:"entry_price" db:"entry_price"`
	CurrentPrice       *float64     `json:"current_price" db:"current_price"`
	UnrealizedPnL      float64      `json:"unrealized_pnl" db:"unrealized_pnl"`
	Leverage           float64      `json:"leverage" db:"leverage"`
	FundingRate        *float64     `json:"funding_rate" db:"funding_rate"`
	LiquidationPrice   *float64     `json:"liquidation_price" db:"liquidation_price"`
	CreatedAt          time.Time    `json:"created_at" db:"created_at"`
	UpdatedAt          time.Time    `json:"updated_at" db:"updated_at"`
	IsCopyTrade        bool         `json:"is_copy_trade" db:"is_copy_trade"`
	CopyRelationshipID *string      `json:"copy_relationship_id" db:"copy_relationship_id"`
}

// PositionSide represents the side of a position
type PositionSide string

const (
	PositionLong  PositionSide = "long"
	PositionShort PositionSide = "short"
)

// Trade represents a trade execution
type Trade struct {
	ID                 string    `json:"id" db:"id"`
	UserID             *string   `json:"user_id" db:"user_id"`
	TraderID           *string   `json:"trader_id" db:"trader_id"`
	PositionID         *string   `json:"position_id" db:"position_id"`
	TokenSymbol        string    `json:"token_symbol" db:"token_symbol"`
	Side               TradeSide `json:"side" db:"side"`
	Size               float64   `json:"size" db:"size"`
	Price              float64   `json:"price" db:"price"`
	Fee                float64   `json:"fee" db:"fee"`
	RealizedPnL        float64   `json:"realized_pnl" db:"realized_pnl"`
	TransactionHash    *string   `json:"transaction_hash" db:"transaction_hash"`
	BlockNumber        *int64    `json:"block_number" db:"block_number"`
	CreatedAt          time.Time `json:"created_at" db:"created_at"`
	IsCopyTrade        bool      `json:"is_copy_trade" db:"is_copy_trade"`
	CopyRelationshipID *string   `json:"copy_relationship_id" db:"copy_relationship_id"`
}

// TradeSide represents the side of a trade
type TradeSide string

const (
	TradeBuy  TradeSide = "buy"
	TradeSell TradeSide = "sell"
)

// CopySignal represents a copy trading signal
type CopySignal struct {
	ID            string                 `json:"id"`
	Relationship  *CopyRelationship      `json:"relationship"`
	OriginalTrade *Trade                 `json:"original_trade"`
	SignalType    SignalType             `json:"signal_type"`
	Parameters    map[string]interface{} `json:"parameters"`
	CreatedAt     time.Time              `json:"created_at"`
}

// SignalType represents the type of copy signal
type SignalType string

const (
	SignalOpenPosition  SignalType = "open_position"
	SignalClosePosition SignalType = "close_position"
	SignalModifySize    SignalType = "modify_size"
	SignalStopLoss      SignalType = "stop_loss"
	SignalTakeProfit    SignalType = "take_profit"
)

// CopyExecution represents the execution of a copy signal
type CopyExecution struct {
	ID           string                 `json:"id"`
	SignalID     string                 `json:"signal_id"`
	Relationship *CopyRelationship      `json:"relationship"`
	Trade        *Trade                 `json:"trade"`
	Status       ExecutionStatus        `json:"status"`
	ErrorMessage *string                `json:"error_message"`
	Parameters   map[string]interface{} `json:"parameters"`
	CreatedAt    time.Time              `json:"created_at"`
	UpdatedAt    time.Time              `json:"updated_at"`
}

// ExecutionStatus represents the status of a copy execution
type ExecutionStatus string

const (
	StatusPending   ExecutionStatus = "pending"
	StatusExecuting ExecutionStatus = "executing"
	StatusCompleted ExecutionStatus = "completed"
	StatusFailed    ExecutionStatus = "failed"
	StatusCancelled ExecutionStatus = "cancelled"
)

// PerformanceMetrics represents performance metrics for a copy relationship
type PerformanceMetrics struct {
	RelationshipID string    `json:"relationship_id"`
	TotalPnL       float64   `json:"total_pnl"`
	WinRate        float64   `json:"win_rate"`
	TotalTrades    int       `json:"total_trades"`
	WinningTrades  int       `json:"winning_trades"`
	LosingTrades   int       `json:"losing_trades"`
	AvgWinSize     float64   `json:"avg_win_size"`
	AvgLossSize    float64   `json:"avg_loss_size"`
	MaxDrawdown    float64   `json:"max_drawdown"`
	SharpeRatio    float64   `json:"sharpe_ratio"`
	LastUpdated    time.Time `json:"last_updated"`
}

// RiskMetrics represents risk metrics for a copy relationship
type RiskMetrics struct {
	RelationshipID    string    `json:"relationship_id"`
	CurrentExposure   float64   `json:"current_exposure"`
	MaxExposure       float64   `json:"max_exposure"`
	VaR               float64   `json:"var"` // Value at Risk
	LeverageRatio     float64   `json:"leverage_ratio"`
	ConcentrationRisk float64   `json:"concentration_risk"`
	LiquidityRisk     float64   `json:"liquidity_risk"`
	LastUpdated       time.Time `json:"last_updated"`
}
