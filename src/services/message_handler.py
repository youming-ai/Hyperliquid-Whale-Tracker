import logging
from datetime import datetime
from typing import Optional
from src.config.settings import TOKEN_EMOJIS, POSITION_TIERS

logger = logging.getLogger(__name__)

class MessageHandler:
    @staticmethod
    def format_timestamp(timestamp_ms: int) -> str:
        """Format timestamp to human readable format"""
        return datetime.fromtimestamp(timestamp_ms / 1000).strftime('%Y-%m-%d %H:%M:%S')

    @staticmethod
    def get_position_tier(position_value: float) -> str:
        """Get position tier message based on value"""
        for threshold, message in POSITION_TIERS:
            if position_value > threshold:
                return message
        return ""

    @classmethod
    async def format_trade_message(cls, fill: dict, position_value: Optional[float] = None) -> str:
        """Format trade details into readable message"""
        try:
            side = fill.get('side', 'Unknown')
            is_close = fill.get('isClose', False)
            action_emoji = '📈 Buy' if side == 'BUY' else '📉 Sell'
            if is_close:
                action_emoji = '💰 Close Short' if side == 'BUY' else '💰 Close Long'

            token = fill.get('coin', 'Unknown')
            amount = float(fill.get('sz', 0))
            price = float(fill.get('px', 0))
            value = amount * price

            message = (
                f"🚨 **Whale Activity Detected!**\n\n"
                f"💫 **Trade Details**\n"
                f"▸ Action: `{action_emoji}`\n"
                f"▸ Time: `{cls.format_timestamp(fill.get('time', 0))}`\n"
                f"▸ Amount: `{amount:.4f} {TOKEN_EMOJIS.get(token, '🪙')}`\n"
                f"▸ Token: `{token}`\n"
                f"▸ Price: `${price:,.2f}`\n"
                f"▸ Value: `${value:,.2f}`\n"
            )

            if position_value is not None:
                message += f"\n📊 **Current Position**: `${position_value:,.2f}`"
                tier_message = cls.get_position_tier(position_value)
                if tier_message:
                    message += f"\n\n{tier_message}"

            return message
        except Exception as e:
            logger.error(f"Error formatting message: {e}")
            return "🔔 New trade detected\n(Error formatting message)"

    @staticmethod
    def format_start_message(user_name: str, target_address: str) -> str:
        """Format welcome message"""
        return (
            f"👋 Hello, {user_name}!\n\n"
            f"🤖 I'm your monitoring assistant, helping you track whale activities!\n\n"
            f"📍 Current monitoring address:\n`{target_address or 'Not set'}`\n\n"
            f"📝 Commands:\n"
            f"1️⃣ /set_address - Set monitoring address\n"
            f"2️⃣ /monitor - Start monitoring\n"
            f"3️⃣ /stop_monitor - Stop monitoring\n"
            f"4️⃣ /status - Check current status\n"
            f"❓ /help - Get help\n\n"
            f"🎯 Let's follow the whales together!"
        )

    @staticmethod
    def format_help_message() -> str:
        """Format help message"""
        return (
            "🎮 Command List\n\n"
            "▸ /start - 👋 First meeting\n"
            "▸ /set_address - 📝 Set monitoring address\n"
            "▸ /monitor - 🎯 Start monitoring\n"
            "▸ /stop_monitor - ⏹ Stop monitoring\n"
            "▸ /status - 📊 Check current status\n\n"
            "📝 Instructions\n"
            "1. First use /set_address to set the address to monitor\n"
            "2. Then use /monitor to start monitoring\n"
            "3. You'll be notified of every trade in real-time!\n\n"
            "💡 Tips\n"
            "Enable notifications to not miss any updates!"
        )

    @staticmethod
    def format_status_message(target_address: str, is_monitoring_active: bool,
                            last_block: int, cache_size: int) -> str:
        """Format status message"""
        return (
            "📊 Current Status\n\n"
            f"📍 Monitoring Address:\n`{target_address or 'Not set'}`\n\n"
            f"▸ Status: {'🟢 Running' if is_monitoring_active else '🔴 Stopped'}\n"
            f"▸ Latest Block: {last_block}\n"
            f"▸ Cached Trades: {cache_size}"
        ) 