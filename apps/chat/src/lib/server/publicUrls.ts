// Public base URLs of the chat and the student PWA. They are read from the
// server environment at request time so one built image can serve several
// deployments; the NEXT_PUBLIC_* names remain the fallback for existing
// builds. Client components receive the values as props or through the root
// provider, never by reading the environment themselves.
function baseUrl(
  runtimeValue: string | undefined,
  buildValue: string | undefined,
  fallback: string
) {
  return (runtimeValue || buildValue || fallback).replace(/\/$/, '')
}

export function getPwaBaseUrl(): string {
  return baseUrl(
    process.env.CHAT_PUBLIC_PWA_URL,
    process.env.NEXT_PUBLIC_PWA_URL,
    'https://pwa.klicker.uzh.ch'
  )
}

export function getChatBaseUrl(): string {
  return baseUrl(
    process.env.CHAT_PUBLIC_URL,
    process.env.NEXT_PUBLIC_CHAT_URL,
    'https://chat.klicker.uzh.ch'
  )
}
