# Hyperliquid 大户交易追踪机器人 🐋

[English](README.md) | 中文文档

## 项目简介

这是一个用于监控 Hyperliquid DEX（去中心化交易所）上特定钱包地址交易活动的 Telegram 机器人。它能实时追踪"大佬"（有经验的交易者）的交易行为，并通过 Telegram 及时通知用户。

## 主要功能

- 🔍 实时监控指定钱包地址
- 📊 详细的交易分析（买入/卖出、开仓/平仓）
- 💬 即时 Telegram 通知
- 🐳 大户交易行为追踪
- 🔄 可靠的错误处理和重试机制

## 快速开始

### 环境要求

- Python 3.8+
- Telegram Bot Token
- Arbitrum 节点访问
- Hyperliquid API 访问权限

### 安装步骤

1. 克隆仓库
```bash
git clone https://github.com/yourusername/HyperliquidWhaleTrackerBot.git
cd HyperliquidWhaleTrackerBot
```

2. 安装依赖
```bash
python3 -m pip install -r requirements.txt
```

3. 配置环境变量
```bash
# 复制环境变量示例文件
cp .env.example .env

# 编辑 .env 文件配置你的参数
nano .env  # 或使用其他文本编辑器
```

需要在 `.env` 中配置的环境变量：
```bash
# Telegram 配置
TELEGRAM_BOT_TOKEN=你的机器人令牌    # 从 @BotFather 获取
TELEGRAM_CHAT_ID=你的聊天ID        # 从 @userinfobot 获取

# 区块链配置
ARBITRUM_RPC_URL=你的Arbitrum节点地址    # 你的 Arbitrum RPC 端点
HYPERLIQUID_API_URL=你的Hyperliquid接口地址  # Hyperliquid API 端点
```

### 使用方法

1. 启动机器人
```bash
python3 main.py
```

2. Telegram 命令
- `/start` - 启动机器人
- `/set_address` - 设置监控地址
- `/monitor` - 开始监控
- `/stop_monitor` - 停止监控
- `/status` - 查看当前状态
- `/help` - 获取帮助

3. 重启和停止
- 停止运行：按 `Ctrl + C` 停止脚本
- 重新运行：再次执行 `python3 main.py`
- 如果在后台运行，可以使用 `ps aux | grep python3` 找到进程，然后用 `kill <进程ID>` 停止

## 技术架构

### 核心组件

1. **区块链监控系统**
   - 实时交易监控
   - 1秒间隔的区块扫描
   - 异步处理机制

2. **交易数据处理**
   - 交易类型识别
   - 持仓分析
   - 缓存机制

3. **消息通知系统**
   - Telegram 集成
   - 格式化消息
   - 错误处理

## 应用场景

这个机器人主要用于：
1. 跟踪成功交易者的操作
2. 学习交易策略
3. 及时获取市场动向
4. 分析大户行为模式

## 参与贡献

我们欢迎各种形式的贡献！请随时提交 Pull Request。

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 开源协议

本项目采用 MIT 协议 - 详见 [LICENSE](LICENSE) 文件。 