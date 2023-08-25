import { QuestionType } from '@klicker-uzh/prisma'
import axios from 'axios'

export function sliceIntoChunks(array: any[], chunkSize: number) {
  const result = []
  let index = 0
  while (index < array.length) {
    result.push(array.slice(index, index + chunkSize))
    index += chunkSize
  }
  return result
}

export const QuestionTypeMap: Record<string, QuestionType> = {
  SC: 'SC',
  MC: 'MC',
  FREE_RANGE: 'NUMERICAL',
  FREE: 'FREE_TEXT',
}

export async function sendTeamsNotifications(scope: string, text: string) {
  // if (process.env.TEAMS_WEBHOOK_URL && process.env.NODE_ENV === 'production') {
  if (process.env.TEAMS_WEBHOOK_URL) {
    return axios.post(process.env.TEAMS_WEBHOOK_URL, {
      '@context': 'https://schema.org/extensions',
      '@type': 'MessageCard',
      themeColor: '0076D7',
      title: `Migration: ${scope}`,
      text: `[${process.env.NODE_ENV}:${scope}] ${text}`,
    })
  }

  return null
}

export async function sendEmailMigrationNotification(
  email: string,
  success: boolean
) {
  const LISTMONK_AUTH = {
    username: process.env.LISTMONK_USER as string,
    password: process.env.LISTMONK_PASS as string,
  }

  try {
    return axios.post(
      `${process.env.LISTMONK_URL}/api/tx`,
      {
        subscriber_emails: [email],
        template_id: success ? 4 : 5,
      },
      { auth: LISTMONK_AUTH }
    )
  } catch (e) {
    console.error(e)
    return false
  }
}
