import { InvocationContext } from '@azure/functions'
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

export async function sendTeamsNotifications(
  scope: string,
  text: string,
  context: InvocationContext
) {
  if (process.env.TEAMS_WEBHOOK_URL) {
    try {
      return axios.post(process.env.TEAMS_WEBHOOK_URL, {
        '@context': 'https://schema.org/extensions',
        '@type': 'MessageCard',
        themeColor: '0076D7',
        title: `Migration: ${scope}`,
        text: `[${process.env.NODE_ENV}:${scope}] ${text}`,
      })
    } catch (e) {
      context.error(e)
    }
  }

  return null
}
