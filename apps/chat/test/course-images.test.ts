import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { type ToolSet, tool } from 'ai'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'
import { readCourseImage } from '../src/lib/server/courseImageStore'
import { withCourseImageTool } from '../src/lib/server/courseImageTools'
import {
  courseImageCandidates,
  selectedCourseImages,
} from '../src/lib/sources/courseImages'

const root = path.resolve('scripts/fixtures/course-images')
const fixture = JSON.parse(
  await readFile(path.join(root, 'query-result.json'), 'utf8')
)
const candidate = courseImageCandidates(fixture)[0]!
const options = { toolCallId: 'synthetic', messages: [], context: undefined }
async function call(tools: ToolSet, name: string, input: unknown) {
  return tools[name]!.execute!(input, options)
}
function searchTools(result: unknown = fixture): ToolSet {
  return {
    KB_doc_query: tool({
      inputSchema: z.object({ query: z.string() }),
      execute: async () => result,
    }),
  }
}

describe('course image selection', () => {
  it('preserves exact figure page instead of the chunk starting page', () => {
    expect(candidate.physical_page_number).toBe(2)
    expect(
      courseImageCandidates({
        content: [{ type: 'text', text: JSON.stringify(fixture) }],
      })
    ).toEqual([candidate])
  })
  it('rejects failed, unbound and out-of-range evidence', () => {
    expect(
      courseImageCandidates({
        isError: true,
        content: [{ type: 'text', text: JSON.stringify(fixture) }],
      })
    ).toEqual([])
    const broken = structuredClone(fixture)
    broken.sources[0].chunks[0].page_end = 1
    expect(courseImageCandidates(broken)).toEqual([])
    broken.sources[0].chunks[0].page_end = 2
    delete broken.sources[0].chunks[0].visual_assets.manifest_sha256
    expect(courseImageCandidates(broken)).toEqual([])
  })
  it('requires current-turn evidence and allowed KB before opening storage', async () => {
    const read = vi.fn().mockResolvedValue(Buffer.from('png'))
    const tools = withCourseImageTool(searchTools(), [candidate.kb_id], read)
    expect(
      await call(tools, 'show_course_image', { asset_id: candidate.asset_id })
    ).toEqual({ status: 'unavailable' })
    await call(tools, 'KB_doc_query', { query: 'diagram' })
    expect(
      await call(tools, 'show_course_image', { asset_id: candidate.asset_id })
    ).toEqual({ status: 'selected', image: candidate })
    expect(read).toHaveBeenCalledTimes(1)
    const other = withCourseImageTool(searchTools(), [], read)
    await call(other, 'KB_doc_query', { query: 'diagram' })
    expect(
      await call(other, 'show_course_image', { asset_id: candidate.asset_id })
    ).toEqual({ status: 'unavailable' })
    expect(read).toHaveBeenCalledTimes(1)
  })
  it('reports missing images without exposing filesystem errors', async () => {
    const tools = withCourseImageTool(
      searchTools(),
      [candidate.kb_id],
      async () => {
        throw new Error('/private/secret')
      }
    )
    await call(tools, 'KB_doc_query', { query: 'diagram' })
    expect(
      await call(tools, 'show_course_image', { asset_id: candidate.asset_id })
    ).toEqual({ status: 'unavailable' })
  })
  it('renders only selected results, including persisted JSON round trips', () => {
    const parts = [
      {
        type: 'tool-call',
        toolName: 'show_course_image',
        result: { status: 'selected', image: candidate },
      },
    ]
    expect(selectedCourseImages(JSON.parse(JSON.stringify(parts)))).toEqual([
      candidate,
    ])
    expect(selectedCourseImages([{ ...parts[0]!, isError: true }])).toEqual([])
    expect(
      selectedCourseImages([
        { type: 'tool-call', toolName: 'KB_doc_query', result: fixture },
      ])
    ).toEqual([])
  })
  it('resolves the actual PNG and rejects mismatched occurrence or manifest', async () => {
    const bytes = await readCourseImage(candidate, root)
    expect(bytes.subarray(1, 4).toString()).toBe('PNG')
    await expect(
      readCourseImage({ ...candidate, physical_page_number: 1 }, root)
    ).rejects.toThrow('occurrence')
    await expect(
      readCourseImage(
        { ...candidate, source_content_hash: 'a'.repeat(64) },
        root
      )
    ).rejects.toThrow('manifest')
    await expect(
      readCourseImage({ ...candidate, image_sha256: '../secret' }, root)
    ).rejects.toThrow()
  })
})

it('bounds concurrent image selections to three', async () => {
  const data = structuredClone(fixture)
  const asset = data.sources[0].chunks[0].visual_assets.assets[0]
  data.sources[0].chunks[0].visual_assets.assets = ['a', 'b', 'c', 'd'].map(
    (letter) => ({ ...asset, asset_id: letter.repeat(64) })
  )
  const read = vi.fn(async () => {
    await new Promise((resolve) => setTimeout(resolve, 1))
  })
  const tools = withCourseImageTool(searchTools(data), [candidate.kb_id], read)
  await call(tools, 'KB_doc_query', { query: 'diagram' })
  const results = await Promise.all(
    ['a', 'b', 'c', 'd'].map((letter) =>
      call(tools, 'show_course_image', { asset_id: letter.repeat(64) })
    )
  )
  expect(results.filter((result) => result.status === 'selected')).toHaveLength(
    3
  )
  expect(read).toHaveBeenCalledTimes(3)
})
