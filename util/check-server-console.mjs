import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const serverRoots = [
  'apps/backend-docker/src',
  'apps/response-api/src',
  'apps/hatchet-worker-general/src',
  'apps/hatchet-worker-response-processor/src',
  'apps/auth/src/lib/server',
  'apps/auth/src/pages/api/auth',
  'apps/auth/src/proxy.ts',
  'apps/chat/src/proxy.ts',
  'apps/lti/src',
  'apps/olat-api/src',
  'apps/chat/src/app/api',
  'apps/chat/src/lib/server',
  'apps/chat/src/services/mcpClients.ts',
  'apps/frontend-manage/src/lib/server',
  'apps/frontend-pwa/src/lib/server',
  'apps/frontend-control/src/lib/server',
  'packages/logging/src',
  'packages/graphql/src/services',
]
const allowedFiles = new Set(['packages/logging/src/edge.ts'])
const sourceExtensions = new Set(['.js', '.jsx', '.mjs', '.cjs', '.ts', '.tsx'])
const consoleMethods = new Set(['log', 'info', 'warn', 'error', 'debug'])

export function findActiveConsoleCalls(source, fileName = 'server.tsx') {
  const file = ts.createSourceFile(
    fileName,
    source,
    ts.ScriptTarget.Latest,
    true
  )
  const findings = []
  function visit(node) {
    if (ts.isCallExpression(node)) {
      const target = node.expression
      const receiver =
        ts.isPropertyAccessExpression(target) ||
        ts.isElementAccessExpression(target)
          ? target.expression
          : undefined
      const method = ts.isPropertyAccessExpression(target)
        ? target.name.text
        : ts.isElementAccessExpression(target) &&
            ts.isStringLiteral(target.argumentExpression)
          ? target.argumentExpression.text
          : undefined
      if (
        receiver &&
        ts.isIdentifier(receiver) &&
        receiver.text === 'console' &&
        consoleMethods.has(method)
      ) {
        findings.push({
          line:
            file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1,
          method,
        })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(file)
  return findings.sort((a, b) => a.line - b.line)
}

function toRepoPath(path) {
  return relative(repoRoot, path).split('\\').join('/')
}

async function collectSourceFiles(path) {
  const details = await stat(path)
  if (details.isFile()) {
    return sourceExtensions.has(extname(path)) ? [path] : []
  }

  const files = []
  const entries = await readdir(path, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isDirectory() && entry.name === 'scripts') continue
    const entryPath = resolve(path, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await collectSourceFiles(entryPath)))
    } else if (entry.isFile() && sourceExtensions.has(extname(entry.name))) {
      files.push(entryPath)
    }
  }
  return files
}

export async function scanServerConsoleCalls() {
  const files = (
    await Promise.all(
      serverRoots.map((root) => collectSourceFiles(resolve(repoRoot, root)))
    )
  )
    .flat()
    .sort()
  const findings = []

  for (const file of files) {
    const path = toRepoPath(file)
    if (allowedFiles.has(path)) continue

    const source = await readFile(file, 'utf8')
    for (const finding of findActiveConsoleCalls(source, file)) {
      findings.push({ path, ...finding })
    }
  }

  return findings
}

async function main() {
  const findings = await scanServerConsoleCalls()
  if (findings.length === 0) {
    console.log('Server console check passed.')
    return
  }

  for (const finding of findings) {
    console.error(
      `${finding.path}:${finding.line}: console.${finding.method} is not allowed in server-owned code`
    )
  }
  process.exitCode = 1
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  await main()
}
