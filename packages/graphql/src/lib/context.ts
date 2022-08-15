import { Request, Response } from 'express'
import * as Prisma from '../prisma/client/index'

interface BaseContext {
  req: Request & { locals: { user?: any } }
  res: Response
  user?: any
}

export interface Context extends BaseContext {
  prisma: Prisma.PrismaClient
}

const prisma = new Prisma.PrismaClient()

function enhanceContext({ req }: BaseContext) {
  return {
    prisma,
    user: req.locals?.user,
  }
}

export default enhanceContext
