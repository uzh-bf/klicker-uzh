import axios from 'axios'
import dayjs from 'dayjs'
import timezone from 'dayjs/plugin/timezone'
import utc from 'dayjs/plugin/utc'
import { GraphQLError } from 'graphql'
import * as R from 'ramda'
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

export const orderStacks = R.sort((a: any, b: any) => {
  const aResponses = a.elements[0].responses
  const bResponses = b.elements[0].responses

  // place instances, which have never been answered at the front
  if (aResponses.length === 0 && bResponses.length === 0) return 0
  if (aResponses.length === 0) return -1
  if (bResponses.length === 0) return 1

  const aResponse = aResponses[0]
  const bResponse = bResponses[0]

  // sort first according by correctCountStreak ascending, then by correctCount ascending, then by the lastResponseAt from old to new
  if (aResponse.correctCountStreak < bResponse.correctCountStreak) return -1
  if (aResponse.correctCountStreak > bResponse.correctCountStreak) return 1

  if (aResponse.correctCount < bResponse.correctCount) return -1
  if (aResponse.correctCount > bResponse.correctCount) return 1

  if (aResponse.lastCorrectAt < bResponse.lastCorrectAt) return -1
  if (aResponse.lastCorrectAt > bResponse.lastCorrectAt) return 1

  return 0
})
