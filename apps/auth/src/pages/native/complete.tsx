import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { GetServerSideProps } from 'next'
import Head from 'next/head'
import { signOut } from 'next-auth/react'
import {
  type AbstractIntlMessages,
  useLocale,
  useTranslations,
} from 'next-intl'
import { useEffect, useRef, useState } from 'react'
import {
  NativeAuthError,
  nativeBrowserEvidence,
  nativeHandoff,
  nativeLoginBinding,
} from '@/lib/nativeHandoff'

interface Props {
  transaction: string
  csrf: string
  account: string | null
  failed: boolean
  autoContinue: boolean
  messages: AbstractIntlMessages
}

export default function NativeComplete({
  transaction,
  csrf,
  account,
  failed,
  autoContinue,
}: Props) {
  const t = useTranslations()
  const locale = useLocale()
  const submitButton = useRef<HTMLButtonElement>(null)
  const submitted = useRef(false)
  const [submitting, setSubmitting] = useState(false)
  useEffect(() => {
    if (autoContinue && !submitted.current) {
      submitButton.current?.click()
    }
  }, [autoContinue])
  const login = `${locale === 'de' ? '/de' : ''}/?nativeTransaction=${encodeURIComponent(transaction)}`
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 p-6">
      <Head>
        <title>{t('control.home.appName')}</title>
        <meta name="referrer" content="same-origin" />
      </Head>
      <h1 className="text-2xl font-bold">{t('control.home.appName')}</h1>
      {failed ? (
        <p role="alert">{t('control.nativeLogin.failed')}</p>
      ) : account ? (
        <>
          <p>
            {t.rich('control.nativeLogin.continueAs', {
              account,
              emphasis: (chunks) => <strong>{chunks}</strong>,
            })}
          </p>
          <form
            method="post"
            onSubmit={(event) => {
              if (submitted.current) {
                event.preventDefault()
                return
              }
              submitted.current = true
              setSubmitting(true)
            }}
          >
            <input type="hidden" name="csrf" value={csrf} />
            <button
              ref={submitButton}
              className="min-h-11 rounded bg-blue-800 px-4 py-3 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
              type="submit"
              disabled={submitting}
            >
              {t('control.nativeLogin.continue')}
            </button>
          </form>
          <button
            className="min-h-11 rounded px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
            type="button"
            disabled={submitting}
            onClick={() => signOut({ callbackUrl: login })}
          >
            {t('control.nativeLogin.otherAccount')}
          </button>
        </>
      ) : (
        <>
          <p>{t('control.nativeLogin.signInHint')}</p>
          <button
            className="min-h-11 rounded bg-blue-800 px-4 py-3 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-800"
            type="button"
            onClick={() => signOut({ callbackUrl: login })}
          >
            {t('control.accessibility.signIn')}
          </button>
        </>
      )}
    </main>
  )
}

export const getServerSideProps: GetServerSideProps<Props> = async ({
  req,
  res,
  query,
  locale,
}) => {
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Referrer-Policy', 'same-origin')
  res.setHeader('X-Frame-Options', 'DENY')
  res.setHeader(
    'Content-Security-Policy',
    "frame-ancestors 'none'; form-action 'self' ch.uzh.klicker.control:; base-uri 'none'"
  )
  const transaction =
    typeof query.transaction === 'string' &&
    /^[A-Za-z0-9_-]{43}$/.test(query.transaction)
      ? query.transaction
      : ''
  const messages = (
    await import(`@klicker-uzh/i18n/messages/${locale === 'de' ? 'de' : 'en'}`)
  ).default
  const props: Props = {
    transaction,
    csrf: '',
    account: null,
    failed: false,
    autoContinue: false,
    messages,
  }
  try {
    const service = await nativeHandoff()
    const cookieName = `__Host-control-native-${transaction}`
    let browser = req.cookies[cookieName]
    if (req.method === 'GET') {
      if (!browser) {
        browser = randomBytes(32).toString('base64url')
        res.setHeader(
          'Set-Cookie',
          `${cookieName}=${browser}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=300`
        )
      }
      await service.bind(transaction, browser)
      const evidence = await nativeBrowserEvidence(req)
      if (!evidence) {
        const login = `${locale === 'de' ? '/de' : ''}/?nativeTransaction=${encodeURIComponent(transaction)}`
        return { redirect: { destination: login, permanent: false } }
      }
      try {
        const principal = await service.principal(evidence)
        props.csrf = service.csrf(transaction, browser, principal.sub)
        const binding = nativeLoginBinding(
          `${service.authOrigin}/native/complete?transaction=${transaction}`,
          req.cookies,
          evidence.sub ?? ''
        )
        props.autoContinue =
          !!binding &&
          typeof evidence.controlNativeLogin === 'string' &&
          evidence.controlNativeLogin.length === binding.length &&
          timingSafeEqual(
            Buffer.from(evidence.controlNativeLogin),
            Buffer.from(binding)
          )
        props.account =
          typeof evidence.email === 'string'
            ? evidence.email
            : messages.control.nativeLogin.accountFallback
      } catch (error) {
        if (!(error instanceof NativeAuthError) || error.status !== 401)
          throw error
      }
    } else if (req.method === 'POST') {
      if (
        !browser ||
        req.headers.origin !== service.authOrigin ||
        !req.headers['content-type']?.startsWith(
          'application/x-www-form-urlencoded'
        )
      )
        throw new NativeAuthError()
      const chunks: Buffer[] = []
      let size = 0
      for await (const chunk of req) {
        size += chunk.length
        if (size > 1024) throw new NativeAuthError()
        chunks.push(Buffer.from(chunk))
      }
      const body = new URLSearchParams(Buffer.concat(chunks).toString('utf8'))
      const csrfValues = body.getAll('csrf')
      if (csrfValues.length !== 1) throw new NativeAuthError()
      const callback = await service.approve(
        transaction,
        browser,
        csrfValues[0]!,
        await nativeBrowserEvidence(req)
      )
      res.setHeader(
        'Set-Cookie',
        `${cookieName}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`
      )
      res.writeHead(303, { Location: callback })
      res.end()
      return { props }
    } else {
      throw new NativeAuthError(405)
    }
  } catch (error) {
    res.statusCode = error instanceof NativeAuthError ? error.status : 503
    props.failed = true
  }
  return { props }
}
