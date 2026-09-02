import axios from 'axios'
import type { AppLogger } from '@klicker-uzh/logging/node'
import { toSafeError } from '@klicker-uzh/logging/node'

export async function sendTeamsNotifications(
  scope: string,
  text: string,
  log?: AppLogger
) {
  if (process.env.TEAMS_WEBHOOK_URL) {
    try {
      return await axios.post(process.env.TEAMS_WEBHOOK_URL, {
        '@context': 'https://schema.org/extensions',
        '@type': 'MessageCard',
        themeColor: '0076D7',
        title: scope,
        text: `[${process.env.NODE_ENV}:${scope}] ${text}`,
      })
    } catch {
      log?.warn(
        {
          event: 'auth.notification.send_failed',
          err: toSafeError('Failed to send Teams notification'),
        },
        'Failed to send Teams notification'
      )
      return null
    }
  }

  return null
}
