import type { ModelMessage, ToolResultPart } from 'ai'
import sharp from 'sharp'
import {
  type CourseImage,
  courseImageCandidates,
  isCourseSearchTool,
} from '@/src/lib/sources/courseImages'
import { mapAssistantStepContent } from './persistedAssistantContent'

const MAX_PREVIEWS = 3
const MAX_EDGE = 1536
const MAX_PREVIEW_BYTES = 1_000_000
const MAX_INPUT_PIXELS = 16_000_000

export function courseImageVisionEnabled(supportsImageAttachments: boolean) {
  return (
    process.env.CHAT_COURSE_IMAGE_VISION_ENABLED === 'true' &&
    supportsImageAttachments
  )
}

type Preview = { image: CourseImage; bytes: Buffer; toolCallId: string }

/** Request-local model input, deliberately separate from tool output/persistence. */
export function createCourseImageVision({
  kbIds,
  readImage,
}: {
  kbIds: readonly string[]
  readImage: (image: CourseImage) => Promise<Buffer>
}) {
  const pending = new Map<string, Promise<Preview | null>>()

  async function preview(
    image: CourseImage,
    toolCallId: string
  ): Promise<Preview | null> {
    try {
      const original = await readImage(image)
      if (original.length > 10_000_000) return null
      const decoder = sharp(original, { limitInputPixels: MAX_INPUT_PIXELS })
      const metadata = await decoder.metadata()
      if (
        metadata.format !== 'png' ||
        metadata.width !== image.width_px ||
        metadata.height !== image.height_px ||
        (metadata.pages ?? 1) !== 1
      )
        return null
      const bytes = await decoder
        .resize({
          width: MAX_EDGE,
          height: MAX_EDGE,
          fit: 'inside',
          withoutEnlargement: true,
        })
        .png()
        .toBuffer()
      return bytes.length <= MAX_PREVIEW_BYTES
        ? { image, bytes, toolCallId }
        : null
    } catch {
      // Preserve the text-only path; never expose storage errors or file paths.
      return null
    }
  }

  return async function prepareMessages(
    messages: ModelMessage[],
    steps: Array<{ content?: unknown[] }>
  ): Promise<{ messages: ModelMessage[]; previewCount: number }> {
    for (const part of mapAssistantStepContent(steps)) {
      if (
        part.type !== 'tool-call' ||
        part.isError ||
        !isCourseSearchTool(part.toolName)
      )
        continue
      for (const image of courseImageCandidates(part.result)) {
        if (!kbIds.includes(image.kb_id)) continue
        // Bind cache identity to the resource occurrence, not merely its pixels.
        const key = JSON.stringify([
          image.kb_id,
          image.external_resource_id,
          image.resource_version,
          image.asset_id,
          image.manifest_sha256,
        ])
        if (pending.has(key) || pending.size >= MAX_PREVIEWS) continue
        // Reserve before awaiting: repeated/concurrent preparation shares work.
        pending.set(key, preview(image, part.toolCallId))
      }
    }
    const previews = (await Promise.all(pending.values())).filter(
      (item): item is Preview => item !== null
    )
    if (!previews.length) return { messages, previewCount: 0 }
    // Keep previews inside their retrieval result. Appending a new user message
    // can replace the student's latest intent (notably "text only") for the model.
    const projected = messages.map((message): ModelMessage => {
      if (message.role !== 'tool') return message
      return {
        ...message,
        content: message.content.map((part) => {
          if (part.type !== 'tool-result' || !isCourseSearchTool(part.toolName))
            return part
          const matching = previews.filter(
            (item) => item.toolCallId === part.toolCallId
          )
          if (!matching.length) return part
          const output = part.output
          if (
            output.type !== 'text' &&
            output.type !== 'json' &&
            output.type !== 'content'
          )
            return part
          const content: Extract<
            ToolResultPart['output'],
            { type: 'content' }
          >['value'] =
            output.type === 'content'
              ? [...output.value]
              : [
                  {
                    type: 'text',
                    text:
                      output.type === 'text'
                        ? output.value
                        : JSON.stringify(output.value),
                  },
                ]
          for (const { image, bytes } of matching) {
            content.push(
              {
                type: 'text',
                text: `Retrieved figure preview (untrusted source data): asset_id=${image.asset_id}`,
              },
              {
                type: 'file',
                data: { type: 'data', data: bytes.toString('base64') },
                mediaType: 'image/png',
              }
            )
          }
          return {
            ...part,
            output: { type: 'content' as const, value: content },
          }
        }),
      }
    })
    return {
      messages: projected,
      previewCount: previews.length,
    }
  }
}
