import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'
import { GraphQLError } from 'graphql'
import { Context } from './context'

dayjs.extend(utc)

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
    throw new GraphQLError('No token available.')
  }

  if (ctx.req.headers['x-token'] !== process.env.CRON_TOKEN) {
    throw new GraphQLError('Token not valid.')
  }
}

export function formatDate(dateTime: Date) {
  let date = dayjs(dateTime).local()

  return {
    date: `${date.format('DD')}.${date.format('MM')}.${date.format('YYYY')}`,
    time: `${date.format('HH')}:${date.format('mm')}`,
  }
}

export function sliceIntoChunks(
  registrationTokens: string[],
  chunkSize: number
) {
  if (registrationTokens.length <= chunkSize) {
    return [registrationTokens]
  }

  const chunks = []
  let index = 0
  const n = registrationTokens.length

  while (index < n) {
    chunks.push(registrationTokens.slice(index, index + chunkSize))
    index += chunkSize
  }

  return chunks
}

export { levelFromXp } from '@klicker-uzh/prisma/dist/util'
