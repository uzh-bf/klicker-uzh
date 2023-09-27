import axios from 'axios'

export async function sendTeamsNotifications(scope: string, text: string) {
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
