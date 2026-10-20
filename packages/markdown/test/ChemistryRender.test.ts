import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Markdown from '../src/Markdown.js'

function renderMarkdown(content: string): string {
  return renderToStaticMarkup(React.createElement(Markdown, { content }))
}

describe('Markdown chemistry rendering', () => {
  it.each([
    ['ce', String.raw`$$\ce{H2O}$$`],
    ['pu', String.raw`$$\pu{1.0 bar}$$`],
    ['reaction', '$$\n\\ce{2 H2 + O2 -> 2 H2O}\n$$'],
    ['ordinary math', String.raw`$$x^2 + 1$$`],
  ])('renders %s as KaTeX HTML and MathML', (_, content) => {
    const html = renderMarkdown(content)

    expect(html).toContain('class="katex"')
    expect(html).toContain('<math')
    expect(html).toContain('annotation encoding="application/x-tex"')
    expect(html).not.toContain('katex-error')
    expect(html).not.toContain('mathcolor="#cc0000"')
  })

  it('bounds unbalanced chemistry with a KaTeX error marker', () => {
    const html = renderMarkdown(String.raw`$$\ce{H2O$$`)

    expect(html.length).toBeLessThan(1024)
    expect(html).toContain('katex-error')
    expect(html).not.toContain('<math')
  })

  it('keeps ordinary currency as prose', () => {
    const html = renderMarkdown('The price is $5 today')

    expect(html).not.toContain('class="katex"')
    expect(html).not.toContain('<math')
  })

  it('keeps KaTeX trust disabled', () => {
    const html = renderMarkdown(
      String.raw`$$\href{https://example.com}{link}$$`
    )

    expect(html).toContain('class="katex"')
    expect(html).not.toContain('<a href=')
    expect(html).not.toContain('href="https://example.com"')
  })

  it('sanitizes raw HTML before rendering', () => {
    const html = renderMarkdown('<script>alert(1)</script>')

    expect(html).not.toContain('<script')
    expect(html).not.toContain('alert(1)')
  })
})
