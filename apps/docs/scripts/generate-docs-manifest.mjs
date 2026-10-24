import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const SCHEMA_VERSION = 1
const APP_ROOT = path.resolve(import.meta.dirname, '..')
const DOCS_DIR = path.join(APP_ROOT, 'docs')
const STATIC_DIR = path.join(APP_ROOT, 'static')
const CONSTANTS_PATH = path.join(APP_ROOT, 'src', 'constants.tsx')
const VERSIONS_PATH = path.join(APP_ROOT, 'versions.json')
const MANIFEST_PATH = path.join(
  APP_ROOT,
  'src',
  'generated',
  'docs-manifest.json'
)

const VIDEO_HOST_ALLOWLIST = new Set([
  'www.youtube.com',
  'youtube.com',
  'youtu.be',
  'player.vimeo.com',
])

const LEGAL_PAGE_NAMES = new Set([
  'datenschutz',
  'nutzungsbedingungen',
  'privacy_policy',
  'terms_of_service',
])

const require = createRequire(import.meta.url)

function stripFences(body) {
  return body.replace(/^(```|~~~)[\s\S]*?^\1.*$/gm, '')
}

export function parseFrontmatter(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(source)
  if (!match) {
    return { data: {}, body: source }
  }
  const data = {}
  let currentListKey = null
  for (const line of match[1].split(/\r?\n/)) {
    if (/^\s*-\s+/.test(line) && currentListKey) {
      data[currentListKey].push(line.replace(/^\s*-\s+/, '').trim())
      continue
    }
    const pair = /^([a-zA-Z_-]+):\s*(.*)$/.exec(line)
    if (!pair) {
      currentListKey = null
      continue
    }
    const key = pair[1]
    const value = pair[2].trim()
    if (value === '') {
      data[key] = []
      currentListKey = key
    } else {
      currentListKey = null
      data[key] = value.replace(/^['"]|['"]$/g, '')
    }
  }
  return { data, body: source.slice(match[0].length) }
}

export function deriveRoute(relativePath) {
  const withoutExt = relativePath.replace(/\.mdx?$/, '')
  const segments = withoutExt.split('/')
  const base = segments.pop()
  const cleaned = segments
    .map((segment) => segment.replace(/^\d+-/, ''))
    .concat(
      /^(index|readme)$/i.test(base.replace(/^\d+-/, ''))
        ? []
        : [base.replace(/^\d+-/, '')]
    )
  return `/${cleaned.join('/')}/`
}

export function categorizeDoc(relativePath) {
  const segments = relativePath.split('/')
  if (segments.length === 1) {
    return LEGAL_PAGE_NAMES.has(segments[0].replace(/\.mdx?$/, ''))
      ? 'legal'
      : 'general'
  }
  if (segments[0] === 'student_tutorials') {
    return 'student'
  }
  return segments[0]
}

export function extractHeadings(body) {
  const headings = []
  for (const line of stripFences(body).split(/\r?\n/)) {
    const match = /^#{2,3}\s+(.+)$/.exec(line)
    if (match) {
      headings.push(
        match[1]
          .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
          .replace(/`/g, '')
          .trim()
      )
    }
  }
  return headings
}

