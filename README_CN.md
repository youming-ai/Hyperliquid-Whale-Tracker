# Hyperliquid Copy Trading Platform

专注于 Hyperliquid 交易所的跟单平台。

## 功能

- **交易员发现** - 浏览和分析顶级交易员
- **跟单交易** - 自动复制选定交易员的交易
- **策略管理** - 创建和管理跟单策略，带风险控制

## 快速开始

```bash
pnpm install
pnpm docker:up
pnpm db:migrate
pnpm dev
```

访问 http://localhost:5173

## 项目结构

```
apps/
├── web/           # 前端 (交易员、策略页面)
├── api-gateway/   # API (认证、交易员、跟单)
└── copy-engine/   # Go 交易引擎

packages/
├── database/      # 数据库 schema
└── contracts/     # API 契约
```

## 技术栈

- **前端**: TanStack Start, React, Tailwind CSS
- **后端**: Hono, Bun
- **交易引擎**: Go
- **数据库**: PostgreSQL + Redis
