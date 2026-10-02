const assert = require('node:assert/strict')
const http = require('node:http')
const net = require('node:net')
const test = require('node:test')
const { waitForMailhog } = require('./wait-for-mailhog.cjs')

async function fixtures(t, { apiReady = true, smtpReady = true } = {}) {
  let requests = 0
  const api = http.createServer((req, res) => {
    requests++
    assert.equal(req.url, '/api/v2/messages?limit=1')
    res.writeHead(apiReady ? 200 : 503, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ items: [] }))
  })
  const smtp = net.createServer((socket) => {
    socket.end(
      smtpReady ? '220 synthetic SMTP ready\r\n' : '421 unavailable\r\n'
    )
  })
  await Promise.all([
    new Promise((resolve) => api.listen(0, '127.0.0.1', resolve)),
    new Promise((resolve) => smtp.listen(0, '127.0.0.1', resolve)),
  ])
  t.after(() => {
    api.closeAllConnections()
    api.close()
    smtp.close()
  })
  return {
    options: {
      url: `http://127.0.0.1:${api.address().port}`,
      host: '127.0.0.1',
      port: smtp.address().port,
      timeoutMs: 150,
      intervalMs: 5,
    },
    requests: () => requests,
    disconnectApi: () => new Promise((resolve) => api.close(resolve)),
    recover: () => {
      apiReady = true
    },
  }
}

test('readiness requires the MailHog HTTP API and an SMTP greeting', async (t) => {
  const { options } = await fixtures(t)
  await waitForMailhog(options)
})

test('an unavailable API fails within the readiness deadline', async (t) => {
  const { options, requests } = await fixtures(t, { apiReady: false })
  await assert.rejects(waitForMailhog(options), /MailHog readiness timed out/)
  assert.ok(requests() > 1)
})

test('a working HTTP API does not hide an unavailable SMTP server', async (t) => {
  const { options } = await fixtures(t, { smtpReady: false })
  await assert.rejects(waitForMailhog(options), /MailHog readiness timed out/)
})

test('a refused HTTP connection cannot report readiness', async (t) => {
  const { options, disconnectApi } = await fixtures(t)
  await disconnectApi()
  await assert.rejects(waitForMailhog(options), /MailHog readiness timed out/)
})

test('readiness retries a starting service', async (t) => {
  const { options, recover, requests } = await fixtures(t, { apiReady: false })
  const timer = setTimeout(recover, 30)
  t.after(() => clearTimeout(timer))
  await waitForMailhog({ ...options, timeoutMs: 1000 })
  assert.ok(requests() > 1)
})
