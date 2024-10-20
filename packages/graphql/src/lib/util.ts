import type {
  ElementInstance,
  ElementStack,
  QuestionResponse,
} from '@klicker-uzh/prisma'
import axios from 'axios'
import dayjs from 'dayjs'
import minMax from 'dayjs/plugin/minMax.js'
import timezone from 'dayjs/plugin/timezone.js'
import utc from 'dayjs/plugin/utc.js'
import { GraphQLError } from 'graphql'
import { sort } from 'remeda'
import type { Context } from './context.js'

dayjs.extend(utc)
dayjs.extend(minMax)
dayjs.extend(timezone)

// shuffle an array and return a new copy
export function shuffle<T>(array: Array<T>): Array<T> {
  const a = [...array]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j]!, a[i]!]
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

export const orderStacks = (
  stacks: (ElementStack & {
    elements: (ElementInstance & { responses?: QuestionResponse[] })[]
  })[]
) =>
  sort(stacks, (stackA, stackB) => {
    const stackAResponses = stackA.elements
      .flatMap((e) => e.responses)
      .filter((response) => !!response)
    const stackBResponses = stackB.elements
      .flatMap((e) => e.responses)
      .filter((response) => !!response)

    // place instances, which have never been answered at the front
    if (
      !stackAResponses ||
      !stackBResponses ||
      (stackAResponses.length === 0 && stackBResponses.length === 0)
    )
      return 0
    if (stackAResponses.length === 0) return -1
    if (stackBResponses.length === 0) return 1

    // only first respose at first -> should be changed for stacks with more than one response
    const aEarliestDueDate = findEarliestDueDate(stackAResponses)
    const bEarliestDueDate = findEarliestDueDate(stackBResponses)

    // sort first according by dueDate ascending, then by correctCount ascending, then by the lastResponseAt from old to new
    if (!aEarliestDueDate) return -1
    if (!bEarliestDueDate) return 1
    if (aEarliestDueDate < bEarliestDueDate) return -1
    if (aEarliestDueDate > bEarliestDueDate) return 1

    // fallback (old logic) in unprobable case of identical dueDates
    const aResponse = stackAResponses[0]!
    const bResponse = stackBResponses[0]!

    if (aResponse.correctCountStreak < bResponse.correctCountStreak) return -1
    if (aResponse.correctCountStreak > bResponse.correctCountStreak) return 1

    if (aResponse.correctCount < bResponse.correctCount) return -1
    if (aResponse.correctCount > bResponse.correctCount) return 1

    if (!aResponse.lastCorrectAt || !bResponse.lastCorrectAt) return 0
    if (aResponse.lastCorrectAt < bResponse.lastCorrectAt) return -1
    if (aResponse.lastCorrectAt > bResponse.lastCorrectAt) return 1

    return 0
  })

const findEarliestDueDate = (
  stackResponses: (QuestionResponse | undefined)[]
) => {
  return dayjs
    .min(
      stackResponses.map((response) =>
        response!.nextDueAt === null ? dayjs() : dayjs(response!.nextDueAt)
      )
    )
    ?.toDate()
}

export async function sendEmailMigrationNotification(
  email: string,
  templateId: string
) {
  const LISTMONK_AUTH = {
    username: process.env.LISTMONK_USER as string,
    password: process.env.LISTMONK_PASS as string,
  }

  try {
    // add the user as a subscriber to enable sending emails via listmonk
    await axios.post(
      `${process.env.LISTMONK_URL}/api/subscribers`,
      {
        email: email,
        name: email,
        status: 'enabled',
        preconfirm_subscriptions: true,
      },
      { auth: LISTMONK_AUTH }
    )
  } catch (e: any) {
    console.error(e)
    // if (e.response.status !== 409) {
    //   context.error(e)
    // }
  }

  try {
    const result = await axios.post(
      `${process.env.LISTMONK_URL}/api/tx`,
      {
        subscriber_emails: [email],
        template_id: Number(templateId),
      },
      { auth: LISTMONK_AUTH }
    )

    console.log(result)

    return result
  } catch (e) {
    console.error(e)
  }

  return null
}
