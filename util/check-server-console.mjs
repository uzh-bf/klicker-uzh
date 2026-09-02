import { readdir, readFile, stat } from 'node:fs/promises'
import { dirname, extname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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
const consoleCallPattern = /\bconsole\s*\.\s*(log|info|warn|error|debug)\s*\(/g

function replaceCommentCharacter(character) {
  return character === '\n' ? '\n' : ' '
}

export function stripComments(source) {
  let result = ''
  let state = 'code'
  let escaped = false

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    const next = source[index + 1]

    if (state === 'line-comment') {
      result += replaceCommentCharacter(character)
      if (character === '\n') state = 'code'
      continue
    }

    if (state === 'block-comment') {
      if (character === '*' && next === '/') {
        result += '  '
        index += 1
        state = 'code'
      } else {
        result += replaceCommentCharacter(character)
      }
      continue
    }

    if (state !== 'code') {
      result += character
      if (escaped) {
        escaped = false
      } else if (character === '\\') {
        escaped = true
      } else if (
        (state === 'single-quote' && character === "'") ||
        (state === 'double-quote' && character === '"') ||
        (state === 'template' && character === '`')
      ) {
        state = 'code'
      }
      continue
    }

    if (character === '/' && next === '/') {
      result += '  '
      index += 1
      state = 'line-comment'
    } else if (character === '/' && next === '*') {
      result += '  '
      index += 1
      state = 'block-comment'
    } else {
      result += character
      if (character === "'") state = 'single-quote'
      else if (character === '"') state = 'double-quote'
      else if (character === '`') state = 'template'
    }
  }

  return result
}

function maskStrings(source) {
  let result = ''
  let quote = null
  let escaped = false

  for (const character of source) {
    if (quote) {
      result += character === '\n' ? '\n' : ' '
      if (escaped) {
        escaped = false
      } else if (character === '\\') {
        escaped = true
      } else if (character === quote) {
        quote = null
      }
      continue
    }

    if (character === "'" || character === '"' || character === '`') {
      quote = character
      result += ' '
    } else {
      result += character
    }
  }

  return result
}

function skipQuoted(source, start, quote) {
  let escaped = false
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index]
    if (escaped) {
      escaped = false
    } else if (character === '\\') {
      escaped = true
    } else if (character === quote) {
      return index + 1
    }
  }
  return source.length
}

function skipTemplate(source, start) {
  for (let index = start + 1; index < source.length; index += 1) {
    const character = source[index]
    if (character === '\\') {
      index += 1
    } else if (character === '`') {
      return index + 1
    } else if (character === '$' && source[index + 1] === '{') {
      const end = findBraceEnd(source, index + 2)
      index = end
    }
  }
  return source.length
}

function findBraceEnd(source, start) {
  let depth = 1
  for (let index = start; index < source.length; index += 1) {
    const character = source[index]
    const next = source[index + 1]
    if (character === "'" || character === '"') {
      index = skipQuoted(source, index, character) - 1
    } else if (character === '`') {
      index = skipTemplate(source, index) - 1
    } else if (character === '/' && next === '/') {
      const newline = source.indexOf('\n', index + 2)
      index = newline === -1 ? source.length : newline
    } else if (character === '/' && next === '*') {
      const end = source.indexOf('*/', index + 2)
      index = end === -1 ? source.length : end + 1
    } else if (character === '{') {
      depth += 1
    } else if (character === '}' && --depth === 0) {
      return index
    }
  }
  return source.length
}

function extractTemplateExpressions(source) {
  const expressions = []
  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    if (character === "'" || character === '"') {
      index = skipQuoted(source, index, character) - 1
    } else if (character === '`') {
      for (let cursor = index + 1; cursor < source.length; cursor += 1) {
        if (source[cursor] === '\\') {
          cursor += 1
        } else if (source[cursor] === '`') {
          index = cursor
          break
        } else if (source[cursor] === '$' && source[cursor + 1] === '{') {
          const end = findBraceEnd(source, cursor + 2)
          expressions.push({
            source: source.slice(cursor + 2, end),
            start: cursor + 2,
          })
          cursor = end
        }
      }
    }
  }
  return expressions
}

export function findActiveConsoleCalls(source) {
  const commentFree = stripComments(source)
  const searchable = maskStrings(commentFree)
  const findings = []

  for (const [lineIndex, line] of searchable.split('\n').entries()) {
    consoleCallPattern.lastIndex = 0
    for (const match of line.matchAll(consoleCallPattern)) {
      findings.push({ line: lineIndex + 1, method: match[1] })
    }
  }

  // Template literals are strings except for their `${...}` expressions.
  // Scan those expressions recursively so interpolation calls cannot hide
  // behind the string masker.
  for (const expression of extractTemplateExpressions(commentFree)) {
    const lineOffset =
      commentFree.slice(0, expression.start).split('\n').length - 1
    for (const finding of findActiveConsoleCalls(expression.source)) {
      findings.push({ ...finding, line: finding.line + lineOffset })
    }
  }

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
    for (const finding of findActiveConsoleCalls(source)) {
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
