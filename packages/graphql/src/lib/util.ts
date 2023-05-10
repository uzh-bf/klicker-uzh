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

export function formatDate(dateTime: Date) {
  let date = new Date(dateTime);

  let day = String(date.getUTCDate()).padStart(2, '0');
  let month = String(date.getUTCMonth() + 1).padStart(2, '0');
  let year = String(date.getUTCFullYear());

  let hours = String(date.getUTCHours()).padStart(2, '0');
  let minutes = String(date.getUTCMinutes()).padStart(2, '0');

  return {
    date: `${day}.${month}.${year}`,
    time: `${hours}:${minutes}`
  }
}

export { levelFromXp } from '@klicker-uzh/prisma/dist/util'
