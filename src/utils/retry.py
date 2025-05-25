import asyncio
import logging
from functools import wraps
from typing import Callable, Any, TypeVar, Awaitable
from src.config.settings import MAX_RETRIES, ERROR_WAIT_BASE

logger = logging.getLogger(__name__)

T = TypeVar('T')

def async_retry(
    max_retries: int = MAX_RETRIES,
    base_delay: float = ERROR_WAIT_BASE,
    exceptions: tuple = (Exception,)
) -> Callable[[Callable[..., Awaitable[T]]], Callable[..., Awaitable[T]]]:
    """
    Retry decorator for async functions
    
    Args:
        max_retries: Maximum number of retry attempts
        base_delay: Base delay between retries (exponential backoff)
        exceptions: Tuple of exceptions to catch
    
    Returns:
        Decorated function
    """
    def decorator(func: Callable[..., Awaitable[T]]) -> Callable[..., Awaitable[T]]:
        @wraps(func)
        async def wrapper(*args: Any, **kwargs: Any) -> T:
            last_exception = None
            
            for attempt in range(max_retries):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if attempt < max_retries - 1:
                        delay = base_delay * (2 ** attempt)  # Exponential backoff
                        logger.warning(
                            f"Attempt {attempt + 1}/{max_retries} failed for {func.__name__}. "
                            f"Retrying in {delay:.1f}s... Error: {str(e)}"
                        )
                        await asyncio.sleep(delay)
                    else:
                        logger.error(
                            f"All {max_retries} attempts failed for {func.__name__}. "
                            f"Final error: {str(e)}"
                        )
            
            if last_exception:
                raise last_exception
            return None  # Type checker appeasement
            
        return wrapper
    return decorator 