import { traderPositions } from '@hyperdash/database';
import { eq } from 'drizzle-orm';
import { getDatabaseConnection } from './connection';
import type { TraderPositionRow } from './hyperliquid';

export async function replaceTraderPositions(
  traderId: string,
  rows: TraderPositionRow[],
): Promise<void> {
  const db = getDatabaseConnection().getDatabase();

  await db.transaction(async (tx) => {
    await tx.delete(traderPositions).where(eq(traderPositions.traderId, traderId));

    if (rows.length > 0) {
      await tx.insert(traderPositions).values(rows as any);
    }
  });
}
