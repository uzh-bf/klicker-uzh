import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { setTimeout as delay } from 'node:timers/promises'

const app = process.argv[2]
const server = spawn(process.execPath, [`apps/${app}/server.js`], {
  env: { ...process.env, PORT: '31901', HOSTNAME: '127.0.0.1' },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let logs = ''
server.stdout.on('data', (data) => {
  logs += data
})
server.stderr.on('data', (data) => {
  logs += data
})
try {
  let ready = false
  for (let attempt = 0; attempt < 60; attempt++) {
    try {
      await fetch('http://127.0.0.1:31901/en/intl-context-probe', {
        redirect: 'manual',
        signal: AbortSignal.timeout(1000),
      })
      ready = true
      break
    } catch {
      await delay(250)
    }
  }
  assert(ready, 'Production server did not start')
  const results = []
  for (const locale of ['en', 'de']) {
    const response = await fetch(
      `http://127.0.0.1:31901/${locale}/intl-context-probe`,
      {
        redirect: 'manual',
        signal: AbortSignal.timeout(10000),
      }
    )
    const html = await response.text()
    const rendered = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    const translated = rendered.includes(`INTL_CONTEXT_PROBE_${locale}`)
    results.push({ locale, status: response.status, translated })
    assert.equal(response.status, 200, `${locale}: production SSR failed`)
    assert(
      translated,
      `${locale}: shared hook did not receive the app messages`
    )
  }
  assert(
    !/Failed to call.*useTranslations|context from.*NextIntlClientProvider/.test(
      logs
    ),
    'Translation context exception'
  )
  console.log(
    JSON.stringify({
      ...JSON.parse(readFileSync('/app/intl-receipt.json', 'utf8')),
      results,
    })
  )
} catch (error) {
  console.error(
    JSON.stringify({
      missingTranslationContext:
        /Failed to call.*useTranslations|context from.*NextIntlClientProvider/.test(
          logs
        ),
    })
  )
  throw error
} finally {
  server.kill('SIGTERM')
}
