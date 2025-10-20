export function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(1)}K`;
  }
  if (amount >= 0.01) {
    return `$${amount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
  return `$${amount.toFixed(8)}`;
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) {
    return `${(num / 1_000_000).toFixed(1)}M`;
  }
  if (num >= 1_000) {
    return `${(num / 1_000).toFixed(1)}K`;
  }
  if (num >= 1) {
    return num.toLocaleString();
  }
  return num.toFixed(2);
}

export function formatPercentage(value: number): string {
  return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();

  if (diffMs < 60000) { // Less than 1 minute
    return 'Just now';
  }
  if (diffMs < 3600000) { // Less than 1 hour
    const minutes = Math.floor(diffMs / 60000);
    return `${minutes}m ago`;
  }
  if (diffMs < 86400000) { // Less than 1 day
    const hours = Math.floor(diffMs / 3600000);
    return `${hours}h ago`;
  }

  return date.toLocaleDateString();
}

export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

export function formatLeverage(leverage: number): string {
  return `${leverage.toFixed(1)}x`;
}
