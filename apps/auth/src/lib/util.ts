import axios from 'axios'
import { getLogger } from './logger/base'

export async function sendTeamsNotifications(scope: string, text: string) {
  if (process.env.TEAMS_WEBHOOK_URL) {
    try {
      return await axios.post(process.env.TEAMS_WEBHOOK_URL, {
        '@context': 'https://schema.org/extensions',
        '@type': 'MessageCard',
        themeColor: '0076D7',
        title: scope,
        text: `[${process.env.NODE_ENV}:${scope}] ${text}`,
      })
    } catch (error) {
      getLogger().error(
        { err: error, scope },
        'failed to send Teams notification'
      )
      return null
    }
  }

  return null
}
