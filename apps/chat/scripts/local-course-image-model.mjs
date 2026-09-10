/** Loopback-only deterministic demo provider. No LLM and no external network. */

import { randomUUID } from 'node:crypto'
import { createServer } from 'node:http'

export function startCourseImageDemoModel() {
  const server = createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/v1/chat/completions') {
      res.writeHead(404).end()
      return
    }
    try {
      let body = ''
      for await (const chunk of req) {
        body += chunk
        if (body.length > 2_000_000) throw new Error('Request too large')
      }
      const input = JSON.parse(body)
      const messages = input.messages ?? []
      const lastUser = messages.findLastIndex(
        (message) => message.role === 'user'
      )
      const question = JSON.stringify(messages[lastUser]?.content ?? '')
      const turn = messages.slice(lastUser + 1)
      const names = (input.tools ?? []).map((item) => item.function?.name)
      const queryTool = names.find((name) => name?.endsWith('doc_query'))
      const calls = turn.flatMap((message) => message.tool_calls ?? [])
      const hasQuery = calls.some((call) => call.function.name === queryTool)
      const hasImage = calls.some(
        (call) => call.function.name === 'show_course_image'
      )
      let toolCall
      let text =
        'Scripted image demo — no language model is running. Ask to show an image by topic or physical PDF page.'
      if (
        /(show|display|zeige|zeig|anzeigen)/i.test(question) &&
        /(diagram|image|figure|bild|abbildung)/i.test(question)
      ) {
        if (!hasQuery && queryTool) {
          toolCall = {
            name: queryTool,
            arguments: JSON.stringify({
              query:
                typeof messages[lastUser]?.content === 'string'
                  ? messages[lastUser].content.slice(0, 500)
                  : question.slice(0, 500),
            }),
          }
        } else if (!hasImage && names.includes('show_course_image')) {
          const result = turn
            .filter((message) => message.role === 'tool')
            .map((message) => JSON.stringify(message.content))
            .join('\n')
          const id = result.match(/asset_id[^a-f0-9]+([a-f0-9]{64})/)
          if (id)
            toolCall = {
              name: 'show_course_image',
              arguments: JSON.stringify({ asset_id: id[1] }),
            }
          else
            text =
              'Scripted image demo: no image reference was returned by the course search.'
        } else {
          const selected = turn.some(
            (message) =>
              message.role === 'tool' &&
              JSON.stringify(message.content).includes('selected')
          )
          text = selected
            ? 'Scripted image demo — no language model was called. Here is an original image returned by the course search. Its caption identifies the document and physical PDF page. [1]'
            : 'Scripted image demo: the image is unavailable. No image has been generated.'
        }
      }
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
      })
      const id = `chatcmpl-${randomUUID()}`
      const send = (delta, finish_reason = null) =>
        res.write(
          `data: ${JSON.stringify({ id, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: input.model, choices: [{ index: 0, delta, finish_reason }] })}\n\n`
        )
      send({ role: 'assistant' })
      if (toolCall) {
        send({
          tool_calls: [
            {
              index: 0,
              id: `call_${randomUUID().replaceAll('-', '')}`,
              type: 'function',
              function: toolCall,
            },
          ],
        })
        send({}, 'tool_calls')
      } else {
        send({ content: text })
        send({}, 'stop')
      }
      res.end('data: [DONE]\n\n')
    } catch {
      res.writeHead(400).end()
    }
  })
  server.listen(1419, '127.0.0.1')
}
