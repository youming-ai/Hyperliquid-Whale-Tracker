package config

import (
	"fmt"
	"os"
	"strconv"
)

type Config struct {
	Server    ServerConfig
	Engine    EngineConfig
	Hyperliquid HyperliquidConfig
	Risk      RiskConfig
}

type ServerConfig struct {
	Port string
}

type EngineConfig struct {
	MaxConcurrency     int
	ExecutionInterval  int // seconds
	AlignmentThreshold  float64
	RetryAttempts       int
	RetryBackoffBase    int // seconds
}

type HyperliquidConfig struct {
	BaseURL      string
	APIKey        string
	SecretKey     string
	TestNet       bool
}

type RiskConfig struct {
	MaxLeverage      float64
	MaxPositionSize  float64
	MaxSlippage      float64 // in basis points
	MinOrderSize     float64
	MaxDailyLoss     float64
}

func Load() (*Config, error) {
	cfg := &Config{
		Server: ServerConfig{
			Port: getEnvOrDefault("PORT", "8080"),
		},
		Engine: EngineConfig{
			MaxConcurrency:     getEnvIntOrDefault("MAX_CONCURRENCY", 100),
			ExecutionInterval:  getEnvIntOrDefault("EXECUTION_INTERVAL", 1),
			AlignmentThreshold: getEnvFloatOrDefault("ALIGNMENT_THRESHOLD", 0.02),
			RetryAttempts:       getEnvIntOrDefault("RETRY_ATTEMPTS", 3),
			RetryBackoffBase:    getEnvIntOrDefault("RETRY_BACKOFF_BASE", 1),
		},
		Hyperliquid: HyperliquidConfig{
			BaseURL:  getEnvOrDefault("HYPERLIQUID_BASE_URL", "https://api.hyperliquid.xyz/info"),
			APIKey:   getEnvOrDefault("HYPERLIQUID_API_KEY", ""),
			SecretKey: getEnvOrDefault("HYPERLIQUID_SECRET_KEY", ""),
			TestNet:  getEnvBoolOrDefault("HYPERLIQUID_TESTNET", false),
		},
		Risk: RiskConfig{
			MaxLeverage:     getEnvFloatOrDefault("MAX_LEVERAGE", 5.0),
			MaxPositionSize: getEnvFloatOrDefault("MAX_POSITION_SIZE", 100000.0),
			MaxSlippage:     getEnvFloatOrDefault("MAX_SLIPPAGE", 10.0),
			MinOrderSize:    getEnvFloatOrDefault("MIN_ORDER_SIZE", 5.0),
			MaxDailyLoss:    getEnvFloatOrDefault("MAX_DAILY_LOSS", 1000.0),
		},
	}

	// Validate configuration
	if err := cfg.validate(); err != nil {
		return nil, fmt.Errorf("configuration validation failed: %w", err)
	}

	return cfg, nil
}

func (c *Config) validate() error {
	if c.Hyperliquid.APIKey == "" {
		return fmt.Errorf("HYPERLIQUID_API_KEY is required")
	}
	if c.Hyperliquid.SecretKey == "" {
		return fmt.Errorf("HYPERLIQUID_SECRET_KEY is required")
	}
	if c.Engine.MaxConcurrency <= 0 {
		return fmt.Errorf("MAX_CONCURRENCY must be positive")
	}
	if c.Risk.MaxLeverage <= 0 || c.Risk.MaxLeverage > 100 {
		return fmt.Errorf("MAX_LEVERAGE must be between 0 and 100")
	}
	return nil
}

func getEnvOrDefault(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvIntOrDefault(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvFloatOrDefault(key string, defaultValue float64) float64 {
	if value := os.Getenv(key); value != "" {
		if floatValue, err := strconv.ParseFloat(value, 64); err == nil {
			return floatValue
		}
	}
	return defaultValue
}

func getEnvBoolOrDefault(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}
