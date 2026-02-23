/**
 * REDIS CLIENT — Singleton with graceful in-memory fallback
 * ==========================================================
 * In production: set REDIS_URL in env → real Redis is used.
 * In development / when Redis is unavailable: automatically falls back to a
 * Map-based in-memory store so the app never crashes due to Redis absence.
 *
 * Usage:
 *   import { getRedis, isRedisAvailable } from '../utils/redisClient';
 *   const client = getRedis();
 *   await client.set('key', 'value', 'EX', 60);
 *   const val = await client.get('key');
 */

import Redis from 'ioredis';
import logger from './logger';

// ─── Types shared between real and fake client ────────────────────────────────

export interface RedisLike {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ...args: (string | number)[]): Promise<unknown>;
  del(key: string): Promise<number>;
  exists(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  incr(key: string): Promise<number>;
  ttl(key: string): Promise<number>;
  quit(): Promise<void>;
}

// ─── In-memory fallback ───────────────────────────────────────────────────────

interface MemoryEntry {
  value: string;
  expiresAt: number | null; // null = no expiry
}

class InMemoryRedis implements RedisLike {
  private store = new Map<string, MemoryEntry>();

  private isExpired(entry: MemoryEntry): boolean {
    return entry.expiresAt !== null && Date.now() > entry.expiresAt;
  }

  private pruneExpired(): void {
    for (const [key, entry] of this.store) {
      if (this.isExpired(entry)) this.store.delete(key);
    }
  }

  async get(key: string): Promise<string | null> {
    const entry = this.store.get(key);
    if (!entry || this.isExpired(entry)) {
      this.store.delete(key);
      return null;
    }
    return entry.value;
  }

  async set(key: string, value: string, ...args: (string | number)[]): Promise<'OK'> {
    let expiresAt: number | null = null;

    // Parse EX <seconds> or PX <milliseconds>
    for (let i = 0; i < args.length - 1; i++) {
      const flag = String(args[i]).toUpperCase();
      const val  = Number(args[i + 1]);
      if (flag === 'EX')  { expiresAt = Date.now() + val * 1000; i++; }
      if (flag === 'PX')  { expiresAt = Date.now() + val; i++; }
    }

    this.store.set(key, { value, expiresAt });
    return 'OK';
  }

  async del(key: string): Promise<number> {
    return this.store.delete(key) ? 1 : 0;
  }

  async exists(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry || this.isExpired(entry)) return 0;
    return 1;
  }

  async expire(key: string, seconds: number): Promise<number> {
    const entry = this.store.get(key);
    if (!entry || this.isExpired(entry)) return 0;
    entry.expiresAt = Date.now() + seconds * 1000;
    return 1;
  }

  async incr(key: string): Promise<number> {
    const entry = this.store.get(key);
    const current = entry && !this.isExpired(entry) ? parseInt(entry.value, 10) || 0 : 0;
    const next = current + 1;
    await this.set(key, String(next));
    return next;
  }

  async ttl(key: string): Promise<number> {
    const entry = this.store.get(key);
    if (!entry || this.isExpired(entry)) return -2;
    if (entry.expiresAt === null) return -1;
    return Math.ceil((entry.expiresAt - Date.now()) / 1000);
  }

  async quit(): Promise<void> {
    this.pruneExpired();
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

let _client: Redis | InMemoryRedis | null = null;
let _isReal = false;

export function getRedis(): RedisLike {
  if (_client) return _client;

  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    try {
      const real = new Redis(redisUrl, {
        maxRetriesPerRequest: 3,
        lazyConnect: false,
        connectTimeout: 5000,
        enableReadyCheck: true,
      });

      real.on('connect', () => {
        logger.info('[Redis] Connected to Redis server');
        _isReal = true;
      });

      real.on('error', (err) => {
        logger.warn('[Redis] Connection error — falling back to in-memory store', { error: err.message });
        // Don't crash — ioredis auto-reconnects
      });

      real.on('close', () => {
        logger.warn('[Redis] Connection closed');
      });

      _client = real;
      return _client;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.warn('[Redis] Failed to initialise Redis client — using in-memory fallback', { error: message });
    }
  } else {
    logger.info('[Redis] REDIS_URL not set — using in-memory store (set REDIS_URL for production)');
  }

  _client = new InMemoryRedis();
  return _client;
}

export function isRedisAvailable(): boolean {
  return _isReal;
}

export function resetRedisClient(): void {
  _client = null;
  _isReal = false;
}
