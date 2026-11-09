import { describe, expect, it, vi } from 'vitest'
import {
  copyImagesForImport,
  findForeignImages,
  findImageLinks,
  rewriteImageLinks,
} from '../src/lib/elementWorkbook/media.js'
import type { WorkbookElement } from '../src/lib/elementWorkbook/parse.js'
import { elementIdentity, planImport } from '../src/lib/elementWorkbook/plan.js'

const account = 'https://klickerdev.example/klickerdev'
const owner = '11111111-1111-1111-1111-111111111111'
const source = `${account}/22222222-2222-2222-2222-222222222222/a.png`
const copy = `${account}/${owner}/copied.png`

const element: WorkbookElement = {
  sheet: 'Single choice',
  row: 8,
  name: 'With images',
  type: 'SC',
  content: `See ![chart](${source}) and <img src="${account}/${owner}/own.png">`,
  explanation: `![ext](https://example.org/x.png) ![again](${source} "title")`,
  basePoints: true,
  pointsMultiplier: 1,
  tags: [],
  options: {
    displayMode: 'LIST',
    hasSampleSolution: true,
    hasAnswerFeedbacks: true,
    choices: [
      { ix: 0, value: `![](${source})`, correct: true, feedback: 'Yes' },
      { ix: 1, value: 'No image', correct: false, feedback: 'No' },
    ],
  },
}

/** A content element whose only image is the given link. */
const imageOnly = (href: string): WorkbookElement => ({
  sheet: 'Content',
  row: 8,
  name: 'Image only',
  type: 'CONTENT',
  content: `![](${href})`,
  explanation: null,
  basePoints: false,
  pointsMultiplier: 1,
  tags: [],
  options: {},
})

describe('element workbook images', () => {
  it('finds Markdown and HTML image links', () => {
    expect(
      findImageLinks('![a](<https://x/a.png>) <img alt="" src="https://x/b">')
    ).toEqual(['https://x/a.png', 'https://x/b'])
  })

  it('selects only other lecturers’ images from the configured account', () => {
    expect(findForeignImages([element], owner, account)).toEqual([
      {
        href: source,
        container: '22222222-2222-2222-2222-222222222222',
        blob: 'a.png',
      },
    ])
  })

  it('rewrites every occurrence, including choices and feedback-free fields', () => {
    const [rewritten] = rewriteImageLinks([element], new Map([[source, copy]]))
    expect(rewritten!.content).toContain(copy)
    expect(rewritten!.content).not.toContain(source)
    expect(rewritten!.explanation).toContain(`![again](${copy} "title")`)
    expect(
      'choices' in rewritten!.options && rewritten!.options.choices[0]!.value
    ).toBe(`![](${copy})`)
  })

  it('treats an imported copy as the same element as its workbook row', () => {
    const [imported] = rewriteImageLinks([element], new Map([[source, copy]]))
    const normalize = (text: string) => text.replaceAll(copy, source)
    expect(elementIdentity(imported!, normalize)).toBe(elementIdentity(element))
    expect(elementIdentity(imported!)).not.toBe(elementIdentity(element))
    expect(
      planImport(
        [element],
        [{ id: 7, identity: elementIdentity(imported!, normalize) }],
        normalize
      )[0]
    ).toMatchObject({ action: 'SKIP_EXISTING', existingId: 7 })
  })

  it('ignores non-user containers and nested or traversing paths', () => {
    const other = '22222222-2222-2222-2222-222222222222'
    const candidate = (href: string) =>
      findForeignImages([imageOnly(href)], owner, account)
    expect(candidate(`${account}/private-container/report.pdf`)).toEqual([])
    expect(candidate(`${account}/${other}/nested/a.png`)).toEqual([])
    expect(candidate(`${account}/${other}/..%2Fa.png`)).toEqual([])
    expect(candidate(`${account}/${other}/../x/a.png`)).toEqual([])
  })

  it('never copies an image that is not registered media of its container owner', async () => {
    vi.stubEnv('BLOB_STORAGE_ACCOUNT_NAME', 'klickerdev')
    vi.stubEnv('BLOB_STORAGE_ACCESS_KEY', 'dGVzdA==')
    vi.stubEnv('BLOB_STORAGE_ACCOUNT_URL', account)
    const other = '22222222-2222-2222-2222-222222222222'
    const href = `${account}/${other}/a.png`
    const findMany = vi.fn(async ({ where }: { where: { href?: unknown } }) =>
      // The link exists as media, but of a different owner than its container.
      where.href ? [{ href, ownerId: owner, name: 'a.png' }] : []
    )
    const links = await copyImagesForImport(
      { mediaFile: { findMany } } as never,
      owner,
      [imageOnly(href)]
    )
    expect(links.size).toBe(0)
    vi.unstubAllEnvs()
  })
})
