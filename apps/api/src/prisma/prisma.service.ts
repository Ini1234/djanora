import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

/**
 * Long-running Nest talks to Neon over TCP via `pg`.
 * Direct Neon computes suspend when idle; a pooled client then looks
 * alive until the next query hits a dead socket (P1008 / SocketTimeout).
 */
function isTransientDbError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as {
    code?: string
    message?: string
    cause?: { kind?: string; code?: string }
  }
  if (e.code === 'P1008' || e.code === 'P1017' || e.code === 'P1001') return true
  const kind = e.cause?.kind
  if (kind === 'SocketTimeout' || kind === 'Closed' || kind === 'ConnectionClosed') return true
  const msg = e.message ?? ''
  return /socket timeout|connection terminated|Connection terminated|ECONNRESET|ETIMEDOUT/i.test(msg)
}

function withOneRetry(pool: Pool) {
  const query = pool.query.bind(pool)
  // Prisma's pg adapter only uses the promise form.
  pool.query = ((...args: unknown[]) => {
    const result = (query as (...a: unknown[]) => Promise<unknown>)(...args)
    if (typeof result?.then !== 'function') return result
    return result.catch((err: unknown) => {
      if (!isTransientDbError(err)) throw err
      return (query as (...a: unknown[]) => Promise<unknown>)(...args)
    })
  }) as Pool['query']
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly pool: Pool

  constructor() {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      // Recycle before Neon drops the TCP session.
      idleTimeoutMillis: 10_000,
      // Cold start after suspend can take several seconds.
      connectionTimeoutMillis: 20_000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
      allowExitOnIdle: true,
    })
    pool.on('error', (err) => {
      // Idle client errors are expected when Neon closes the socket.
      new Logger(PrismaService.name).debug(err.message)
    })
    withOneRetry(pool)
    super({ adapter: new PrismaPg(pool) } as ConstructorParameters<typeof PrismaClient>[0])
    this.pool = pool
  }

  async onModuleInit() {
    await this.$connect()
  }

  async onModuleDestroy() {
    await this.$disconnect()
    await this.pool.end()
  }
}
