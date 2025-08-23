import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from './prisma/client/client.js'

// const connectionString = process.env.DATABASE_URL

// if (!connectionString) {
//   throw new Error('DATABASE_URL is not defined')
// }

// const dbUrl = new URL(connectionString)

// const poolConfig = {
//   host: dbUrl.hostname || 'localhost',
//   port: parseInt(dbUrl.port || '5432', 10),
//   database: dbUrl.pathname?.slice(1) || '', // Remove leading '/'
//   user: dbUrl.username || '',
//   password: dbUrl.password ? decodeURIComponent(dbUrl.password) : '',
//   // Don't pass ssl as an object if not needed
//   ...(process.env.NODE_ENV === 'production' && {
//     ssl: { rejectUnauthorized: false },
//   }),
// }

// console.log('Pool config:', {
//   host: poolConfig.host,
//   port: poolConfig.port,
//   database: poolConfig.database,
//   user: poolConfig.user,
//   password: poolConfig.password ? '[REDACTED]' : '[EMPTY]',
//   passwordType: typeof poolConfig.password,
//   userType: typeof poolConfig.user,
// })

// Validate that required fields are strings
// if (typeof poolConfig.user !== 'string') {
//   throw new Error(`User must be a string, got ${typeof poolConfig.user}`)
// }
// if (typeof poolConfig.password !== 'string') {
//   throw new Error(
//     `Password must be a string, got ${typeof poolConfig.password}`
//   )
// }
// if (typeof poolConfig.database !== 'string') {
//   throw new Error(
//     `Database must be a string, got ${typeof poolConfig.database}`
//   )
// }
// if (typeof poolConfig.host !== 'string') {
//   throw new Error(`Host must be a string, got ${typeof poolConfig.host}`)
// }

// const pool = new Pool(poolConfig)

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
})

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    adapter,
    log: ['query', 'error', 'warn'],
  })

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}

export default prisma

// export * from './prisma/client/client.js'
// // export * from './prisma/client/commonInputTypes.js'
// // export * from './prisma/client/enums.js'
// export * from './prisma/client/models.js'
// export * from './prisma/client/pjtg.js'
