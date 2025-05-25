# Hyperliquid Whale Tracker Bot 🐋

English | [中文](README_CN.md)

A Telegram bot that monitors and tracks whale trading activities on Hyperliquid DEX.

## Features

- 🔍 Real-time monitoring of specified wallet addresses on Hyperliquid
- 📊 Detailed transaction analysis (buy/sell, open/close positions)
- 💬 Instant Telegram notifications
- 🐳 Whale trading activity tracking
- 🔄 Reliable error handling and retry mechanisms

## Quick Start

### Prerequisites

- Python 3.8+
- Telegram Bot Token
- Arbitrum Node Access
- Hyperliquid API Access

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/HyperliquidWhaleTrackerBot.git
cd HyperliquidWhaleTrackerBot
```

2. Install dependencies
```bash
python3 -m pip install -r requirements.txt
```

3. Configure environment variables
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your configuration
nano .env  # or use any text editor
```

Required environment variables in `.env`:
```bash
# Telegram Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_here    # Get from @BotFather
TELEGRAM_CHAT_ID=your_chat_id_here        # Get from @userinfobot

# Blockchain Configuration
ARBITRUM_RPC_URL=your_arbitrum_rpc_url_here    # Your Arbitrum RPC endpoint
HYPERLIQUID_API_URL=your_hyperliquid_api_url_here  # Hyperliquid API endpoint
```

### Usage

1. Start the bot
```bash
python3 main.py
```

2. Telegram Commands
- `/start` - Start the bot
- `/set_address` - Set the address to monitor
- `/monitor` - Begin monitoring
- `/stop_monitor` - Stop monitoring
- `/status` - Check current status
- `/help` - Get help

3. Restart and Stop
- Stop running: Press `Ctrl + C` to stop the script
- Restart: Run `python3 main.py` again
- If running in background, use `ps aux | grep python3` to find the process, then `kill <process_id>` to stop

## Architecture

### Core Components

1. **Blockchain Monitor**
   - Real-time transaction monitoring
   - Block scanning with 1-second intervals
   - Asynchronous processing

2. **Transaction Processor**
   - Transaction type identification
   - Position analysis
   - Cache mechanism

3. **Notification System**
   - Telegram integration
   - Formatted messages
   - Error handling

## Use Cases

This bot is primarily used for:
1. Tracking successful traders' operations
2. Learning trading strategies
3. Getting real-time market insights
4. Analyzing whale behavior patterns

## Contributing

We welcome contributions! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