export function extractSummary(body) {
  const maxLength = 240
  for (const line of stripFences(body).split(/\r?\n/)) {
    const trimmed = line.trim()
    if (
      trimmed === '' ||
      trimmed.startsWith('#') ||
      trimmed.startsWith('<') ||
      trimmed.startsWith('import ') ||
      trimmed.startsWith('export ') ||
      trimmed.startsWith('![')
    ) {
      continue
    }
    const text = trimmed
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/[*_`]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    if (text === '') {
      continue
    }
    if (text.length <= maxLength) {
      return text
    }
    return `${text.slice(0, text.lastIndexOf(' ', maxLength))}…`
  }
  return ''
}

export function extractMedia(body, staticDir) {
  const content = stripFences(body)
  const media = []
  const skipped = []
  const seen = new Set()
  const add = (item) => {
    if (seen.has(item.url)) {
      return
    }
    seen.add(item.url)
    media.push(item)
  }
  for (const match of content.matchAll(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g)) {
    classifyMediaUrl(match[2], staticDir, add, skipped)
  }
  for (const tag of content.matchAll(/<img\b([\s\S]*?)>/g)) {
    const src = /src=["']([^"']+)["']/.exec(tag[1])
    if (src) {
      classifyMediaUrl(src[1], staticDir, add, skipped)
    }
  }
  media.sort((a, b) => a.url.localeCompare(b.url))
  return { media, skipped }
}

function classifyMediaUrl(url, staticDir, add, skipped) {
  if (url.startsWith('/')) {
    const localPath = path.join(staticDir, url)
    if (!fs.existsSync(localPath)) {
      throw new Error(`Missing local media for ${url}`)
    }
    add({ type: 'image', url })
    return
  }
  let parsed
  try {
    parsed = new URL(url)
  } catch {
    skipped.push(url)
    return
  }
  if (
    parsed.protocol === 'https:' &&
    VIDEO_HOST_ALLOWLIST.has(parsed.hostname)
  ) {
    add({ type: 'video', url })
    return
  }
  skipped.push(url)
}

export function parseUseCases(constantsPath, ts, staticDir = STATIC_DIR) {
  const source = ts.createSourceFile(
    constantsPath,
    fs.readFileSync(constantsPath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  )
  let declaration = null
  for (const statement of source.statements) {
    if (
      ts.isVariableStatement(statement) &&
      statement.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      )
    ) {
      for (const binding of statement.declarationList.declarations) {
        if (
          ts.isIdentifier(binding.name) &&
          binding.name.text === 'USE_CASES' &&
          binding.initializer &&
          ts.isObjectLiteralExpression(binding.initializer)
        ) {
          declaration = binding.initializer
        }
      }
    }
  }
  if (!declaration) {
    throw new Error('USE_CASES export not found in constants')
  }
  const useCases = []
  for (const property of declaration.properties) {
    if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) {
      continue
    }
    if (!ts.isObjectLiteralExpression(property.initializer)) {
      continue
    }
    const id = property.name.text
    const scalars = {}
    const lists = {}
    for (const field of property.initializer.properties) {
      if (!ts.isPropertyAssignment(field) || !ts.isIdentifier(field.name)) {
        continue
      }
      const value = field.initializer
      if (ts.isStringLiteralLike(value)) {
        scalars[field.name.text] = value.text
      } else if (
        ts.isArrayLiteralExpression(value) &&
        value.elements.every((element) => ts.isStringLiteralLike(element))
      ) {
        lists[field.name.text] = value.elements.map((element) => element.text)
      }
    }
    const media = []
    if (scalars.headerImgSrc) {
      const staticPath = path.join(staticDir, scalars.headerImgSrc)
      if (!fs.existsSync(staticPath)) {
        throw new Error(
          `Missing local media for use case ${id}: ${scalars.headerImgSrc}`
        )
      }
      media.push({ type: 'image', url: scalars.headerImgSrc })
    }
    useCases.push({
      id,
      route: `/use_cases/${id}/`,
      title: scalars.title ?? id,
      summary: scalars.abstract ?? '',
      tags: lists.tags ?? [],
      goals: lists.goals ?? [],
      media,
      sourceCategory: 'use_case',
    })
  }
  return useCases
}

function readDocsVersion() {
  const versions = JSON.parse(fs.readFileSync(VERSIONS_PATH, 'utf8'))
  return Array.isArray(versions) && versions.length > 0
    ? versions[0]
    : 'current'
}

export function buildManifest(options = {}) {
  const docsDir = options.docsDir ?? DOCS_DIR
  const staticDir = options.staticDir ?? STATIC_DIR
  const constantsPath = options.constantsPath ?? CONSTANTS_PATH
  const ts = options.ts ?? require('typescript')
  const skippedUnsupported = []
  const mdxFiles = fs
    .readdirSync(docsDir, { recursive: true })
    .filter((file) => file.endsWith('.mdx'))
    .sort()
  const pages = mdxFiles.map((relativePath) => {
    const source = fs.readFileSync(path.join(docsDir, relativePath), 'utf8')
    const { data, body } = parseFrontmatter(source)
    const route = deriveRoute(relativePath)
    const { media, skipped } = extractMedia(body, staticDir)
    skippedUnsupported.push(...skipped.map((url) => ({ route, url })))
    const headingMatch = /^#\s+(.+)$/m.exec(stripFences(body))
    const title =
      data.title ??
      (headingMatch ? headingMatch[1].trim() : undefined) ??
      relativePath.replace(/\.mdx?$/, '').replace(/[-_]/g, ' ')
    return {
      route,
      title,
      headings: extractHeadings(body),
      summary: extractSummary(body),
      tags: Array.isArray(data.tags) ? data.tags : [],
      media,
      sourcePath: `docs/${relativePath}`,
      sourceCategory: categorizeDoc(relativePath),
    }
  })
  const routes = new Set()
  for (const page of pages) {
    if (routes.has(page.route)) {
      throw new Error(`Duplicate docs route: ${page.route}`)
    }
    routes.add(page.route)
  }
  const useCases = parseUseCases(constantsPath, ts).sort((a, b) =>
    a.id.localeCompare(b.id)
  )
  const useCaseRoutes = new Set()
  for (const useCase of useCases) {
    if (routes.has(useCase.route) || useCaseRoutes.has(useCase.route)) {
      throw new Error(`Duplicate docs route: ${useCase.route}`)
    }
    useCaseRoutes.add(useCase.route)
  }
  const docsVersion = readDocsVersion()
  const withoutDigest = {
    schemaVersion: SCHEMA_VERSION,
    docsVersion,
    pages,
    useCases,
  }
  const digest = createHash('sha256')
    .update(JSON.stringify(withoutDigest))
    .digest('hex')
  return {
    ...withoutDigest,
    contentDigest: `sha256:${digest}`,
    _skippedUnsupportedMedia: skippedUnsupported,
  }
}

export function renderManifest(manifest) {
  const { _skippedUnsupportedMedia, ...published } = manifest
  return `${JSON.stringify(published, null, 2)}\n`
}

function main() {
  const checkOnly = process.argv.includes('--check')
  const manifest = buildManifest()
  const rendered = renderManifest(manifest)
  if (checkOnly) {
    const current = fs.existsSync(MANIFEST_PATH)
      ? fs.readFileSync(MANIFEST_PATH, 'utf8')
      : ''
    if (current !== rendered) {
      console.error(
        'Docs manifest is drifted. Run: pnpm --filter @klicker-uzh/docs generate:docs-manifest'
      )
      process.exitCode = 1
      return
    }
    console.log('Docs manifest is up to date.')
    return
  }
  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true })
  fs.writeFileSync(MANIFEST_PATH, rendered)
  console.log(
    `Docs manifest written: ${manifest.pages.length} pages, ${manifest.useCases.length} use cases, ${rendered.split('\n').length} lines.`
  )
  if (manifest._skippedUnsupportedMedia.length > 0) {
    console.log(
      `Omitted ${manifest._skippedUnsupportedMedia.length} unsupported media reference(s).`
    )
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main()
}
