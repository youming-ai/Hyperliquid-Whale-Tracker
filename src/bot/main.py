import asyncio
import logging
from telegram import Update
from telegram.ext import (
    Application,
    CommandHandler,
    ContextTypes,
    MessageHandler,
    filters
)

from src.config.settings import (
    TELEGRAM_BOT_TOKEN,
    TELEGRAM_CHAT_ID,
    validate_config
)
from src.services.blockchain import BlockchainService
from src.services.message_handler import MessageHandler
from src.services.cache_service import CacheService
from src.utils.retry import async_retry

# Configure logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

class WhaleTrackerBot:
    def __init__(self):
        self.blockchain_service = BlockchainService()
        self.message_handler = MessageHandler()
        self.cache_service = CacheService()
        self.target_address = None
        self.is_monitoring = False
        self.last_block = 0

    async def start(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle /start command"""
        user_name = update.effective_user.first_name
        message = self.message_handler.format_start_message(user_name, self.target_address)
        await update.message.reply_text(message, parse_mode='Markdown')

    async def help_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle /help command"""
        message = self.message_handler.format_help_message()
        await update.message.reply_text(message)

    async def set_address(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle /set_address command"""
        try:
            address = context.args[0] if context.args else None
            if not address:
                await update.message.reply_text(
                    "❌ Please provide an address:\n/set_address <wallet_address>"
                )
                return

            if not self.blockchain_service.is_valid_address(address):
                await update.message.reply_text("❌ Invalid Ethereum address format!")
                return

            self.target_address = address
            await update.message.reply_text(
                f"✅ Successfully set monitoring address:\n`{address}`",
                parse_mode='Markdown'
            )
        except Exception as e:
            logger.error(f"Error setting address: {e}")
            await update.message.reply_text("❌ Error setting address. Please try again.")

    @async_retry()
    async def monitor_trades(self) -> None:
        """Monitor trades for the target address"""
        while self.is_monitoring:
            try:
                # Get latest block
                current_block = await self.blockchain_service.get_latest_block_number()
                if not current_block or current_block <= self.last_block:
                    await asyncio.sleep(1)
                    continue

                # Get user fills
                fills = await self.cache_service.get_cached_data(
                    f"fills_{self.target_address}",
                    self.blockchain_service.fetch_user_fills,
                    self.target_address
                )

                if fills:
                    # Get user state for position info
                    state = await self.cache_service.get_cached_data(
                        f"state_{self.target_address}",
                        self.blockchain_service.fetch_user_state,
                        self.target_address
                    )

                    position_value = float(state.get('position_value', 0)) if state else None

                    # Format and send message
                    message = await self.message_handler.format_trade_message(fills[0], position_value)
                    await self.send_telegram_message(message)

                self.last_block = current_block

            except Exception as e:
                logger.error(f"Error in monitor_trades: {e}")
                await asyncio.sleep(5)

    async def start_monitor(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle /monitor command"""
        if not self.target_address:
            await update.message.reply_text(
                "❌ Please set an address first using /set_address"
            )
            return

        if self.is_monitoring:
            await update.message.reply_text("🔄 Monitoring is already active!")
            return

        self.is_monitoring = True
        await update.message.reply_text(
            f"✅ Started monitoring address:\n`{self.target_address}`",
            parse_mode='Markdown'
        )
        asyncio.create_task(self.monitor_trades())

    async def stop_monitor(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle /stop_monitor command"""
        if not self.is_monitoring:
            await update.message.reply_text("❌ Monitoring is not active!")
            return

        self.is_monitoring = False
        await update.message.reply_text("✅ Stopped monitoring!")

    async def status(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """Handle /status command"""
        message = self.message_handler.format_status_message(
            self.target_address,
            self.is_monitoring,
            self.last_block,
            self.cache_service.get_cache_size()
        )
        await update.message.reply_text(message, parse_mode='Markdown')

    @staticmethod
    async def send_telegram_message(message: str) -> None:
        """Send message to Telegram chat"""
        async with Application.builder().token(TELEGRAM_BOT_TOKEN).build() as app:
            await app.bot.send_message(
                chat_id=TELEGRAM_CHAT_ID,
                text=message,
                parse_mode='Markdown'
            )

async def main() -> None:
    """Start the bot"""
    try:
        # Validate configuration
        validate_config()

        # Initialize bot
        bot = WhaleTrackerBot()
        app = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

        # Add command handlers
        app.add_handler(CommandHandler("start", bot.start))
        app.add_handler(CommandHandler("help", bot.help_command))
        app.add_handler(CommandHandler("set_address", bot.set_address))
        app.add_handler(CommandHandler("monitor", bot.start_monitor))
        app.add_handler(CommandHandler("stop_monitor", bot.stop_monitor))
        app.add_handler(CommandHandler("status", bot.status))

        # Start polling
        await app.run_polling(allowed_updates=Update.ALL_TYPES)

    except Exception as e:
        logger.error(f"Error starting bot: {e}")
        raise

if __name__ == "__main__":
    asyncio.run(main()) 