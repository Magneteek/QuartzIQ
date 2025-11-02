/**
 * Database Connection Module
 * PostgreSQL connection pool with multi-tenant support
 * Uses structured logging for better debugging and monitoring
 */

import { Pool, PoolClient, QueryResult } from 'pg';
import { logger } from '../src/lib/logger';

const dbLogger = logger.child({ module: 'database' });

interface DbConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
  max?: number; // Maximum pool size
  idleTimeoutMillis?: number;
  connectionTimeoutMillis?: number;
}

class Database {
  private pool: Pool | null = null;
  private static instance: Database;

  private constructor() {}

  public static getInstance(): Database {
    if (!Database.instance) {
      Database.instance = new Database();
    }
    return Database.instance;
  }

  /**
   * Initialize database connection pool
   */
  public async initialize(config?: DbConfig): Promise<void> {
    const dbConfig: DbConfig = config || {
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DATABASE || 'quartziq_reviews',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || '',
      max: 20, // Maximum 20 connections in pool
      idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
      connectionTimeoutMillis: 10000, // Return error after 10 seconds if can't connect
    };

    this.pool = new Pool(dbConfig);

    // Test connection
    try {
      const client = await this.pool.connect();
      dbLogger.info('Database connected successfully', {
        host: dbConfig.host,
        database: dbConfig.database,
        maxConnections: dbConfig.max,
      });
      client.release();
    } catch (error) {
      dbLogger.error('Database connection failed', {
        error: error instanceof Error ? error.message : String(error),
        host: dbConfig.host,
        database: dbConfig.database,
      });
      throw error;
    }

    // Handle errors from the pool
    this.pool.on('error', (err) => {
      dbLogger.error('Unexpected database pool error', {
        error: err.message,
        stack: err.stack,
      });
    });
  }

  /**
   * Get database pool (auto-initializes if needed)
   */
  public getPool(): Pool {
    if (!this.pool) {
      // Auto-initialize with environment variables
      const dbConfig: DbConfig = {
        host: process.env.POSTGRES_HOST || 'localhost',
        port: parseInt(process.env.POSTGRES_PORT || '5432'),
        database: process.env.POSTGRES_DATABASE || 'quartziq_reviews',
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD || '',
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 10000,
      };

      this.pool = new Pool(dbConfig);

      // Handle errors from the pool
      this.pool.on('error', (err) => {
        dbLogger.error('Unexpected database pool error', {
          error: err.message,
          stack: err.stack,
        });
      });

      dbLogger.info('Database pool auto-initialized', {
        host: dbConfig.host,
        database: dbConfig.database,
      });
    }
    return this.pool;
  }

  /**
   * Execute a query with automatic performance tracking
   */
  public async query<T extends QueryResult = any>(text: string, params?: any[]): Promise<T> {
    const pool = this.getPool();
    const queryLog = dbLogger.dbQuery('database-query', text, params);

    try {
      const result = await pool.query(text, params) as T;
      queryLog.success(result.rowCount || 0);
      return result;
    } catch (error) {
      queryLog.error(error as Error);
      throw error;
    }
  }

  /**
   * Get a client from the pool for transactions
   */
  public async getClient(): Promise<PoolClient> {
    const pool = this.getPool();
    return await pool.connect();
  }

  /**
   * Execute a transaction with automatic rollback on failure
   */
  public async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();
    const transactionId = Math.random().toString(36).substring(7);

    dbLogger.debug('Starting transaction', { transactionId });

    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');

      dbLogger.debug('Transaction committed', { transactionId });
      return result;
    } catch (error) {
      await client.query('ROLLBACK');

      dbLogger.error('Transaction rolled back', {
        transactionId,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Close all database connections gracefully
   */
  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      dbLogger.info('Database connections closed');
    }
  }
}

// Export singleton instance
export const db = Database.getInstance();

// Convenience query functions
export async function query(text: string, params?: any[]): Promise<QueryResult> {
  return db.query(text, params);
}

export async function getClient(): Promise<PoolClient> {
  return db.getClient();
}

export async function transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  return db.transaction(callback);
}
