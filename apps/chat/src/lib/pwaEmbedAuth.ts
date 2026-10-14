export const PWA_CHAT_EMBED_EXCHANGE_SCOPE = 'PWA_CHAT_EMBED_EXCHANGE'
export const PWA_CHAT_EMBED_SESSION_SCOPE = 'PWA_CHAT_EMBED_SESSION'
export const PWA_CHAT_EMBED_SESSION_COOKIE = 'chat_pwa_embed_token'
export const PWA_CHAT_EMBED_SESSION_STORAGE_KEY = 'chat_pwa_embed_token'
export const PWA_CHAT_EMBED_QUERY_KEY = '_pe'

// Reserved request header the proxy uses to hand a proxy-verified scoped token
// (from `?_t=` / `?_pe=`) to the server render when the third-party cookie
// was blocked. It carries a token, never an identity: the layout re-verifies
// signature, scope and binding, and the proxy always overwrites the value, so
// a client-supplied header can never authorize a request.
export const CHAT_SCOPED_TOKEN_HEADER = 'x-chat-scoped-token'
