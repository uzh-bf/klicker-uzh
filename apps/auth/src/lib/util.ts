import axios from 'axios'
import { authEvent, createAuthCorrelationId } from '@/lib/telemetry'

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
      authEvent('auth.helper.notification', createAuthCorrelationId(), {
        action: 'notification',
        outcome: 'notification_failed',
        errorCategory: 'notification',
      })
      return null
    }
  }

  return null
}
