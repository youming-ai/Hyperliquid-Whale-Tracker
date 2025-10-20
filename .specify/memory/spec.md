# Feature Specification: HyperDash Platform

**Feature Branch**: `[hyperdash-platform]`  
**Created**: 2025-01-18  
**Status**: Draft  
**Input**: User description: "HyperDash 类产品—实施方案（PRD + 架构设计 + 交付计划）"

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Market Intelligence Dashboard (Priority: P1)

User opens Market Overview to analyze market conditions, funding rates, and liquidation hotspots to make informed trading decisions.

**Why this priority**: Core analytics foundation that provides immediate value and drives user retention through actionable market insights

**Independent Test**: Market Overview dashboard can be fully tested by loading real-time market data and verifying all metrics render correctly with proper WebSocket updates

**Acceptance Scenarios**:

1. **Given** user visits Market Overview, **When** page loads, **Then** display current OI, funding rates, L/S ratio, volume, volatility with P95 ≤ 1.5s
2. **Given** user selects BTC symbol, **When** viewing liquidation heatmap, **Then** show 1h/4h/12h/24h cumulative liquidation density with zoom and pan controls
3. **Given** funding rate changes significantly, **When** WebSocket event occurs, **Then** update UI in real-time with visual indicators

---

### User Story 2 - Top Traders Discovery & Analysis (Priority: P1)

User discovers and analyzes top performing traders to identify potential copy trading targets based on performance metrics and trading patterns.

**Why this priority**: Essential user acquisition path for copy trading - traders need to find and evaluate successful trading strategies

**Independent Test**: Top Traders leaderboard and trader profiles can be tested independently with sample trader data and performance calculations

**Acceptance Scenarios**:

1. **Given** user accesses Top Traders, **When** applying filters (Sharpe > 1.0, max DD < 15%), **Then** display ranked list with all metrics and allow profile navigation
2. **Given** user clicks on trader profile, **When** profile loads, **Then** show PnL curve, win rate distribution, style tags, and preferred symbols
3. **Given** new trading events occur, **When** Live Feed updates, **Then** display real-time position changes with proper categorization

---

### User Story 3 - Strategic Copy Trading Setup (Priority: P1)

User creates and configures copy trading strategies with proper risk management parameters and allocation settings.

**Why this priority**: Core revenue-generating feature that directly addresses user's primary goal of copying successful traders

**Independent Test**: Copy trading strategy creation and management can be tested end-to-end with mock trader data and simulated market conditions

**Acceptance Scenarios**:

1. **Given** user creates copy strategy, **When** selecting 1-3 traders, **Then** allow allocation configuration with weight visualization and total percentage validation
2. **Given** user sets risk parameters, **When** configuring leverage ≤ 5x, slippage ≤ 10 bps, and min order thresholds, **Then** enforce all constraints in execution engine
3. **Given** strategy is active, **When** target traders change positions, **Then** execute copy trades with P95 ≤ 1.0s and maintain ≥ 98% alignment rate

---

### User Story 4 - Agent Wallet Management (Priority: P2)

User manages agent wallets for copy trading execution with proper security controls and transaction monitoring.

**Why this priority**: Security and operational foundation required for copy trading execution and user trust

**Independent Test**: Agent wallet creation, funding, and monitoring can be tested independently with wallet simulation APIs

**Acceptance Scenarios**:

1. **Given** user creates agent wallet, **When** configuring exchange settings, **Then** enforce minimum order thresholds and trading-only permissions
2. **Given** copy strategy executes trades, **When** monitoring wallet activity, **Then** track all orders, positions, and fee calculations in real-time
3. **Given** manual trading conflicts occur, **When** user manually closes positions, **Then** handle strategy pause/resume according to user configuration

---

### User Story 5 - Fee Management & Billing (Priority: P2)

User tracks copy trading fees, manages billing, and exports transaction records for accounting purposes.

**Why this priority**: Essential for business operations and user transparency in fee structure

**Independent Test**: Fee calculation, tracking, and export functionality can be tested independently with simulated trading scenarios

**Acceptance Scenarios**:

