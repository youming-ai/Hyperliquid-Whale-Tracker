export interface Fill {
  qty: number;
  price: number;
  fee: number;
}

export interface ReconcileInput {
  orderId: string;
  orderQuantity: number;
  fills: Fill[];
}

export interface ReconcileResult {
  status: 'submitted' | 'partial' | 'filled';
  filledQuantity: number;
  averagePrice: number;
  totalFee: number;
}

export function reconcileFill(input: ReconcileInput): ReconcileResult {
  if (input.fills.length === 0) {
    return {
      status: 'submitted',
      filledQuantity: 0,
      averagePrice: 0,
      totalFee: 0,
    };
  }

  const totalQty = input.fills.reduce((sum, f) => sum + f.qty, 0);
  const totalValue = input.fills.reduce((sum, f) => sum + f.qty * f.price, 0);
  const totalFee = input.fills.reduce((sum, f) => sum + f.fee, 0);
  const averagePrice = totalValue / totalQty;
  const status = totalQty >= input.orderQuantity ? 'filled' : 'partial';

  return {
    status,
    filledQuantity: totalQty,
    averagePrice,
    totalFee,
  };
}
