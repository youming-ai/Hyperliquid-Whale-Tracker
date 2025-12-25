# HyperDash Platform - Cloudflare + VPS + Supabase 部署指南

## 架构概述

```
┌─────────────────────────────────────────────────────────────────────────┐
│                          Cloudflare (CDN + Edge)                        │
│  ┌─────────────────┐         ┌─────────────────┐                       │
│  │ Cloudflare Pages│  ────>  │ Cloudflare Workers│                       │
│  │   (前端 SPA)    │         │   (API Edge)    │                       │
│  └─────────────────┘         └─────────────────┘                       │
│         │                            │                                 │
└─────────┼────────────────────────────┼─────────────────────────────────┘
          │                            │
          │ HTTPS                     │ HTTPS
          ▼                            ▼
┌─────────────────┐         ┌─────────────────┐
│      Supabase   │         │   VPS (Dokploy) │
│  ┌───────────┐  │         │  ┌───────────┐  │
│  │ PostgreSQL│  │         │  │ API Gateway│  │
│  │   Auth    │  │         │  │ Data Ingest│  │
│  │  Realtime │  │         │  │ Analytics  │  │
│  │  Storage  │  │         │  │  Billing   │  │
│  └───────────┘  │         │  │Copy Engine │  │
└─────────────────┘         │  └───────────┘  │
                           │       │          │
                           │  Docker (Redis)  │
                           └──────────────────┘
```

---

## 服务分配

| 服务 | 部署位置 | 说明 |
|------|----------|------|
| **Web 前端** | Cloudflare Pages | 静态站点，全球 CDN 加速 |
| **API Edge** | Cloudflare Workers | 边缘 API，缓存 + 速率限制 |
| **API Gateway** | VPS (Dokploy) | 主要后端服务 |
| **Data Ingestion** | VPS (Dokploy) | 数据采集服务 |
| **Analytics** | VPS (Dokploy) | 分析服务 |
| **Billing** | VPS (Dokploy) | 计费服务 |
| **Copy Engine** | VPS (Dokploy) | Go 跟单引擎 |
| **PostgreSQL** | Supabase | 托管数据库 + 认证 |
| **Redis** | VPS (Dokploy) | 缓存层 |
| **ClickHouse** | VPS (Dokploy) 或 Cloudflare D1 | 时序数据存储 |

---

## 部署步骤

### 1. 准备工作

#### 1.1 获取必需的服务凭证

| 服务 | 需要获取 |
|------|----------|
| **Supabase** | Project URL, Anon Key, Service Role Key |
| **Cloudflare** | Account ID, API Token, Zone ID |
| **VPS** | IP 地址, SSH 访问 |
| **Stripe** (可选) | Secret Key, Publishable Key, Webhook Secret |
| **Upstash** (可选 Redis) | REST URL, Token |

#### 1.2 安装 CLI 工具

```bash
# pnpm (包管理器)
npm install -g pnpm

# Supabase CLI
brew install supabase/tap/supabase

# Wrangler (Cloudflare)
npm install -g wrangler

# Dokploy CLI (如可用)
npm install -g dokploy
```

---

### 2. 配置 Supabase

#### 2.1 创建项目

1. 访问 https://supabase.com
2. 创建新项目
3. 记录以下信息：
   - Project Reference ID
   - Project URL
   - anon public key
   - service_role secret key

#### 2.2 配置数据库

```bash
# 登录 Supabase
supabase login

# 链接到项目
supabase link --project-ref your-project-ref

# 运行迁移
pnpm db:migrate

# 或使用 Supabase CLI
supabase db push
```

#### 2.3 启用所需功能

在 Supabase Dashboard 中：

1. **Authentication** → Settings
   - 启用 Email 注册
   - 配置邮件模板
   - 添加重定向 URL（你的域名）

2. **Database** → Replicas
   - 记录连接字符串（含 pooling 的直连）

3. **Realtime** → Enable
   - 启用需要实时更新的表

4. **Storage** → Create Bucket
   - `avatars` - 用户头像
   - `documents` - 文档存储

---

### 3. 配置 Cloudflare

#### 3.1 Cloudflare Pages (前端部署)

```bash
# 安装 Wrangler
npm install -g wrangler

# 登录
wrangler login

# 构建前端
pnpm build

# 部署到 Pages
wrangler pages deploy ./apps/web/.output --project-name=hyperdash-web
```

或在 Cloudflare Dashboard：

1. Pages → Create project
2. Connect to Git
3. 设置构建命令：`pnpm --filter=web build`
4. 输出目录：`apps/web/.output`
5. 添加环境变量（见 cloudflare/pages/_headers）

#### 3.2 Cloudflare Workers (API Edge)

```bash
# 创建 D1 数据库（用于边缘缓存）
wrangler d1 create hyperdash-cache

# 创建 KV 命名空间
wrangler kv:namespace create HYPERDASH_CACHE

# 创建 R2 存储桶
wrangler r2 bucket create hyperdash-storage

# 部署 Worker
cd cloudflare/workers
wrangler deploy
```

#### 3.3 配置 DNS

在 Cloudflare DNS 设置中：

| 类型 | 名称 | 内容 |
|------|------|------|
| A | `@` | VPS IP |
| A | `api` | VPS IP |
| A | `billing` | VPS IP |
| CNAME | `www` | `your-domain.com` |

---

### 4. 配置 VPS + Dokploy

#### 4.1 安装 Dokploy

在 VPS 上执行：

```bash
# 安装 Docker
curl -fsSL https://get.docker.com | sh

# 安装 Dokploy
docker compose -f https://dokploy.com/install.yaml up -d
```

