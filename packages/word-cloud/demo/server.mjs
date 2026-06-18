import { readFile, stat } from 'node:fs/promises'
import { createServer } from 'node:http'
import { extname, join, normalize, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const demoRoot = fileURLToPath(new URL('./', import.meta.url))
const packageRoot = fileURLToPath(new URL('../', import.meta.url))
const distRoot = join(packageRoot, 'dist')
const host = '127.0.0.1'
const port = 4173

const contentTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
}

function resolvePath(root, requestPath) {
  const sanitizedPath = normalize(requestPath).replace(/^(\.\.[/\\])+/, '')
  const resolvedRoot = resolve(root)
  const resolvedPath = resolve(resolvedRoot, sanitizedPath)
  const relativePath = relative(resolvedRoot, resolvedPath)

  if (
    relativePath === '..' ||
    relativePath.startsWith(`..${sep}`) ||
    resolve(relativePath) === relativePath
  ) {
    throw new Error('Resolved path escapes demo root')
  }

  return resolvedPath
}

async function readResolvedFile(filePath) {
  const fileStats = await stat(filePath)
  if (fileStats.isDirectory()) {
    return readResolvedFile(join(filePath, 'index.html'))
  }

  return readFile(filePath)
}

const server = createServer(async (request, response) => {
  try {
    const requestUrl = new URL(request.url ?? '/', `http://${host}:${port}`)
    const pathname =
      requestUrl.pathname === '/' ? '/index.html' : requestUrl.pathname
    const root = pathname.startsWith('/dist/') ? distRoot : demoRoot
    const relativePath = pathname.startsWith('/dist/')
      ? pathname.replace('/dist/', '')
      : pathname.slice(1)
    const resolvedPath = resolvePath(root, relativePath)
    const finalPath = (await stat(resolvedPath)).isDirectory()
      ? resolvePath(resolvedPath, 'index.html')
      : resolvedPath
    const file = await readResolvedFile(finalPath)
    const extension = extname(finalPath)
    const contentType =
      contentTypes[extension] ?? 'application/octet-stream; charset=utf-8'

    response.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store',
    })
    response.end(file)
  } catch {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' })
    response.end('Not found')
  }
})

server.listen(port, host, () => {
  process.stdout.write(`Demo server running at http://${host}:${port}\n`)
})
