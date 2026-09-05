import { prisma } from '@klicker-uzh/prisma'
import { seedResponseExamples } from './seedResponseExamples.js'

await seedResponseExamples(prisma)
await prisma.$disconnect()
