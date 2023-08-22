import { InvocationContext } from '@azure/functions'
import { PrismaClient } from './client'

let prisma: PrismaClient

function getPrismaClient(context?: InvocationContext) {
  if (!prisma) {
    try {
      prisma = new PrismaClient()
    } catch (e) {
      context?.error(e)
    }
  }

  return prisma
}

export default getPrismaClient
