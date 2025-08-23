import { PrismaPg } from '@prisma/adapter-pg'
// @ts-ignore - Client files are copied to dist/client during build
import { PrismaClient } from './client/client.ts'

// TODO: figure out whether using Pool with pg is a good idea for us (or does pgbouncer do that server-side)
// import { Pool } from 'pg'
// const pool = new Pool(poolConfig)

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
  // TODO other optimization params? move prisma optimize etc. here?
})

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    // TODO:  parametrizing the log levels via env or param
    log: ['query', 'error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma
