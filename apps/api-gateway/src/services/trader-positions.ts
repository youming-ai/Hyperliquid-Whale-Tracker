import { traderPositions } from '@hyperdash/database';
import { eq, inArray } from 'drizzle-orm';
import { getDatabaseConnection } from './connection';
import type { TraderPositionRow } from './hyperliquid';

export async function replaceTraderPositions(
  traderId: string,
  rows: TraderPositionRow[],
): Promise<void> {
  const db = getDatabaseConnection().getDatabase();

  await db.transaction(async (tx) => {
    const existingRows = await tx
      .select({
        id: traderPositions.id,
        symbol: traderPositions.symbol,
        side: traderPositions.side,
      })
      .from(traderPositions)
      .where(eq(traderPositions.traderId, traderId));

    const existingByKey = new Map(
      existingRows.map((row) => [`${row.symbol}:${row.side}`, row.id]),
    );
    const activeKeys = new Set(rows.map((row) => `${row.symbol}:${row.side}`));

    for (const row of rows) {
      const existingId = existingByKey.get(`${row.symbol}:${row.side}`);
      if (existingId) {
        await tx.update(traderPositions).set(row).where(eq(traderPositions.id, existingId));
      } else {
        await tx.insert(traderPositions).values(row as any);
      }
    }

    const staleIds = existingRows
      .filter((row) => !activeKeys.has(`${row.symbol}:${row.side}`))
      .map((row) => row.id);

    if (staleIds.length > 0) {
      await tx.delete(traderPositions).where(inArray(traderPositions.id, staleIds));
    }
  });
}
