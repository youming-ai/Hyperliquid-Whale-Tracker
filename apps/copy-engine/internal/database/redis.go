package database

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/hyperdash/copy-engine/internal/models"
	"github.com/redis/go-redis/v9"
	"github.com/sirupsen/logrus"
)

// Redis interface
type Redis interface {
	Close()
	SetCopySignal(ctx context.Context, signal *models.CopySignal) error
	GetCopySignals(ctx context.Context, relationshipID string) ([]*models.CopySignal, error)
	SetExecutionStatus(ctx context.Context, executionID string, status models.ExecutionStatus) error
	GetExecutionStatus(ctx context.Context, executionID string) (models.ExecutionStatus, error)
	SetPerformanceMetrics(ctx context.Context, relationshipID string, metrics *models.PerformanceMetrics) error
	GetPerformanceMetrics(ctx context.Context, relationshipID string) (*models.PerformanceMetrics, error)
	SetRiskMetrics(ctx context.Context, relationshipID string, metrics *models.RiskMetrics) error
	GetRiskMetrics(ctx context.Context, relationshipID string) (*models.RiskMetrics, error)
	IncrementTradeCounter(ctx context.Context, relationshipID string) (int64, error)
	GetTradeCounter(ctx context.Context, relationshipID string) (int64, error)
	SetLock(ctx context.Context, key string, ttl time.Duration) (bool, error)
	ReleaseLock(ctx context.Context, key string) error
	IsLocked(ctx context.Context, key string) (bool, error)
	PublishTradeEvent(ctx context.Context, event *TradeEvent) error
	SubscribeToTradeEvents(ctx context.Context) (<-chan *TradeEvent, error)
}

type redisClient struct {
	client *redis.Client
	log    *logrus.Logger
}

// TradeEvent represents a trade event for pub/sub
type TradeEvent struct {
	Type      string                 `json:"type"`
	TraderID  string                 `json:"trader_id"`
	Trade     *models.Trade          `json:"trade"`
	Timestamp time.Time              `json:"timestamp"`
	Data      map[string]interface{} `json:"data"`
}

// NewRedis creates a new Redis instance
func NewRedis(addr string, password string, db int, log *logrus.Logger) (Redis, error) {
	rdb := redis.NewClient(&redis.Options{
		Addr:     addr,
		Password: password,
		DB:       db,
	})

	// Test connection
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := rdb.Ping(ctx).Err(); err != nil {
		return nil, fmt.Errorf("failed to connect to redis: %w", err)
	}

	log.Info("Connected to Redis")

	return &redisClient{
		client: rdb,
		log:    log,
	}, nil
}

func (r *redisClient) Close() {
	if r.client != nil {
		r.client.Close()
		r.log.Info("Redis connection closed")
	}
}

func (r *redisClient) SetCopySignal(ctx context.Context, signal *models.CopySignal) error {
	key := fmt.Sprintf("copy_signals:%s", signal.Relationship.ID)

	data, err := json.Marshal(signal)
	if err != nil {
		return fmt.Errorf("failed to marshal copy signal: %w", err)
	}

	// Store with TTL of 1 hour
	return r.client.Set(ctx, key, data, time.Hour).Err()
}

func (r *redisClient) GetCopySignals(ctx context.Context, relationshipID string) ([]*models.CopySignal, error) {
	key := fmt.Sprintf("copy_signals:%s", relationshipID)

	data, err := r.client.Get(ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return []*models.CopySignal{}, nil
		}
		return nil, fmt.Errorf("failed to get copy signals: %w", err)
	}

	var signals []*models.CopySignal
	if err := json.Unmarshal([]byte(data), &signals); err != nil {
		return nil, fmt.Errorf("failed to unmarshal copy signals: %w", err)
	}

	return signals, nil
}

func (r *redisClient) SetExecutionStatus(ctx context.Context, executionID string, status models.ExecutionStatus) error {
	key := fmt.Sprintf("execution_status:%s", executionID)

	return r.client.Set(ctx, key, string(status), 24*time.Hour).Err()
}

func (r *redisClient) GetExecutionStatus(ctx context.Context, executionID string) (models.ExecutionStatus, error) {
	key := fmt.Sprintf("execution_status:%s", executionID)

	status, err := r.client.Get(ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return "", fmt.Errorf("execution status not found: %s", executionID)
		}
		return "", fmt.Errorf("failed to get execution status: %w", err)
	}

	return models.ExecutionStatus(status), nil
}

func (r *redisClient) SetPerformanceMetrics(ctx context.Context, relationshipID string, metrics *models.PerformanceMetrics) error {
	key := fmt.Sprintf("performance_metrics:%s", relationshipID)

	data, err := json.Marshal(metrics)
	if err != nil {
		return fmt.Errorf("failed to marshal performance metrics: %w", err)
	}

	// Cache for 5 minutes
	return r.client.Set(ctx, key, data, 5*time.Minute).Err()
}

