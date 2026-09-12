import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@klicker-uzh/prisma'
import { randomUUID } from 'node:crypto'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required for the Auth adapter smoke')
}

const databaseUrl = new URL(process.env.DATABASE_URL)
const loopbackHosts = new Set(['127.0.0.1', '[::1]', 'localhost'])
const isDevrouterDatabase =
  databaseUrl.hostname === 'postgres' &&
  process.env.DEVROUTER_WORKSPACE &&
  process.env.NODE_ENV !== 'production'

if (!loopbackHosts.has(databaseUrl.hostname) && !isDevrouterDatabase) {
  throw new Error(
    `Refusing to run the Auth adapter smoke against non-local host ${databaseUrl.hostname}`
  )
}

const adapter = PrismaAdapter(prisma)
const suffix = randomUUID().replaceAll('-', '')
const email = `prisma7-adapter-${suffix}@example.invalid`
const shortname = `prisma7_${suffix.slice(0, 16)}`
const provider = 'prisma7-adapter-smoke'
const providerAccountId = suffix
let userId

try {
  const user = await adapter.createUser({
    email,
    emailVerified: null,
    image: null,
    name: 'Prisma adapter smoke',
    shortname,
  })
  userId = user.id

  const userByEmail = await adapter.getUserByEmail(email)

  if (userByEmail?.id !== userId) {
    throw new Error('Auth adapter email lookup returned the wrong user')
  }

  await adapter.linkAccount({
    provider,
    providerAccountId,
    type: 'oauth',
    userId,
  })

  const linkedUser = await adapter.getUserByAccount({
    provider,
    providerAccountId,
  })

  if (linkedUser?.id !== userId) {
    throw new Error('Auth adapter account lookup returned the wrong user')
  }

  await adapter.unlinkAccount({ provider, providerAccountId })
  await adapter.deleteUser(userId)
  userId = undefined

  console.log('Auth Prisma adapter round-trip passed')
} finally {
  try {
    if (userId) {
      await prisma.user.deleteMany({ where: { id: userId, email } })
    }
  } finally {
    await prisma.$disconnect()
  }
}
