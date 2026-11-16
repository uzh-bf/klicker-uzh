import { describe, expect, it } from 'vitest'
import { CHAT_TRANSCRIPT_VIEWER_HTML as html } from '../src/lib/chatTranscriptViewer.js'

describe('chat transcript viewer page', () => {
  it('makes no external requests', () => {
    expect(html).not.toMatch(/<script[^>]*\ssrc\s*=/i)
    expect(html).not.toMatch(/<link\b/i)
    expect(html).not.toMatch(/<img\b/i)
    expect(html).not.toMatch(/<iframe\b/i)
    expect(html).not.toMatch(/\b(?:src|href)\s*=\s*["']?\s*(?:https?:)?\/\//i)
    expect(html).not.toMatch(/@import|url\(/i)
    expect(html).not.toMatch(/\b(fetch|XMLHttpRequest|WebSocket|innerHTML)\b/)
  })

  it('has a script that parses', () => {
    const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1]
    expect(script).toBeTruthy()
    expect(() => new Function(script as string)).not.toThrow()
  })

  describe('rendering', () => {
    // Tiny DOM stand-in: enough to run the page script and inspect the tree.
    class FakeNode {
      children: FakeNode[] = []
      className = ''
      listeners: Record<string, (event: unknown) => void> = {}
      private text = ''
      constructor(
        public tag: string,
        public isText = false
      ) {}
      appendChild(child: FakeNode) {
        this.children.push(child)
        return child
      }
      addEventListener(name: string, fn: (event: unknown) => void) {
        this.listeners[name] = fn
      }
      set textContent(value: string) {
        this.children = []
        this.text = value
      }
      get textContent(): string {
        return this.text + this.children.map((c) => c.textContent).join('')
      }
      all(): FakeNode[] {
        return [this, ...this.children.flatMap((c) => c.all())]
      }
    }

    async function openFile(content: string) {
      const nodes: Record<string, FakeNode> = {
        out: new FakeNode('div'),
        status: new FakeNode('p'),
        file: new FakeNode('input'),
      }
      const document = {
        getElementById: (id: string) => nodes[id],
        createElement: (tag: string) => new FakeNode(tag),
        createTextNode: (text: string) => {
          const node = new FakeNode('#text', true)
          node.textContent = text
          return node
        },
      }
      const script = html.match(/<script>([\s\S]*)<\/script>/)?.[1] as string
      new Function('document', script)(document)
      nodes.file.listeners.change({
        target: { files: [{ text: async () => content }] },
      })
      await new Promise((resolve) => setTimeout(resolve, 0))
      return nodes
    }

    const transcript = (text: string, version = 1) =>
      JSON.stringify({
        formatVersion: version,
        chatbot: { name: 'Bot' },
        course: { name: 'Course' },
        student: { identity: { givenName: 'Ada' } },
        threads: [
          {
            title: null,
            createdAt: 't',
            hasBranches: false,
            messages: [
              {
                role: 'user',
                createdAt: 't',
                branch: '1',
                status: 'complete',
                text: '<b>raw</b>',
              },
              {
                role: 'assistant',
                createdAt: 't',
                branch: '1',
                status: 'failed',
                text,
              },
            ],
          },
        ],
      })

    it('shows markup, links and images as text only', async () => {
      const { out } = await openFile(
        transcript(
          '# Title\n**bold** `code` <img src=x onerror=alert(1)> [link](http://example.org/a) ![pic](http://example.org/p.png)\n- one\n```\n<script>x</script>\n```'
        )
      )
      const tags = out.all().map((n) => n.tag)
      expect(tags).not.toContain('img')
      expect(tags).not.toContain('a')
      expect(tags).not.toContain('script')
      expect(tags).toEqual(
        expect.arrayContaining(['h3', 'strong', 'code', 'li', 'pre'])
      )
      expect(out.textContent).toContain('<img src=x onerror=alert(1)>')
      expect(out.textContent).toContain('link (http://example.org/a)')
      expect(out.textContent).toContain('[image: pic]')
      expect(out.textContent).toContain('<b>raw</b>')
      expect(out.textContent).toContain('failed')
    })

    it('rejects other format versions', async () => {
      const { out, status } = await openFile(transcript('x', 2))
      expect(out.textContent).toBe('')
      expect(status.textContent).toMatch(/Unsupported format version/)
    })
  })
})
