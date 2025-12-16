import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { z } from 'zod'
import { useState } from 'react'

export const Route = createFileRoute('/strategies/new')({
    component: NewStrategyPage,
})

const strategySchema = z.object({
    name: z.string().min(1, 'Strategy name is required'),
    targetTrader: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address'),
    allocationAmount: z.number().min(100, 'Minimum allocation is $100'),
    leverage: z.number().min(1).max(20),
    maxDailyLoss: z.number().min(1).max(50),
    stopLossPercent: z.number().min(1).max(50),
    takeProfitPercent: z.number().min(1).max(100),
    copyMode: z.enum(['PROPORTIONAL', 'FIXED', 'MIRROR']),
})

type StrategyFormData = z.infer<typeof strategySchema>

function NewStrategyPage() {
    const navigate = useNavigate()
    const [isSubmitting, setIsSubmitting] = useState(false)

    const [formData, setFormData] = useState<StrategyFormData>({
        name: '',
        targetTrader: '',
        allocationAmount: 1000,
        leverage: 3,
        maxDailyLoss: 5,
        stopLossPercent: 10,
        takeProfitPercent: 20,
        copyMode: 'PROPORTIONAL',
    })

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setIsSubmitting(true)

        try {
            const validated = strategySchema.parse(formData)
            console.log('Creating strategy:', validated)
            // In real app, call API here
            await new Promise(resolve => setTimeout(resolve, 500))
            navigate({ to: '/strategies' })
        } catch (error) {
            console.error('Validation error:', error)
        } finally {
            setIsSubmitting(false)
        }
    }

    const updateField = <K extends keyof StrategyFormData>(
        field: K,
        value: StrategyFormData[K]
    ) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    return (
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <h1 className="text-2xl font-bold mb-8">Create New Strategy</h1>

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Strategy Name */}
                <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-6">
                    <h2 className="text-lg font-semibold mb-4">Basic Info</h2>

                    <div className="mb-4">
                        <label className="block text-sm font-medium mb-2">Strategy Name</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => updateField('name', e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                            placeholder="e.g., BTC Whale Follow"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium mb-2">Target Trader Address</label>
                        <input
                            type="text"
                            value={formData.targetTrader}
                            onChange={(e) => updateField('targetTrader', e.target.value)}
                            className="w-full px-4 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                            placeholder="0x..."
                        />
                    </div>
                </div>

                {/* Allocation & Leverage */}
                <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-6">
                    <h2 className="text-lg font-semibold mb-4">Capital Settings</h2>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Allocation (USDC)</label>
                            <input
                                type="number"
                                value={formData.allocationAmount}
                                onChange={(e) => updateField('allocationAmount', Number(e.target.value))}
                                className="w-full px-4 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Max Leverage</label>
                            <input
                                type="number"
                                value={formData.leverage}
                                onChange={(e) => updateField('leverage', Number(e.target.value))}
                                min={1}
                                max={20}
                                className="w-full px-4 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                            />
                        </div>
                    </div>

                    <div className="mt-4">
                        <label className="block text-sm font-medium mb-2">Copy Mode</label>
                        <select
                            value={formData.copyMode}
                            onChange={(e) => updateField('copyMode', e.target.value as 'PROPORTIONAL' | 'FIXED' | 'MIRROR')}
                            className="w-full px-4 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                        >
                            <option value="PROPORTIONAL">Proportional - Scale based on allocation</option>
                            <option value="FIXED">Fixed - Use fixed position sizes</option>
                            <option value="MIRROR">Mirror - Copy exact positions</option>
                        </select>
                    </div>
                </div>

                {/* Risk Management */}
                <div className="bg-[hsl(var(--card))] border border-[hsl(var(--border))] rounded-xl p-6">
                    <h2 className="text-lg font-semibold mb-4">Risk Management</h2>

                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium mb-2">Max Daily Loss (%)</label>
                            <input
                                type="number"
                                value={formData.maxDailyLoss}
                                onChange={(e) => updateField('maxDailyLoss', Number(e.target.value))}
                                min={1}
                                max={50}
                                className="w-full px-4 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Stop Loss (%)</label>
                            <input
                                type="number"
                                value={formData.stopLossPercent}
                                onChange={(e) => updateField('stopLossPercent', Number(e.target.value))}
                                min={1}
                                max={50}
                                className="w-full px-4 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium mb-2">Take Profit (%)</label>
                            <input
                                type="number"
                                value={formData.takeProfitPercent}
                                onChange={(e) => updateField('takeProfitPercent', Number(e.target.value))}
                                min={1}
                                max={100}
                                className="w-full px-4 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--background))] focus:outline-none focus:ring-2 focus:ring-[hsl(var(--primary))]"
                            />
                        </div>
                    </div>
                </div>

                {/* Submit */}
                <div className="flex gap-4">
                    <button
                        type="button"
                        onClick={() => navigate({ to: '/strategies' })}
                        className="flex-1 px-4 py-3 rounded-lg border border-[hsl(var(--border))] font-medium hover:bg-[hsl(var(--accent))] transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 px-4 py-3 rounded-lg bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                        {isSubmitting ? 'Creating...' : 'Create Strategy'}
                    </button>
                </div>
            </form>
        </div>
    )
}