1. **Given** copy trades execute, **When** calculating fees, **Then** apply correct bps rates and record in fee ledger with transaction references
2. **Given** user views billing dashboard, **When** selecting date range, **Then** display fee breakdown, totals, and export options
3. **Given** user requests export, **When** generating CSV/PDF, **Then** include all order details, fees, and audit trail information

---

### User Story 6 - Risk Management & Alerts (Priority: P3)

User receives alerts for risk events and can configure automated risk responses to protect their copy trading strategies.

**Why this priority**: Advanced feature for power users and risk-averse traders, enhances platform safety

**Independent Test**: Alert system and automated risk responses can be tested independently with simulated market scenarios and risk triggers

**Acceptance Scenarios**:

1. **Given** portfolio drawdown exceeds threshold, **When** risk event occurs, **Then** trigger alerts and optionally reduce leverage or pause copying
2. **Given** liquidation zones approach portfolio positions, **When** heatmap shows proximity, **Then** send early warnings with recommended actions
3. **Given** copy alignment falls below threshold, **When** monitoring detects drift, **Then** notify user with alignment details and remediation options

---

### Edge Cases

- What happens when WebSocket connections to exchange APIs are interrupted?
- How does system handle rapid position changes from target traders (multiple events within 1 second)?
- What happens when copy trade execution fails due to insufficient margin or market conditions?
- How does system handle conflicting signals from multiple copied traders?
- What happens when user manually closes positions that contradict copy strategy?

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST provide real-time market data streaming with <1.5s P95 latency from exchange to frontend
- **FR-002**: System MUST calculate and display liquidation heatmaps with configurable time windows (1h/4h/12h/24h)
- **FR-003**: System MUST rank traders by performance metrics (PnL, Sharpe, win rate, max drawdown, trading frequency)
- **FR-004**: Users MUST be able to create copy trading strategies with 1-3 target traders and configurable allocation weights
- **FR-005**: System MUST enforce risk parameters (max leverage 5x, slippage 10 bps, minimum order thresholds)
- **FR-006**: Copy trade execution MUST complete with P95 ≤ 1.0s latency from signal to order confirmation
- **FR-007**: System MUST maintain ≥ 98% position alignment between target traders and copy strategies
- **FR-008**: Agent wallets MUST have trading-only permissions with withdrawal restrictions
- **FR-009**: System MUST calculate and track copy trading fees (builder fees, copy fees) with bps-level precision
- **FR-010**: System MUST provide comprehensive audit logs for all trading and strategy activities
- **FR-011**: Users MUST receive alerts for risk events (drawdown, liquidation proximity, copy failures)
- **FR-012**: System MUST support wallet authentication (JWT + wallet signature) for secure access

### Key Entities

- **User**: Platform user with authentication, KYC status, and associated wallets
- **Trader**: Hyperliquid trader being monitored and potentially copied, with performance metrics and trading history
- **Copy Strategy**: User's copy trading configuration with trader allocations, risk parameters, and execution rules
- **Agent Wallet**: Dedicated wallet for copy trade execution with limited permissions
- **Position**: Current holding details for user or trader with PnL, entry price, and leverage
- **Trader Event**: Individual trading action (open/close/add/reduce/liquidate) from monitored traders
- **Liquidation Heatmap Bin**: Aggregated liquidation potential at specific price levels
- **Fee Ledger**: Record of all platform fees with calculation details and payment status

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Achieve DAU ≥ 3,000 within 3 months of launch
- **SC-002**: Onboard ≥ 800 active copy trading accounts within 3 months
- **SC-003**: Maintain market data latency P95 ≤ 1.5s from exchange to frontend
- **SC-004**: Maintain copy trade execution latency P95 ≤ 1.0s from signal to order confirmation
- **SC-005**: Achieve ≥ 98% position alignment rate between target traders and copy strategies
- **SC-006**: Maintain ≥ 95% cache hit rate for heatmap tiles and top trader rankings
- **SC-007**: Support concurrent 500-1,000 copy trade executions with QPS peaks of 200-400
- **SC-008**: Generate revenue through builder fees, copy fees, and vault management fees
- **SC-009**: Achieve <1% system downtime during trading hours with proper failover mechanisms
- **SC-010**: Maintain <5% copy trade failure rate with automated retry and alignment mechanisms