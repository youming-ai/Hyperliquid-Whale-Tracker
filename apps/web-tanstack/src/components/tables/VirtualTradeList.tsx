import { useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { cn } from '../../lib/utils'

interface Trade {
    id: string
    symbol: string
    side: 'LONG' | 'SHORT'
    size: number
    price: number
    time: string
    pnl: number
}

interface VirtualTradeListProps {
    trades: Trade[]
    height?: number
}

export function VirtualTradeList({ trades, height = 400 }: VirtualTradeListProps) {
    const parentRef = useRef<HTMLDivElement>(null)

    const virtualizer = useVirtualizer({
        count: trades.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 52, // Estimated row height
        overscan: 10, // Number of items to render outside of the visible area
    })

    const items = virtualizer.getVirtualItems()

    return (
        <div>
            {/* Header */}
            <div className="grid grid-cols-6 gap-4 px-4 py-3 text-sm font-medium opacity-60 border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))] rounded-t-lg">
                <div>Symbol</div>
                <div>Side</div>
                <div className="text-right">Size</div>
                <div className="text-right">Price</div>
                <div className="text-right">Time</div>
                <div className="text-right">PnL</div>
            </div>

            {/* Virtual List Container */}
            <div
                ref={parentRef}
                className="overflow-auto rounded-b-lg border border-t-0 border-[hsl(var(--border))]"
                style={{ height }}
            >
                <div
                    style={{
                        height: virtualizer.getTotalSize(),
                        width: '100%',
                        position: 'relative',
                    }}
                >
                    {items.map((virtualRow) => {
                        const trade = trades[virtualRow.index]
                        return (
                            <div
                                key={trade.id}
                                className={cn(
                                    'absolute top-0 left-0 w-full grid grid-cols-6 gap-4 px-4 py-3 items-center border-b border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))] transition-colors',
                                    virtualRow.index % 2 === 0 ? 'bg-[hsl(var(--card))]' : 'bg-[hsl(var(--background))]'
                                )}
                                style={{
                                    height: virtualRow.size,
                                    transform: `translateY(${virtualRow.start}px)`,
                                }}
                            >
                                <div className="font-medium">{trade.symbol}</div>
                                <div className={trade.side === 'LONG' ? 'text-success' : 'text-destructive'}>
                                    {trade.side}
                                </div>
                                <div className="text-right">{trade.size}</div>
                                <div className="text-right">${trade.price.toLocaleString()}</div>
                                <div className="text-right opacity-60">{trade.time}</div>
                                <div className={cn(
                                    'text-right font-medium',
                                    trade.pnl >= 0 ? 'text-success' : 'text-destructive'
                                )}>
                                    {trade.pnl >= 0 ? '+' : ''}${trade.pnl.toLocaleString()}
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            {/* Stats */}
            <div className="mt-2 text-sm opacity-60 text-right">
                Showing {trades.length.toLocaleString()} trades (virtualized)
            </div>
        </div>
    )
}

// Helper to generate mock trades for testing
export function generateMockTrades(count: number): Trade[] {
    const symbols = ['BTC-PERP', 'ETH-PERP', 'SOL-PERP', 'ARB-PERP', 'OP-PERP', 'AVAX-PERP']
    const sides: ('LONG' | 'SHORT')[] = ['LONG', 'SHORT']

    return Array.from({ length: count }, (_, i) => ({
        id: `trade-${i}`,
        symbol: symbols[Math.floor(Math.random() * symbols.length)],
        side: sides[Math.floor(Math.random() * sides.length)],
        size: Number((Math.random() * 10).toFixed(2)),
        price: Number((30000 + Math.random() * 20000).toFixed(2)),
        time: `${Math.floor(Math.random() * 24)}h ago`,
        pnl: Number(((Math.random() - 0.4) * 2000).toFixed(0)),
    }))
}