#### 4.2 配置项目

1. 访问 `http://your-vps-ip:3000`
2. 创建新项目
3. 连接 Git 仓库
4. 配置服务（见 `dokploy.json`）

#### 4.3 部署服务

在 Dokploy Dashboard 中：

1. **API Gateway**
   - Build: `pnpm --filter=@hyperdash/api-gateway build`
   - Start: `pnpm --filter=@hyperdash/api-gateway start`
   - Port: `3000`
   - Domain: `api.your-domain.com`

2. **Data Ingestion**
   - Build: `pnpm --filter=@hyperdash/data-ingestion build`
   - Start: `pnpm --filter=@hyperdash/data-ingestion start`
   - Port: `3003`

3. **Analytics**
   - Build: `pnpm --filter=@hyperdash/analytics build`
   - Start: `pnpm --filter=@hyperdash/analytics start`
   - Port: `3004`

4. **Billing**
   - Build: `pnpm --filter=@hyperdash/billing build`
   - Start: `pnpm --filter=@hyperdash/billing start`
   - Port: `3005`

5. **Copy Engine** (Go)
   - Build: `cd apps/copy-engine && go build -o bin/copy-engine ./cmd/server`
   - Start: `./apps/copy-engine/bin/copy-engine`
   - Port: `3006`

#### 4.4 配置 Redis

在 Dokploy 中创建 Redis 容器：

```bash
docker run -d \
  --name hyperdash-redis \
  --restart unless-stopped \
  -p 6379:6379 \
  redis:7-alpine \
  redis-server --appendonly yes
```

#### 4.5 配置环境变量

在 Dokploy 中为每个服务配置环境变量：

```bash
# 通用
NODE_ENV=production
LOG_LEVEL=info

# Supabase
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# Redis
REDIS_URL=redis://hyperdash-redis:6379

# JWT (如使用自定义认证)
JWT_SECRET=your-super-secret-key

# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Hyperliquid API
HYPERLIQUID_API_URL=https://api.hyperliquid.xyz/info
HYPERLIQUID_WS_URL=wss://api.hyperliquid.xyz/ws
```

---

### 5. 监控和维护

#### 5.1 日志

```bash
# Dokploy 容器日志
docker logs hyperdash-api-gateway -f
docker logs hyperdash-data-ingestion -f

# Supabase 日志
supabase functions logs --project-ref your-ref
```

#### 5.2 备份

- **Supabase**: 自动备份，保留 7-30 天
- **Redis**: 配置持久化到 VPS 磁盘
- **代码**: Git 仓库

#### 5.3 监控

推荐使用：

- **Uptime monitoring**: UptimeRobot, Better Stack
- **Error tracking**: Sentry (在 `.env.supabase` 中配置)
- **Analytics**: PostHog, Plausible
- **Performance**: Cloudflare Web Analytics

---

## 环境变量清单

### 生产环境 (`.env.production`)

```bash
# -----------------------------------------------------------------------------
# 应用配置
# -----------------------------------------------------------------------------
NODE_ENV=production
LOG_LEVEL=info

# -----------------------------------------------------------------------------
# Supabase
# -----------------------------------------------------------------------------
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
DATABASE_URL=postgresql://postgres:password@db.xxx.supabase.co:5432/postgres

# -----------------------------------------------------------------------------
# Redis (VPS)
# -----------------------------------------------------------------------------
REDIS_URL=redis://localhost:6379

# -----------------------------------------------------------------------------
# Cloudflare (用于 Workers)
# -----------------------------------------------------------------------------
CLOUDFLARE_ACCOUNT_ID=your-account-id
CLOUDFLARE_API_TOKEN=your-token

# -----------------------------------------------------------------------------
# Stripe
# -----------------------------------------------------------------------------
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# -----------------------------------------------------------------------------
# Hyperliquid API
# -----------------------------------------------------------------------------
HYPERLIQUID_API_URL=https://api.hyperliquid.xyz/info
HYPERLIQUID_WS_URL=wss://api.hyperliquid.xyz/ws

# -----------------------------------------------------------------------------
# 前端公开变量
# -----------------------------------------------------------------------------
NEXT_PUBLIC_API_URL=https://api.your-domain.com
NEXT_PUBLIC_WS_URL=wss://api.your-domain.com
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

---

## 故障排查

### 问题：Supabase 连接失败

```bash
# 测试连接
psql $DATABASE_URL

# 检查连接池设置
# 使用 DIRECT_URL 进行直连
```

### 问题：Dokploy 部署失败

```bash
# 检查构建日志
docker logs dokploy-agent -f

# 清除缓存重建
docker system prune -a
```

### 问题：Cloudflare Workers 错误

```bash
# 本地测试
wrangler dev

# 查看日志
wrangler tail
```

---

## 成本估算

| 服务 | 月成本 |
|------|--------|
| Cloudflare Pages | 免费 |
| Cloudflare Workers | 免费 ($5 请求/天) |
| Supabase (免费层) | $0 - $25 |
| VPS (2-4GB RAM) | $5 - $20 |
| 域名 | $1 - $2 |
| **总计** | **约 $6 - $50/月** |

---

## 安全检查清单

- [ ] 所有 API 密钥存储为环境变量
- [ ] `.env.*` 文件已加入 `.gitignore`
- [ ] Supabase RLS (Row Level Security) 已启用
- [ ] Cloudflare WAF 规则已配置
- [ ] HTTPS 强制开启
- [ ] API 速率限制已配置
- [ ] 敏感操作需要二次验证
- [ ] 日志不记录敏感信息
- [ ] 定期备份数据库
- [ ] 使用 Secret Management 服务 (如 Doppler)
