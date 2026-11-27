import { NextResponse } from 'next/server'
import {
  CHAT_GUEST_SESSION_STORAGE_KEY,
  PWA_CHAT_EMBED_SESSION_STORAGE_KEY,
} from '../pwaEmbedAuth'

type LaunchTransport =
  | { kind: 'guest'; token: string }
  | { kind: 'embed'; token: string }

export function configuredChatApiOrigin(): URL | null {
  if (process.env.CHAT_DIRECT_API_ENABLED !== 'true') return null
  const api = new URL(process.env.CHAT_PUBLIC_API_URL ?? '')
  if (
    !['https:', 'http:'].includes(api.protocol) ||
    api.username ||
    api.password ||
    api.pathname !== '/' ||
    api.search ||
    api.hash
  ) {
    throw new Error('CHAT_PUBLIC_API_URL must be an exact HTTP origin')
  }
  return api
}

export function hasSeparateChatApiHostname(chatHostname: string): boolean {
  const api = configuredChatApiOrigin()
  if (!api) return false
  const chatOrigin =
    process.env.APP_ORIGIN_CHAT ?? process.env.NEXT_PUBLIC_CHAT_URL
  const host = chatOrigin ? new URL(chatOrigin).hostname : chatHostname
  return api.hostname !== host
}

export function chatLaunchResponse(
  destination: URL,
  transport?: LaunchTransport
) {
  const path = destination.pathname + destination.search
  // Escape script-tag delimiters before embedding JSON in the HTML response.
  const scriptValue = (value: string) =>
    JSON.stringify(value).replace(/</g, '\\u003c')
  const guestKey = scriptValue(CHAT_GUEST_SESSION_STORAGE_KEY)
  const embedKey = scriptValue(PWA_CHAT_EMBED_SESSION_STORAGE_KEY)
  const store = transport
    ? 'sessionStorage.setItem(' +
      (transport.kind === 'guest' ? guestKey : embedKey) +
      ',' +
      scriptValue(transport.token) +
      ');'
    : ''
  return new NextResponse(
    '<!doctype html><meta charset="utf-8"><script>try {' +
      'sessionStorage.removeItem(' +
      guestKey +
      ');' +
      'sessionStorage.removeItem(' +
      embedKey +
      ');' +
      store +
      '} catch {} window.location.replace(' +
      scriptValue(path) +
      ')</script>',
    {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      },
    }
  )
}
