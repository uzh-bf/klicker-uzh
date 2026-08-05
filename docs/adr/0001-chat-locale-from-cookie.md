# 1. Chat resolves its locale from a cookie, in a chat-local `getRequestConfig`

`apps/chat` needs German alongside English but has no room in its URL space for a `[locale]` segment — chatbot links are handed out to students and embedded in LMS pages, so the paths have to stay stable. The locale therefore comes from the `NEXT_LOCALE` cookie (fallback `en`, no switcher in the chat UI).

The non-obvious part is _where_ it is resolved. next-intl's `setRequestLocale` back-fill assumes a locale route segment; in a cookie-based app it does not propagate to the server APIs, so `<html lang>` follows the cookie while `getTranslations()` silently stays on the default — a split brain that renders a German page with English server-rendered strings. Chat therefore reads the cookie directly in its own `getRequestConfig` (`apps/chat/src/types/i18n.ts`) rather than reusing the shared `request.ts`, which additionally lets the messages be imported statically (Turbopack cannot resolve the shared file's dynamic package-subpath import).

Reversing this means introducing a locale route segment and re-issuing every chatbot link, so it is worth recording rather than rediscovering.
