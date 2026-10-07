import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import {
  buildManifest,
  categorizeDoc,
  deriveRoute,
  extractHeadings,
  extractMedia,
  extractSummary,
  parseFrontmatter,
  parseUseCases,
  renderManifest,
} from './generate-docs-manifest.mjs'

const require = createRequire(import.meta.url)
const ts = require('typescript')

function makeFixture(additions = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'docs-manifest-'))
  const docsDir = path.join(root, 'docs')
  const staticDir = path.join(root, 'static')
  fs.mkdirSync(docsDir, { recursive: true })
  fs.mkdirSync(staticDir, { recursive: true })
  fs.mkdirSync(path.join(staticDir, 'img'), { recursive: true })
  fs.writeFileSync(path.join(staticDir, 'img', 'picture.png'), 'png')
  const files = {
    'tutorials/live_quiz.mdx':
      '---\ntitle: Live Quizzes\n---\n\nFirst paragraph here.\n\n## Setup\n\nText.\n\n![Shot](/img/picture.png)\n',
    ...additions,
  }
  for (const [relativePath, content] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(docsDir, relativePath)), {
      recursive: true,
    })
    fs.writeFileSync(path.join(docsDir, relativePath), content)
  }
  return { root, docsDir, staticDir }
}

function writeConstants(root, body) {
  const constantsPath = path.join(root, 'constants.tsx')
  fs.writeFileSync(constantsPath, body)
  return constantsPath
}

test('parseFrontmatter reads scalars and lists', () => {
  const { data, body } = parseFrontmatter(
    '---\ntitle: FAQ\ntags:\n  - a\n  - b\n---\n\nBody.'
  )
  assert.equal(data.title, 'FAQ')
  assert.deepEqual(data.tags, ['a', 'b'])
  assert.equal(body, '\nBody.')
})

test('parseFrontmatter passes through sources without frontmatter', () => {
  const { data, body } = parseFrontmatter('Plain body.')
  assert.deepEqual(data, {})
  assert.equal(body, 'Plain body.')
})

test('deriveRoute strips numeric prefixes and index files', () => {
  assert.equal(
    deriveRoute('01-tutorials/02-live_quiz.mdx'),
    '/tutorials/live_quiz/'
  )
  assert.equal(deriveRoute('getting_started/index.mdx'), '/getting_started/')
  assert.equal(deriveRoute('faq.mdx'), '/faq/')
})

test('categorizeDoc separates legal, student, and section pages', () => {
  assert.equal(categorizeDoc('datenschutz.mdx'), 'legal')
  assert.equal(categorizeDoc('terms_of_service.mdx'), 'legal')
  assert.equal(categorizeDoc('student_tutorials/chatbot.mdx'), 'student')
  assert.equal(categorizeDoc('gamification/awards.mdx'), 'gamification')
  assert.equal(categorizeDoc('faq.mdx'), 'general')
})

test('extractHeadings skips fenced blocks and cleans markup', () => {
  const body =
    '## Real [heading](/x)\n\n~~~md\n## Fake heading\n~~~\n### Deep topic'
  assert.deepEqual(extractHeadings(body), ['Real heading', 'Deep topic'])
})

test('extractSummary takes the first prose paragraph and truncates cleanly', () => {
  const summary = extractSummary(
    '# Title\n\n![img](/img/picture.png)\n\nShort summary text.'
  )
  assert.equal(summary, 'Short summary text.')
  const long = extractSummary('A '.repeat(200))
  assert.ok(long.length <= 241)
  assert.ok(long.endsWith('…'))
})

test('extractMedia keeps same-site images and allowlisted videos, omits other schemes', () => {
  const { docsDir, staticDir } = makeFixture()
  const body = fs.readFileSync(
    path.join(docsDir, 'tutorials/live_quiz.mdx'),
    'utf8'
  )
  const extended =
    body +
    '\n![Remote](https://example.org/x.png)' +
    '\n![Clip](https://www.youtube.com/watch?v=abc)' +
    '\n![Legacy](upload://abc.png)\n'
  const { media, skipped } = extractMedia(extended, staticDir)
  assert.deepEqual(media, [
    { type: 'image', url: '/img/picture.png' },
    { type: 'video', url: 'https://www.youtube.com/watch?v=abc' },
  ])
  assert.deepEqual(skipped, ['https://example.org/x.png', 'upload://abc.png'])
})

test('extractMedia rejects missing local media', () => {
  const { staticDir } = makeFixture()
  assert.throws(
    () => extractMedia('![Ghost](/img/missing.png)', staticDir),
    /Missing local media/
  )
})

test('parseUseCases extracts declared scalar and list metadata only', () => {
  const { root, staticDir } = makeFixture()
  const constantsPath = writeConstants(
    root,
    [
      "const ACK_STANDARD = 'ack'",
      'export const USE_CASES = {',
      '  live_quiz: {',
      '    acknowledgements: ACK_STANDARD,',
      "    title: 'Live Quizzes',",
      "    headerImgSrc: '/img/picture.png',",
      "    tags: ['gamified', 'feedback'],",
      "    goals: ['Engage students.'],",
      "    abstract: 'A summary.',",
      '    introduction: (',
      '      <>',
      '        <p>Rendered prose that must never be extracted.</p>',
      '      </>',
      '    ),',
      '  },',
      '}',
    ].join('\n')
  )
  const useCases = parseUseCases(constantsPath, ts, staticDir)
  assert.deepEqual(useCases, [
    {
      id: 'live_quiz',
      route: '/use_cases/live_quiz/',
      title: 'Live Quizzes',
      summary: 'A summary.',
      tags: ['gamified', 'feedback'],
      goals: ['Engage students.'],
      media: [{ type: 'image', url: '/img/picture.png' }],
      sourceCategory: 'use_case',
    },
  ])
})

test('parseUseCases rejects missing use-case media', () => {
  const { root, staticDir } = makeFixture()
  const constantsPath = writeConstants(
    root,
    "export const USE_CASES = { broken: { title: 'X', headerImgSrc: '/img/missing.png' } }"
  )
  assert.throws(
    () => parseUseCases(constantsPath, ts, staticDir),
    /Missing local media/
  )
})

test('buildManifest rejects duplicate routes', () => {
  const { docsDir, staticDir } = makeFixture({
    'tutorials/live_quiz/index.mdx': '---\ntitle: Tutorials\n---\n\nIntro.\n',
  })
  assert.throws(
    () => buildManifest({ docsDir, staticDir }),
    /Duplicate docs route/
  )
})

test('real docs tree produces a deterministic, drift-free manifest', () => {
  const first = buildManifest()
  const second = buildManifest()
  assert.equal(renderManifest(first), renderManifest(second))
  assert.match(first.contentDigest, /^sha256:[0-9a-f]{64}$/)
  const realDocsDir = path.resolve(import.meta.dirname, '..', 'docs')
  const mdxCount = fs
    .readdirSync(realDocsDir, { recursive: true })
    .filter((file) => file.endsWith('.mdx')).length
  assert.equal(first.pages.length, mdxCount)
  assert.ok(first.useCases.length >= 11)
  const checkedIn = fs.readFileSync(
    path.resolve(
      import.meta.dirname,
      '..',
      'src',
      'generated',
      'docs-manifest.json'
    ),
    'utf8'
  )
  assert.equal(renderManifest(first), checkedIn)
})
