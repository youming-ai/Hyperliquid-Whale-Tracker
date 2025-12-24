import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import type { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../../components/tables/DataTable';
import { formatCompactNumber, formatPnL, shortenAddress } from '../../lib/utils';

export const Route = createFileRoute('/traders/')({
  component: TradersPage,
});

// Trader type definition
interface Trader {
  address: string;
  pnl7d: number;
  winRate: number;
  trades: number;
  volume: number;
  sharpe: number;
}

// Mock traders data
const mockTraders: Trader[] = [
  {
    address: '0x1234567890abcdef1234567890abcdef12345678',
    pnl7d: 125000,
    winRate: 68.5,
    trades: 1240,
    volume: 2500000,
    sharpe: 2.4,
  },
  {
    address: '0x2345678901abcdef2345678901abcdef23456789',
    pnl7d: 98000,
    winRate: 72.3,
    trades: 980,
    volume: 1800000,
    sharpe: 2.1,
  },
  {
    address: '0x3456789012abcdef3456789012abcdef34567890',
    pnl7d: 85000,
    winRate: 65.2,
    trades: 2100,
    volume: 3200000,
    sharpe: 1.8,
  },
  {
    address: '0x456789012abcdef3456789012abcdef345678901',
    pnl7d: -15000,
    winRate: 45.2,
    trades: 560,
    volume: 890000,
    sharpe: -0.3,
  },
  {
    address: '0x56789012abcdef3456789012abcdef3456789012',
    pnl7d: 72000,
    winRate: 61.8,
    trades: 1890,
    volume: 2100000,
    sharpe: 1.6,
  },
  {
    address: '0x6789012abcdef3456789012abcdef34567890123',
    pnl7d: 55000,
    winRate: 58.2,
    trades: 1450,
    volume: 1750000,
    sharpe: 1.4,
  },
  {
    address: '0x789012abcdef3456789012abcdef345678901234',
    pnl7d: 42000,
    winRate: 55.5,
    trades: 2200,
    volume: 2800000,
    sharpe: 1.2,
  },
  {
    address: '0x89012abcdef3456789012abcdef3456789012345',
    pnl7d: -8000,
    winRate: 48.1,
    trades: 890,
    volume: 1100000,
    sharpe: -0.1,
  },
];

// Define columns for TanStack Table
const columns: ColumnDef<Trader>[] = [
  {
    accessorKey: 'rank',
    header: '#',
    cell: ({ row }) => <span className="font-medium">{row.index + 1}</span>,
    enableSorting: false,
  },
  {
    accessorKey: 'address',
    header: 'Address',
    cell: ({ row }) => (
      <span className="font-mono text-sm">{shortenAddress(row.original.address)}</span>
    ),
  },
  {
    accessorKey: 'pnl7d',
    header: '7d PnL',
    cell: ({ row }) => (
      <span
        className={`font-medium ${row.original.pnl7d >= 0 ? 'text-success' : 'text-destructive'}`}
      >
        {formatPnL(row.original.pnl7d)}
      </span>
    ),
  },
  {
    accessorKey: 'winRate',
    header: 'Win Rate',
    cell: ({ row }) => <span>{row.original.winRate}%</span>,
  },
  {
    accessorKey: 'trades',
    header: 'Trades',
    cell: ({ row }) => <span className="opacity-80">{row.original.trades.toLocaleString()}</span>,
  },
  {
    accessorKey: 'volume',
    header: 'Volume',
    cell: ({ row }) => (
      <span className="opacity-80">{formatCompactNumber(row.original.volume)}</span>
    ),
  },
  {
    accessorKey: 'sharpe',
    header: 'Sharpe',
    cell: ({ row }) => (
      <span className={row.original.sharpe >= 0 ? 'text-success' : 'text-destructive'}>
        {row.original.sharpe.toFixed(2)}
      </span>
    ),
  },
  {
    id: 'actions',
    header: '',
    cell: ({ row }) => (
      <Link
        to="/traders/$address"
        params={{ address: row.original.address }}
        className="px-3 py-1 text-sm rounded-md bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 transition-opacity"
      >
        View
      </Link>
    ),
    enableSorting: false,
  },
];

function TradersPage() {
  const { data: traders, isLoading } = useQuery({
    queryKey: ['traders', 'list'],
    queryFn: async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return mockTraders;
    },
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold">Top Traders</h1>
          <p className="text-sm opacity-60 mt-1">Rankings based on 7-day performance</p>
        </div>
        <div className="flex gap-2">
          <select className="px-4 py-2 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-sm">
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
            <option value="all">All Time</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 opacity-60">Loading traders...</div>
      ) : (
        <div className="bg-[hsl(var(--card))] p-6 rounded-xl">
          <DataTable
            columns={columns}
            data={traders ?? []}
            pageSize={10}
            searchColumn="address"
            searchPlaceholder="Search by address..."
          />
        </div>
      )}
    </div>
  );
}
