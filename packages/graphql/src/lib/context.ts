import { PrismaClient, UserRole } from '@klicker-uzh/prisma'
import { Request, Response } from 'express'

interface BaseContext {
  req: Request & { locals: { user?: any } }
  res: Response
}

export interface Context extends BaseContext {
  prisma: PrismaClient
}

export interface ContextWithOptionalUser extends Context {
  user?: {
    sub: string
    role: UserRole
  }
}

export interface ContextWithUser extends Context {
  user: {
    sub: string
    role: UserRole
  }
}

const prisma = new PrismaClient()

function enhanceContext({ req }: BaseContext) {
  return {
    prisma,
    user: req.locals?.user,
  }
}

export default enhanceContext
