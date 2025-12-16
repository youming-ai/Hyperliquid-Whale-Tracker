import { createFileRoute, Link } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

export const Route = createFileRoute('/strategies/')({
    component: StrategiesPage,
})

// Mock strategies data
const mockStrategies = [
    {
        id: '1',
        name: 'BTC Whale Follow',
        targetAddress: '0x1234...5678',
        status: 'ACTIVE',
        allocation: 5000,
        pnl: 1250,
        startDate: '2024-12-01',
    },
    {
        id: '2',
        name: 'ETH Scalper Copy',
        targetAddress: '0x2345...6789',
        status: 'PAUSED',
        allocation: 3000,
        pnl: -320,
        startDate: '2024-12-05',
    },
    {
        id: '3',
        name: 'Multi-Asset Alpha',
        targetAddress: '0x3456...789a',
        status: 'ACTIVE',
        allocation: 10000,
        pnl: 4500,
        startDate: '2024-11-15',
    },
]

function StrategiesPage() {
    const { data: strategies, isLoading } = useQuery({
        queryKey: ['strategies', 'list'],
        queryFn: async () => {
            await new Promise(resolve => setTimeout(resolve, 300))
            return mockStrategies
        },
    })

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-3xl font-bold">Copy Trading Strategies</h1>
                    <p className="text-sm opacity-60 mt-1">Manage your automated copy trading strategies</p>
                </div>
                <Link
                    to="/strategies/new"
                    className="px-4 py-2 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] text-sm font-medium hover:opacity-90 transition-opacity"
                >
                    + New Strategy
                </Link>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-6">
                    <p className="text-sm opacity-60 mb-1">Total Allocation</p>
                    <p className="text-2xl font-bold">$18,000</p>
                </div>
                <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-6">
                    <p className="text-sm opacity-60 mb-1">Total PnL</p>
                    <p className="text-2xl font-bold text-success">+$5,430</p>
                </div>
                <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-6">
                    <p className="text-sm opacity-60 mb-1">Active Strategies</p>
                    <p className="text-2xl font-bold">2 / 3</p>
                </div>
            </div>

            {/* Strategies List */}
            {isLoading ? (
                <div className="text-center py-12 opacity-60">Loading strategies...</div>
            ) : (
                <div className="space-y-4">
                    {strategies?.map((strategy) => (
                        <div
                            key={strategy.id}
                            className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-6 flex items-center justify-between hover:border-[hsl(var(--primary))] transition-colors"
                        >
                            <div className="flex items-center gap-6">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold">{strategy.name}</h3>
                                        <span className={`px-2 py-0.5 text-xs rounded-full ${strategy.status === 'ACTIVE'
                                                ? 'bg-green-500/20 text-green-500'
                                                : 'bg-yellow-500/20 text-yellow-500'
                                            }`}>
                                            {strategy.status}
                                        </span>
                                    </div>
                                    <p className="text-sm opacity-60 mt-1">
                                        Copying: <span className="font-mono">{strategy.targetAddress}</span>
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-8">
                                <div className="text-right">
                                    <p className="text-sm opacity-60">Allocation</p>
                                    <p className="font-medium">${strategy.allocation.toLocaleString()}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm opacity-60">PnL</p>
                                    <p className={`font-medium ${strategy.pnl >= 0 ? 'text-success' : 'text-destructive'}`}>
                                        {strategy.pnl >= 0 ? '+' : ''}${strategy.pnl.toLocaleString()}
                                    </p>
                                </div>
                                <div className="flex gap-2">
                                    <Link
                                        to="/strategies/$id"
                                        params={{ id: strategy.id }}
                                        className="px-3 py-1.5 text-sm rounded-md border border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))] transition-colors"
                                    >
                                        View
                                    </Link>
                                    <button className="px-3 py-1.5 text-sm rounded-md border border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))] transition-colors">
                                        {strategy.status === 'ACTIVE' ? 'Pause' : 'Resume'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
