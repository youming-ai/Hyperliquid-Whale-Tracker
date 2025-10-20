<!--
Sync Impact Report:
Version change: 0.0.0 → 1.0.0 (Initial constitution creation)
List of modified principles: N/A (initial creation)
Added sections: All sections (initial creation)
Removed sections: N/A
Templates requiring updates: ⚠ All templates need review for project-specific alignment
Follow-up TODOs: N/A
-->

# Hyperliquid Whale Tracker Constitution

## Core Principles

### I. Real-time Monitoring
The bot MUST provide real-time monitoring of specified wallet addresses on Hyperliquid DEX with 1-second block scanning intervals. All transaction processing MUST be asynchronous to ensure continuous monitoring without blocking. Cache mechanisms MUST be implemented to prevent duplicate notifications within a 60-second window.

### II. Reliable Error Handling
All external API calls (Telegram, Hyperliquid, Arbitrum RPC) MUST implement retry mechanisms with exponential backoff. Maximum retry attempts SHALL NOT exceed 3 attempts. All errors MUST be logged with sufficient context for debugging. The bot MUST recover gracefully from network interruptions and service outages.

### III. Configuration-Driven
All operational parameters (API endpoints, chat IDs, monitoring addresses, performance thresholds) MUST be configurable via environment variables. The bot MUST validate all required configuration on startup and fail fast with clear error messages if configuration is incomplete. Default values MUST be provided for optional settings.

### IV. Telegram Integration
All notifications MUST be formatted for readability in Telegram with appropriate emojis and structure. The bot MUST support essential commands: /start, /set_address, /monitor, /stop_monitor, /status, /help. All user inputs MUST be validated with clear error messages for invalid commands or parameters.

### V. Performance & Observability
Transaction processing MUST complete within the 1-second block interval to avoid missing transactions. Position tiers MUST be configurable for whale detection (default: $100k+, $500k+, $1M+). Structured logging MUST include transaction details, processing times, and error conditions for monitoring and debugging.

## Security & Privacy

### API Security
All API tokens and sensitive credentials MUST be stored in environment variables, never in code. The bot MUST NOT log or expose sensitive user data including private keys, full wallet addresses in logs, or API tokens. Rate limiting MUST be implemented to prevent API abuse.

### Data Protection
The bot MUST only store necessary transaction data in memory cache with defined TTL. No persistent storage of user data or transaction history beyond the cache window. User wallet addresses being monitored MUST be configurable but not persistently stored without user consent.

## Development Standards

### Code Quality
All Python code MUST follow PEP 8 style guidelines. Type hints MUST be used for function signatures and complex data structures. All functions MUST include docstrings describing purpose, parameters, and return values. Error handling MUST be specific and actionable.

### Testing
Unit tests MUST cover all core business logic components (transaction processing, message formatting, configuration validation). Integration tests MUST verify Telegram API connectivity and error handling. Mock external dependencies for reliable unit testing. All tests MUST pass before code changes are merged.

## Governance

This constitution supersedes all other development practices and guidelines. Amendments require documentation of changes, version bump following semantic versioning, and update of dependent templates. All pull requests MUST verify compliance with constitution principles. Code reviews MUST check for constitution violations. Use the development guidelines in `.claude/CLAUDE.md` for runtime development guidance. Constitution violations MUST be explicitly justified in pull request descriptions with simpler alternatives considered and rejected.

**Version**: 1.0.0 | **Ratified**: 2025-01-18 | **Last Amended**: 2025-01-18