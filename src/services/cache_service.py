import time
from typing import Dict, Any, Optional, Callable, Awaitable
import logging
from src.config.settings import CACHE_DURATION

logger = logging.getLogger(__name__)

class CacheService:
    def __init__(self):
        self.cache: Dict[str, Dict[str, Any]] = {}
        self.cache_timestamps: Dict[str, float] = {}

    async def get_cached_data(
        self,
        key: str,
        fetch_func: Callable[..., Awaitable[Any]],
        *args,
        **kwargs
    ) -> Optional[Any]:
        """
        Get data from cache or fetch and cache it if not available
        
        Args:
            key: Cache key
            fetch_func: Async function to fetch data if not in cache
            args: Arguments for fetch_func
            kwargs: Keyword arguments for fetch_func
        
        Returns:
            Cached or freshly fetched data
        """
        current_time = time.time()
        
        # Return cached data if valid
        if key in self.cache and current_time - self.cache_timestamps.get(key, 0) < CACHE_DURATION:
            return self.cache[key]

        try:
            # Fetch new data
            data = await fetch_func(*args, **kwargs)
            if data:
                self.cache[key] = data
                self.cache_timestamps[key] = current_time
            return data
        except Exception as e:
            logger.error(f"Failed to get data ({key}): {e}")
            return None

    def clear_cache(self, key: Optional[str] = None) -> None:
        """
        Clear cache for specific key or all cache
        
        Args:
            key: Specific cache key to clear, or None to clear all
        """
        if key:
            self.cache.pop(key, None)
            self.cache_timestamps.pop(key, None)
        else:
            self.cache.clear()
            self.cache_timestamps.clear()

    def get_cache_size(self) -> int:
        """Get number of items in cache"""
        return len(self.cache)

    def cleanup_expired(self) -> None:
        """Remove expired cache entries"""
        current_time = time.time()
        expired_keys = [
            key for key, timestamp in self.cache_timestamps.items()
            if current_time - timestamp >= CACHE_DURATION
        ]
        
        for key in expired_keys:
            self.clear_cache(key) 