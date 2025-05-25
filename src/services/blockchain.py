from web3 import Web3
import logging
from typing import Optional, Dict, Any
import requests
from src.config.settings import ARBITRUM_RPC_URL, HYPERLIQUID_API_URL

logger = logging.getLogger(__name__)

class BlockchainService:
    def __init__(self):
        self.w3: Optional[Web3] = None
        self.init_web3()

    def init_web3(self) -> bool:
        """Initialize Web3 connection"""
        try:
            self.w3 = Web3(Web3.HTTPProvider(ARBITRUM_RPC_URL))
            if self.w3.is_connected():
                logger.info("Successfully connected to Arbitrum RPC!")
                return True
            logger.error("Unable to connect to Arbitrum RPC")
            return False
        except Exception as e:
            logger.error(f"Failed to initialize Web3: {e}")
            return False

    def is_valid_address(self, address: str) -> bool:
        """Validate Ethereum address format"""
        try:
            if not address.startswith('0x'):
                return False
            return Web3.is_address(address)
        except Exception:
            return False

    async def get_block(self, block_num: int) -> Optional[Dict[str, Any]]:
        """Get block details"""
        try:
            if not self.w3:
                raise ValueError("Web3 not initialized")
            return self.w3.eth.get_block(block_num, full_transactions=True)
        except Exception as e:
            logger.error(f"Error getting block {block_num}: {e}")
            return None

    async def get_latest_block_number(self) -> Optional[int]:
        """Get latest block number"""
        try:
            if not self.w3:
                raise ValueError("Web3 not initialized")
            return self.w3.eth.block_number
        except Exception as e:
            logger.error(f"Error getting latest block number: {e}")
            return None

    @staticmethod
    async def fetch_user_fills(address: str) -> Optional[list]:
        """Fetch user's trading history"""
        try:
            response = requests.post(
                HYPERLIQUID_API_URL,
                json={"type": "userFills", "user": address}
            )
            return response.json()
        except Exception as e:
            logger.error(f"Failed to fetch user fills: {e}")
            return None

    @staticmethod
    async def fetch_user_state(address: str) -> Optional[dict]:
        """Fetch user's current state"""
        try:
            response = requests.post(
                HYPERLIQUID_API_URL,
                json={"type": "userState", "user": address}
            )
            return {"user_state": response.json()}
        except Exception as e:
            logger.error(f"Failed to fetch user state: {e}")
            return None 