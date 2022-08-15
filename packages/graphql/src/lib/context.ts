import { PrismaClient } from '@klicker-uzh/prisma'
import { Request, Response } from 'express'

interface BaseContext {
  req: Request & { locals: { user?: any } }
  res: Response
  user?: any
}

export interface Context extends BaseContext {
  prisma: PrismaClient
}

const prisma = new PrismaClient()

function enhanceContext({ req }: BaseContext) {
  return {
    prisma,
    user: req.locals?.user,
  }
}

export default enhanceContext
