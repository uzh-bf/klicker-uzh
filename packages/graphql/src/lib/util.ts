import axios from 'axios'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { GraphQLError } from 'graphql'
import { Context } from './context'

dayjs.extend(utc)
dayjs.extend(timezone)

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
  let date = dayjs(dateTime)
    .utc()
    .tz(process.env.TZ ?? 'Europe/Zurich')

  return {
    date: `${date.format('DD')}.${date.format('MM')}.${date.format('YYYY')}`,
    time: `${date.format('HH')}:${date.format('mm')} (CET)`,
  }
}

export async function sendTeamsNotifications(scope: string, text: string) {
  if (process.env.TEAMS_WEBHOOK_URL) {
    return axios.post(process.env.TEAMS_WEBHOOK_URL, {
      '@context': 'https://schema.org/extensions',
      '@type': 'MessageCard',
      themeColor: '0076D7',
      title: scope,
      text: `[${process.env.NODE_ENV}:${scope}] ${text}`,
    })
  }

  return null
}

export { levelFromXp } from '@klicker-uzh/prisma/dist/util'
