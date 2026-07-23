import { readFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_HOST = '127.0.0.1'
const DEFAULT_PORT = 3020
const CONTENT_TYPE = 'text/html; charset=utf-8'

const currentDir = dirname(fileURLToPath(import.meta.url))
const indexPath = join(currentDir, 'index.html')

function send(res, statusCode, body, headers = {}) {
  res.writeHead(statusCode, headers)
  res.end(body)
}

const server = createServer(async (req, res) => {
  const method = req.method ?? 'GET'
  const url = new URL(
    req.url ?? '/',
    `http://${req.headers.host ?? 'localhost'}`
  )

  if (method !== 'GET' && method !== 'HEAD') {
    send(res, 405, method === 'HEAD' ? undefined : 'Method Not Allowed', {
      Allow: 'GET, HEAD',
      'Content-Type': 'text/plain; charset=utf-8',
    })
    return
  }

  if (url.pathname === '/favicon.ico') {
    send(res, 204, undefined)
    return
  }

  if (url.pathname !== '/' && url.pathname !== '/index.html') {
    send(res, 404, method === 'HEAD' ? undefined : 'Not Found', {
      'Content-Type': 'text/plain; charset=utf-8',
    })
    return
  }

  try {
    const html = await readFile(indexPath)
    send(res, 200, method === 'HEAD' ? undefined : html, {
      'Cache-Control': 'no-store',
      'Content-Type': CONTENT_TYPE,
    })
  } catch (error) {
    send(
      res,
      500,
      method === 'HEAD' ? undefined : 'Failed to read harness HTML',
      {
        'Content-Type': 'text/plain; charset=utf-8',
      }
    )
    console.error(error)
  }
})

const port = Number.parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10)
const host = process.env.HOST || DEFAULT_HOST

server.listen(port, host, () => {
  console.log(`Embed harness running at http://${host}:${port}`)
})
