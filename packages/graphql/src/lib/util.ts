import { Context } from './context';
import { GraphQLError } from 'graphql';

// shuffle an array and return a new copy
export function shuffle<T>(array: Array<T>): Array<T> {
  const a = [...array]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}


export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function checkCronToken(ctx: Context) {
  if (typeof process.env.CRON_TOKEN === 'undefined') {
    throw new GraphQLError("No token available.")
  }
  
  if (ctx.req.headers["x-token"] !== process.env.CRON_TOKEN) {
    throw new GraphQLError("Token not valid.")
  }
}

export { levelFromXp } from '@klicker-uzh/prisma/dist/util'