func (r *redisClient) GetPerformanceMetrics(ctx context.Context, relationshipID string) (*models.PerformanceMetrics, error) {
	key := fmt.Sprintf("performance_metrics:%s", relationshipID)

	data, err := r.client.Get(ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, fmt.Errorf("performance metrics not found for relationship: %s", relationshipID)
		}
		return nil, fmt.Errorf("failed to get performance metrics: %w", err)
	}

	var metrics models.PerformanceMetrics
	if err := json.Unmarshal([]byte(data), &metrics); err != nil {
		return nil, fmt.Errorf("failed to unmarshal performance metrics: %w", err)
	}

	return &metrics, nil
}

func (r *redisClient) SetRiskMetrics(ctx context.Context, relationshipID string, metrics *models.RiskMetrics) error {
	key := fmt.Sprintf("risk_metrics:%s", relationshipID)

	data, err := json.Marshal(metrics)
	if err != nil {
		return fmt.Errorf("failed to marshal risk metrics: %w", err)
	}

	// Cache for 5 minutes
	return r.client.Set(ctx, key, data, 5*time.Minute).Err()
}

func (r *redisClient) GetRiskMetrics(ctx context.Context, relationshipID string) (*models.RiskMetrics, error) {
	key := fmt.Sprintf("risk_metrics:%s", relationshipID)

	data, err := r.client.Get(ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return nil, fmt.Errorf("risk metrics not found for relationship: %s", relationshipID)
		}
		return nil, fmt.Errorf("failed to get risk metrics: %w", err)
	}

	var metrics models.RiskMetrics
	if err := json.Unmarshal([]byte(data), &metrics); err != nil {
		return nil, fmt.Errorf("failed to unmarshal risk metrics: %w", err)
	}

	return &metrics, nil
}

func (r *redisClient) IncrementTradeCounter(ctx context.Context, relationshipID string) (int64, error) {
	key := fmt.Sprintf("trade_counter:%s", relationshipID)

	return r.client.Incr(ctx, key).Result()
}

func (r *redisClient) GetTradeCounter(ctx context.Context, relationshipID string) (int64, error) {
	key := fmt.Sprintf("trade_counter:%s", relationshipID)

	count, err := r.client.Get(ctx, key).Result()
	if err != nil {
		if err == redis.Nil {
			return 0, nil
		}
		return 0, fmt.Errorf("failed to get trade counter: %w", err)
	}

	var result int64
	if _, err := fmt.Sscanf(count, "%d", &result); err != nil {
		return 0, fmt.Errorf("failed to parse trade counter: %w", err)
	}

	return result, nil
}

func (r *redisClient) SetLock(ctx context.Context, key string, ttl time.Duration) (bool, error) {
	fullKey := fmt.Sprintf("lock:%s", key)

	// Use SET with NX and EX for atomic lock acquisition
	result, err := r.client.SetNX(ctx, fullKey, "locked", ttl).Result()
	if err != nil {
		return false, fmt.Errorf("failed to set lock: %w", err)
	}

	return result, nil
}

func (r *redisClient) ReleaseLock(ctx context.Context, key string) error {
	fullKey := fmt.Sprintf("lock:%s", key)

	return r.client.Del(ctx, fullKey).Err()
}

func (r *redisClient) IsLocked(ctx context.Context, key string) (bool, error) {
	fullKey := fmt.Sprintf("lock:%s", key)

	exists, err := r.client.Exists(ctx, fullKey).Result()
	if err != nil {
		return false, fmt.Errorf("failed to check lock: %w", err)
	}

	return exists > 0, nil
}

func (r *redisClient) PublishTradeEvent(ctx context.Context, event *TradeEvent) error {
	data, err := json.Marshal(event)
	if err != nil {
		return fmt.Errorf("failed to marshal trade event: %w", err)
	}

	return r.client.Publish(ctx, "trade_events", data).Err()
}

func (r *redisClient) SubscribeToTradeEvents(ctx context.Context) (<-chan *TradeEvent, error) {
	pubsub := r.client.Subscribe(ctx, "trade_events")

	eventChan := make(chan *TradeEvent, 100)

	go func() {
		defer close(eventChan)
		defer pubsub.Close()

		for {
			select {
			case <-ctx.Done():
				return
			case msg := <-pubsub.Channel():
				if msg == nil {
					return
				}

				var event TradeEvent
				if err := json.Unmarshal([]byte(msg.Payload), &event); err != nil {
					r.log.Errorf("Failed to unmarshal trade event: %v", err)
					continue
				}

				select {
				case eventChan <- &event:
				case <-ctx.Done():
					return
				default:
					r.log.Warn("Event channel full, dropping trade event")
				}
			}
		}
	}()

	return eventChan, nil
}
