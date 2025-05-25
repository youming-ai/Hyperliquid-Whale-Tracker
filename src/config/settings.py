import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Telegram Configuration
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID')

# Blockchain Configuration
ARBITRUM_RPC_URL = os.getenv('ARBITRUM_RPC_URL')
HYPERLIQUID_API_URL = os.getenv('HYPERLIQUID_API_URL')

# Performance Configuration
CHECK_INTERVAL = 1  # Block check interval (seconds)
CACHE_DURATION = 60  # Cache duration (seconds)
MAX_RETRIES = 3  # Maximum retry attempts
ERROR_WAIT_BASE = 2  # Base wait time for error retry (seconds)

# Token Emojis
TOKEN_EMOJIS = {
    'BTC': '₿',
    'ETH': '⟠',
    'SOL': '◎'
}

# Position Tiers
POSITION_TIERS = [
    (1000000, '🐋 Whale Alert! Big player detected!'),
    (500000, '🦈 Major player! Worth following!'),
    (100000, '🐠 Experienced trader here!')
]

# Validate required environment variables
def validate_config():
    required_vars = [
        'TELEGRAM_BOT_TOKEN',
        'TELEGRAM_CHAT_ID',
        'ARBITRUM_RPC_URL',
        'HYPERLIQUID_API_URL'
    ]
    
    missing_vars = [var for var in required_vars 
                   if not globals().get(var)]
    
    if missing_vars:
        raise ValueError(
            f"Missing required environment variables: {', '.join(missing_vars)}\n"
            "Please check your .env file."
        ) 