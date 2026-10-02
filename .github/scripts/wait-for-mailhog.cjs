// biome-ignore-all lint/suspicious/noUndeclaredEnvVars: CI preflight runs directly under Node, outside Turborepo.
const net = require('node:net')
const { setTimeout: delay } = require('node:timers/promises')

function smtpReady(host, port, timeoutMs) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port })
    let greeting = ''
    const finish = (ready) => {
      socket.destroy()
      resolve(ready)
    }
    socket.setTimeout(timeoutMs)
    socket.on('data', (chunk) => {
      greeting += chunk.toString()
      if (greeting.includes('\n')) finish(/^220[ -]/.test(greeting))
      else if (greeting.length > 1024) finish(false)
    })
    socket.on('timeout', () => finish(false))
    socket.on('error', () => finish(false))
    socket.on('end', () => finish(false))
    socket.on('close', () => finish(false))
  })
}

async function waitForMailhog({
  url,
  host,
  port = 1025,
  timeoutMs = 60_000,
  intervalMs = 1000,
}) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const probeTimeout = Math.max(1, Math.min(2000, deadline - Date.now()))
    try {
      const [response, smtp] = await Promise.all([
        fetch(`${url}/api/v2/messages?limit=1`, {
          signal: AbortSignal.timeout(probeTimeout),
        }),
        smtpReady(host, port, probeTimeout),
      ])
      const body = await response.json()
      if (response.ok && Array.isArray(body.items) && smtp) return
    } catch {
      // DNS, connection and startup errors are retryable within the deadline.
    }
    await delay(Math.max(0, Math.min(intervalMs, deadline - Date.now())))
  }
  throw new Error(
    'MailHog readiness timed out: HTTP API and SMTP must both be ready'
  )
}

if (require.main === module) {
  if (!process.env.MAILHOG_URL || !process.env.EMAIL_HOST) {
    console.error(
      'MAILHOG_URL and EMAIL_HOST are required for the CI mail service'
    )
    process.exitCode = 1
  } else {
    waitForMailhog({
      url: process.env.MAILHOG_URL,
      host: process.env.EMAIL_HOST,
      port: Number(process.env.EMAIL_PORT ?? 1025),
    }).then(
      () => console.log('MailHog HTTP API and SMTP are ready'),
      (error) => {
        console.error(error.message)
        process.exitCode = 1
      }
    )
  }
}

module.exports = { waitForMailhog }
