import { Pool } from 'pg';
import { config } from '../config';
import { logger } from '../utils/logger';

export class PostgreSQLService {
  private pool: Pool;

  constructor() {
    this.pool = new Pool({
      host: config.postgres.host,
      port: config.postgres.port,
      database: config.postgres.database,
      user: config.postgres.user,
      password: config.postgres.password,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async getTraderProfile(traderId: string) {
    const query = `
      SELECT
        id,
        address,
        nickname,
        bio,
        is_verified,
        verification_score,
        total_pnl,
        win_rate,
        total_trades,
        followers,
        avg_position_size,
        tags,
        social_links,
        created_at,
        updated_at
      FROM traders
      WHERE address = $1
    `;

    try {
      const result = await this.pool.query(query, [traderId]);
      return result.rows[0] || null;
    } catch (error) {
      logger.error('Error fetching trader profile:', error);
      throw error;
    }
  }

  async batchGetTraderProfiles(traderIds: string[]) {
    const query = `
      SELECT
        id,
        address,
        nickname,
        bio,
        is_verified,
        verification_score,
        total_pnl,
        win_rate,
        total_trades,
        followers,
        avg_position_size,
        tags,
        social_links,
        created_at,
        updated_at
      FROM traders
      WHERE address = ANY($1)
    `;

    try {
      const result = await this.pool.query(query, [traderIds]);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching batch trader profiles:', error);
      throw error;
    }
  }

  async updateTraderStats(traderId: string, stats: any) {
    const query = `
      UPDATE traders
      SET
        total_pnl = COALESCE($1, total_pnl),
        win_rate = COALESCE($2, win_rate),
        total_trades = COALESCE($3, total_trades),
        avg_position_size = COALESCE($4, avg_position_size),
        updated_at = NOW()
      WHERE address = $5
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [
        stats.totalPnl,
        stats.winRate,
        stats.totalTrades,
        stats.avgPositionSize,
        traderId,
      ]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating trader stats:', error);
      throw error;
    }
  }

  async getTopTradersByMetric(metric: string, limit: number, symbol?: string) {
    let query = `
      SELECT
        t.*,
        COUNT(ct.id) as copy_count
      FROM traders t
      LEFT JOIN copy_relationships ct ON t.id = ct.trader_id AND ct.is_active = true
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (symbol) {
      query += ` JOIN trades tr ON t.id = tr.trader_id AND tr.token_symbol = $${paramIndex}`;
      params.push(symbol);
      paramIndex++;
    }

    query += `
      GROUP BY t.id
      ORDER BY ${this.getMetricColumn(metric)} DESC
      LIMIT $${paramIndex}
    `;
    params.push(limit);

    try {
      const result = await this.pool.query(query, params);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching top traders:', error);
      throw error;
    }
  }

  async searchTraders(query: string, filters: any) {
    let sql = `
      SELECT
        id,
        address,
        nickname,
        bio,
        is_verified,
        verification_score,
        total_pnl,
        win_rate,
        total_trades,
        followers,
        tags,
        created_at
      FROM traders
      WHERE (nickname ILIKE $1 OR address ILIKE $1)
    `;

    const params: any[] = [`%${query}%`];
    let paramIndex = 2;

    if (filters.isVerified !== undefined) {
      sql += ` AND is_verified = $${paramIndex}`;
      params.push(filters.isVerified);
      paramIndex++;
    }

    if (filters.minFollowers) {
      sql += ` AND followers >= $${paramIndex}`;
      params.push(filters.minFollowers);
      paramIndex++;
    }

    if (filters.minPnl) {
      sql += ` AND total_pnl >= $${paramIndex}`;
      params.push(filters.minPnl);
      paramIndex++;
    }

    sql += ` ORDER BY followers DESC, total_pnl DESC LIMIT 50`;

    try {
      const result = await this.pool.query(sql, params);
      return result.rows;
    } catch (error) {
      logger.error('Error searching traders:', error);
      throw error;
    }
  }

  async getTraderActivity(traderId: string, limit: number = 20) {
    const query = `
      SELECT
        tr.*,
        t.symbol as token_symbol
      FROM trades tr
      JOIN tokens t ON tr.token_id = t.id
      WHERE tr.trader_id = (SELECT id FROM traders WHERE address = $1)
      ORDER BY tr.created_at DESC
      LIMIT $2
    `;

    try {
      const result = await this.pool.query(query, [traderId, limit]);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching trader activity:', error);
      throw error;
    }
  }

  async getTraderFollowers(traderId: string) {
    const query = `
      SELECT
        u.id,
        u.username,
        u.email,
        cr.allocation_percentage,
        cr.created_at
      FROM copy_relationships cr
      JOIN users u ON cr.follower_id = u.id
      JOIN traders t ON cr.trader_id = t.id
      WHERE t.address = $1 AND cr.is_active = true
      ORDER BY cr.created_at DESC
    `;

    try {
      const result = await this.pool.query(query, [traderId]);
      return result.rows;
    } catch (error) {
      logger.error('Error fetching trader followers:', error);
      throw error;
    }
  }

  async createTraderVerification(
    traderId: string,
    verificationType: string,
    evidence: any,
    verifiedBy?: string,
  ) {
    const query = `
      INSERT INTO trader_verifications (trader_id, verification_type, evidence, verified_by)
      VALUES (
        (SELECT id FROM traders WHERE address = $1),
        $2,
        $3,
        $4
      )
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [
        traderId,
        verificationType,
        evidence,
        verifiedBy,
      ]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error creating trader verification:', error);
      throw error;
    }
  }

  async updateTraderVerification(
    traderId: string,
    isVerified: boolean,
    verificationScore?: number,
  ) {
    const query = `
      UPDATE traders
      SET
        is_verified = $1,
        verification_score = COALESCE($2, verification_score),
        updated_at = NOW()
      WHERE address = $3
      RETURNING *
    `;

    try {
      const result = await this.pool.query(query, [isVerified, verificationScore, traderId]);
      return result.rows[0];
    } catch (error) {
      logger.error('Error updating trader verification:', error);
      throw error;
    }
  }

  private getMetricColumn(metric: string): string {
    const columns: { [key: string]: string } = {
      pnl: 't.total_pnl',
      winrate: 't.win_rate',
      followers: 't.followers',
      trades: 't.total_trades',
      copies: 'COUNT(ct.id)',
    };
    return columns[metric] || 't.total_pnl';
  }

  async close(): Promise<void> {
    await this.pool.end();
    logger.info('PostgreSQL connection pool closed');
  }
}
