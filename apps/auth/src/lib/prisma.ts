import { PrismaClient } from '@klicker-uzh/prisma'
import { PrismaPg } from '@prisma/adapter-pg'

declare global {
  var prisma: PrismaClient | undefined
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
const client = globalThis.prisma || new PrismaClient({ adapter })
if (process.env.NODE_ENV !== 'production') globalThis.prisma = client

export default client
