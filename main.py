import asyncio
import logging
from web3 import Web3
import requests
import time
from datetime import datetime
from typing import Optional, Dict, Set, Any
from telegram import Update
from telegram.ext import Application, CommandHandler, MessageHandler, filters, ContextTypes
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Configuration from environment variables
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
TELEGRAM_CHAT_ID = os.getenv('TELEGRAM_CHAT_ID')
ARBITRUM_RPC_URL = os.getenv('ARBITRUM_RPC_URL')
HYPERLIQUID_API_URL = os.getenv('HYPERLIQUID_API_URL')

# Validate required environment variables
if not all([TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, ARBITRUM_RPC_URL, HYPERLIQUID_API_URL]):
    raise ValueError("Missing required environment variables. Please check your .env file.")

# 配置日志
logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)
logger = logging.getLogger(__name__)

# 性能配置
CHECK_INTERVAL = 1  # 区块检查间隔（秒）
CACHE_DURATION = 60  # 缓存时长（秒）
MAX_RETRIES = 3  # 最大重试次数
ERROR_WAIT_BASE = 2  # 错误重试基础等待时间（秒）

# Token表情映射
TOKEN_EMOJIS = {'BTC': '₿', 'ETH': '⟠', 'SOL': '◎'}
POSITION_TIERS = [
    (1000000, '🐋 鲸鱼警报！这是个大户！'),
    (500000, '🦈 大佬级别！值得关注！'),
    (100000, '🐠 老手在此！')
]

class HyperliquidMonitor:
    def __init__(self):
        self.w3: Optional[Web3] = None
        self.application: Optional[Application] = None
        self.is_monitoring_active: bool = False
        self.last_monitored_block: int = 0
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.cache_timestamps: Dict[str, float] = {}
        self.known_fills: Set[str] = set()
        self.pending_blocks: Set[int] = set()
        self.target_address: str = ""  # 初始化为空字符串

    def init_web3(self) -> bool:
        try:
            self.w3 = Web3(Web3.HTTPProvider(ARBITRUM_RPC_URL))
            if self.w3.is_connected():
                logger.info("成功连接到 Arbitrum RPC!")
                return True
            logger.error("无法连接到 Arbitrum RPC")
            return False
        except Exception as e:
            logger.error(f"初始化 Web3 失败: {e}")
            return False

    async def get_cached_data(self, key: str, fetch_func, *args) -> Optional[Any]:
        current_time = time.time()
        if key in self.cache and current_time - self.cache_timestamps.get(key, 0) < CACHE_DURATION:
            return self.cache[key]

        try:
            data = await fetch_func(*args)
            if data:
                self.cache[key] = data
                self.cache_timestamps[key] = current_time
            return data
        except Exception as e:
            logger.error(f"获取数据失败 ({key}): {e}")
            return None

    async def fetch_user_fills(self, address: str) -> Optional[list]:
        try:
            response = requests.post(HYPERLIQUID_API_URL, json={"type": "userFills", "user": address})
            return response.json()
        except Exception as e:
            logger.error(f"获取用户交易记录失败: {e}")
            return None

    async def fetch_user_state(self, address: str) -> Optional[dict]:
        try:
            response = requests.post(HYPERLIQUID_API_URL, json={"type": "userState", "user": address})
            return {"user_state": response.json()}
        except Exception as e:
            logger.error(f"获取用户状态失败: {e}")
            return None

    def format_timestamp(self, timestamp_ms: int) -> str:
        return datetime.fromtimestamp(timestamp_ms / 1000).strftime('%Y-%m-%d %H:%M:%S')

    def get_position_tier(self, position_value: float) -> str:
        for threshold, message in POSITION_TIERS:
            if position_value > threshold:
                return message
        return ""

    async def format_trade_message(self, fill: dict, position_value: Optional[float] = None) -> str:
        try:
            side = fill.get('side', 'Unknown')
            is_close = fill.get('isClose', False)
            action_emoji = '📈 买入' if side == 'BUY' else '📉 卖出'
            if is_close:
                action_emoji = '💰 平空' if side == 'BUY' else '💰 平多'

            token = fill.get('coin', 'Unknown')
            amount = float(fill.get('sz', 0))
            price = float(fill.get('px', 0))
            value = amount * price

            message = (
                f"🚨 **大佬开始行动啦！**\n\n"
                f"💫 **操作详情**\n"
                f"▸ 动作：`{action_emoji}`\n"
                f"▸ 时间：`{self.format_timestamp(fill.get('time', 0))}`\n"
                f"▸ 数量：`{amount:.4f} {TOKEN_EMOJIS.get(token, '🪙')}`\n"
                f"▸ 币种：`{token}`\n"
                f"▸ 价格：`${price:,.2f}`\n"
                f"▸ 总值：`${value:,.2f}`\n"
            )

            if position_value is not None:
                message += f"\n📊 **当前持仓**：`${position_value:,.2f}`"
                tier_message = self.get_position_tier(position_value)
                if tier_message:
                    message += f"\n\n{tier_message}"

            return message
        except Exception as e:
            logger.error(f"格式化消息失败: {e}")
            return "🔔 发现新交易\n(格式化消息时出错)"

    async def process_block(self, block_num: int) -> bool:
        try:
            block = self.w3.eth.get_block(block_num, full_transactions=True)
            for tx in block.transactions:
                try:
                    # 检查交易的发送方和接收方
                    from_address = tx['from'].lower()
                    to_address = tx.get('to', '').lower() if tx.get('to') else ''
                    target = self.target_address.lower()
                    
                    if from_address == target or to_address == target:
                        logger.info(f"发现目标地址交易: {tx.get('hash', '').hex()}")
                        await self.process_new_transaction()
                        return True
                except Exception as e:
                    logger.error(f"处理交易时出错: {e}")
            return False
        except Exception as e:
            logger.error(f"处理区块 {block_num} 时出错: {e}")
            return False

    async def monitor_trades(self) -> None:
        if not self.w3 or not self.w3.is_connected():
            await self.send_notification("🚫 哎呀，连接不上区块链网络，请检查配置后重试~")
            self.is_monitoring_active = False
            return

        await self.send_notification(
            f"🎯 开始实时监控大佬的操作！\n"
            f"📍 监控地址：`{self.target_address}`\n"
            f"🔄 实时追踪中...\n\n"
            f"⏰ 每笔交易都会第一时间通知您！"
        )

        try:
            # 从当前区块开始监控，不再往回看
            self.last_monitored_block = self.w3.eth.block_number
            logger.info(f"开始监控，当前区块: {self.last_monitored_block}")

            while self.is_monitoring_active:
                try:
                    current_block = self.w3.eth.block_number
                    
                    # 如果有新区块
                    if current_block > self.last_monitored_block:
                        logger.info(f"检查新区块: {self.last_monitored_block + 1} 到 {current_block}")
                        
                        # 处理所有新区块
                        for block_num in range(self.last_monitored_block + 1, current_block + 1):
                            if await self.process_block(block_num):
                                logger.info(f"区块 {block_num} 发现目标地址交易")
                            self.last_monitored_block = block_num

                    # 短暂等待后继续检查
                    await asyncio.sleep(CHECK_INTERVAL)

                except Exception as e:
                    logger.error(f"监控过程中发生错误: {e}")
                    if await self.handle_error():
                        break

        except Exception as e:
            logger.error(f"初始化监控失败: {e}")
            await self.send_notification("😱 糟糕！监控系统出了点小问题，请稍后再试~")
            self.is_monitoring_active = False

    async def handle_error(self) -> bool:
        self.retry_count = getattr(self, 'retry_count', 0) + 1
        if self.retry_count >= MAX_RETRIES:
            await self.send_notification("⚠️ 连续多次发生错误，监控暂停。请使用 /monitor 重新启动。")
            self.is_monitoring_active = False
            return True
        wait_time = min(ERROR_WAIT_BASE * (2 ** self.retry_count), 60)
        await asyncio.sleep(wait_time)
        return False

    async def process_new_transaction(self):
        try:
            await asyncio.sleep(2)  # 增加等待时间，确保API数据同步
            
            # 获取最新交易记录
            fills = await self.get_cached_data(f"fills_{self.target_address}", self.fetch_user_fills, self.target_address)
            if not fills:
                logger.warning("未获取到交易记录")
                return

            # 获取最新的5条记录
            recent_fills = fills[:5]
            new_fills = [fill for fill in recent_fills if fill.get('hash') and fill.get('hash') not in self.known_fills]
            
            for fill in new_fills:
                tx_hash = fill.get('hash')
                if not tx_hash:
                    continue

                try:
                    # 获取用户状态
                    user_state = await self.get_cached_data(
                        f"state_{self.target_address}",
                        self.fetch_user_state,
                        self.target_address
                    )
                    
                    position_value = float(user_state['user_state'].get('position_value', 0)) if user_state else None
                    
                    # 格式化并发送消息
                    message = await self.format_trade_message(fill, position_value)
                    await self.send_notification(message)
                    
                    # 记录已处理的交易
                    self.known_fills.add(tx_hash)
                    self.retry_count = 0
                    
                    logger.info(f"成功处理交易: {tx_hash}")
                except Exception as e:
                    logger.error(f"处理交易 {tx_hash} 详情时出错: {e}")

        except Exception as e:
            logger.error(f"处理新交易时出错: {e}")

    async def send_notification(self, message: str) -> None:
        max_retries = 3
        retry_count = 0
        
        while retry_count < max_retries:
            try:
                if not self.application:
                    self.application = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
                    await self.application.initialize()
                    await self.application.start()

                # 清理消息中的特殊字符，确保 Markdown 格式正确
                cleaned_message = message.replace('`', '').replace('*', '')
                
                await self.application.bot.send_message(
                    chat_id=TELEGRAM_CHAT_ID,
                    text=cleaned_message,
                    parse_mode=None  # 暂时禁用 Markdown
                )
                logger.info("消息发送成功")
                return
            except Exception as e:
                retry_count += 1
                logger.error(f"发送消息失败 (尝试 {retry_count}/{max_retries}): {e}")
                if retry_count < max_retries:
                    # 如果失败，尝试不带格式发送
                    try:
                        await self.application.bot.send_message(
                            chat_id=TELEGRAM_CHAT_ID,
                            text=message.replace('`', '').replace('*', ''),
                            parse_mode=None
                        )
                        logger.info("消息发送成功（无格式）")
                        return
                    except Exception as backup_error:
                        logger.error(f"备用发送也失败: {backup_error}")
                        await asyncio.sleep(1)
        
        logger.error("发送消息最终失败")

    async def set_address_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """处理设置地址的命令"""
        try:
            # 检查是否提供了地址参数
            if not context.args or len(context.args) != 1:
                await update.message.reply_text(
                    "❌ 请提供要监控的地址！\n"
                    "📝 使用方法：/set_address 0x...\n"
                    "示例：/set_address 0x5b5d51203a0f9079f8aeb098a6523a13f298c060"
                )
                return

            address = context.args[0]
            
            # 验证地址格式
            if not self.is_valid_address(address):
                await update.message.reply_text(
                    "❌ 无效的地址格式！\n"
                    "请确保：\n"
                    "1. 地址以 0x 开头\n"
                    "2. 地址长度正确\n"
                    "3. 只包含有效的十六进制字符"
                )
                return

            # 如果正在监控，先停止
            if self.is_monitoring_active:
                self.is_monitoring_active = False
                await asyncio.sleep(1)  # 等待监控停止

            # 设置新地址
            self.target_address = address
            self.known_fills.clear()  # 清除旧的交易记录
            
            await update.message.reply_text(
                f"✅ 监控地址设置成功！\n\n"
                f"📍 当前监控地址：\n`{address}`\n\n"
                f"🎮 使用 /monitor 开始监控\n"
                f"🔍 使用 /status 查看当前状态"
            )

        except Exception as e:
            logger.error(f"设置地址时出错: {e}")
            await update.message.reply_text("❌ 设置地址时出错，请重试！")

    async def status_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """查看当前监控状态"""
        try:
            status_message = (
                "📊 当前监控状态\n\n"
                f"📍 监控地址：\n`{self.target_address or '未设置'}`\n\n"
                f"▸ 监控状态：{'🟢 运行中' if self.is_monitoring_active else '🔴 未运行'}\n"
                f"▸ 最新区块：{self.last_monitored_block}\n"
                f"▸ 缓存交易数：{len(self.known_fills)}"
            )
            await update.message.reply_text(status_message)
        except Exception as e:
            logger.error(f"获取状态时出错: {e}")
            await update.message.reply_text("❌ 获取状态信息时出错，请重试！")

    async def monitor_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        """处理开始监控的命令"""
        try:
            # 检查是否已设置地址
            if not self.target_address:
                await update.message.reply_text(
                    "❌ 请先设置要监控的地址！\n"
                    "📝 使用方法：/set_address 0x...\n"
                    "示例：/set_address 0x5b5d51203a0f9079f8aeb098a6523a13f298c060"
                )
                return

            if not self.is_monitoring_active:
                self.is_monitoring_active = True
                asyncio.create_task(self.monitor_trades())
                message = (
                    "🎯 监控已启动！\n"
                    f"📍 监控地址：\n`{self.target_address}`\n"
                    "📱 实时追踪大佬操作\n"
                    "⚡️ 第一时间获取通知\n"
                    "🔔 建议打开通知提醒"
                )
                await update.message.reply_text(message)
            else:
                await update.message.reply_text(
                    "😊 监控已经在运行啦，请放心等待大佬操作~\n"
                    f"📍 当前监控地址：\n`{self.target_address}`"
                )
        except Exception as e:
            logger.error(f"处理 monitor 命令时出错: {e}")
            await update.message.reply_text("🎯 正在启动监控...")

    async def start_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        try:
            user_name = update.effective_user.first_name if update.effective_user else "朋友"
            message = (
                f"👋 你好呀, {user_name}！\n\n"
                f"🤖 我是您的贴心监控助手，专门帮您追踪大佬的操作！\n\n"
                f"📍 当前监控地址：\n`{self.target_address or '未设置'}`\n\n"
                f"📝 使用说明：\n"
                f"1️⃣ /set_address - 设置监控地址\n"
                f"2️⃣ /monitor - 开始监控\n"
                f"3️⃣ /stop_monitor - 停止监控\n"
                f"4️⃣ /status - 查看当前状态\n"
                f"❓ /help - 获取帮助\n\n"
                f"🎯 让我们一起跟随大佬的脚步吧！"
            )
            await update.message.reply_text(message)
        except Exception as e:
            logger.error(f"处理 start 命令时出错: {e}")
            try:
                await update.message.reply_text("👋 欢迎使用监控助手！输入 /help 获取帮助。")
            except Exception as backup_error:
                logger.error(f"发送备用欢迎消息也失败: {backup_error}")

    async def help_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        try:
            message = (
                "🎮 指令列表\n\n"
                "▸ /start - 👋 初次见面\n"
                "▸ /set_address - 📝 设置监控地址\n"
                "▸ /monitor - 🎯 开始监控\n"
                "▸ /stop_monitor - ⏹ 停止监控\n"
                "▸ /status - 📊 查看当前状态\n\n"
                "📝 使用说明\n"
                "1. 首先使用 /set_address 设置要监控的地址\n"
                "2. 然后使用 /monitor 开始监控\n"
                "3. 监控开启后，大佬的每一笔交易都会实时通知您！\n\n"
                "💡 温馨提示\n"
                "建议打开通知提醒，不错过任何操作～"
            )
            await update.message.reply_text(message)
        except Exception as e:
            logger.error(f"处理 help 命令时出错: {e}")
            try:
                await update.message.reply_text("❓ 可用命令：/start, /set_address, /monitor, /stop_monitor, /status")
            except Exception as backup_error:
                logger.error(f"发送备用帮助消息也失败: {backup_error}")

    async def stop_monitor_command(self, update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
        try:
            if self.is_monitoring_active:
                self.is_monitoring_active = False
                message = (
                    "⏹ 监控已停止\n"
                    "👋 随时等您回来！\n"
                    "🎮 使用 /monitor 重新开启"
                )
                await update.message.reply_text(message)
            else:
                await update.message.reply_text("😅 监控本来就没开启呢，使用 /monitor 开始监控吧！")
        except Exception as e:
            logger.error(f"处理 stop_monitor 命令时出错: {e}")
            await update.message.reply_text("⏹ 正在停止监控...")

    def is_valid_address(self, address: str) -> bool:
        """验证地址格式是否正确"""
        try:
            # 检查地址长度和格式
            if not address.startswith('0x'):
                return False
            # 验证是否为有效的以太坊地址
            return Web3.is_address(address)
        except Exception:
            return False

    def run(self):
        if not self.init_web3():
            logger.critical("无法连接到区块链，请检查配置。")
            return

        self.application = Application.builder().token(TELEGRAM_BOT_TOKEN).build()
        
        # 添加命令处理器
        self.application.add_handler(CommandHandler("start", self.start_command))
        self.application.add_handler(CommandHandler("help", self.help_command))
        self.application.add_handler(CommandHandler("monitor", self.monitor_command))
        self.application.add_handler(CommandHandler("stop_monitor", self.stop_monitor_command))
        self.application.add_handler(CommandHandler("set_address", self.set_address_command))
        self.application.add_handler(CommandHandler("status", self.status_command))
        self.application.add_handler(MessageHandler(filters.COMMAND, self.help_command))

        logger.info("Telegram Bot 启动中...")
        self.application.run_polling(allowed_updates=Update.ALL_TYPES)

def main():
    monitor = HyperliquidMonitor()
    monitor.run()

if __name__ == "__main__":
    main()