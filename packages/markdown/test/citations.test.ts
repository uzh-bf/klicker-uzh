import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Markdown from '../src/Markdown.js'

describe('citation rendering', () => {
  it('renders numbered markers as citation anchors', () => {
    const rendered = renderToStaticMarkup(
      React.createElement(Markdown, {
        content:
          'Grounded answer [1]. Code `[2]`, math $$x[3]$$, and [link [4]](https://example.test/[5]).',
        withLinkButtons: false,
      })
    )

    expect(rendered).toContain('<a href="#response-example-citation-1">1</a>')
    expect(rendered).toContain('<code>[2]</code>')
    expect(rendered).toContain('<annotation encoding="application/x-tex">x[3]')
    expect(rendered).toContain('https://example.test/%5B5%5D')
    expect(rendered).toContain('link [4]')
    expect(rendered).not.toContain('response-example-citation-2')
    expect(rendered).not.toContain('response-example-citation-3')
    expect(rendered).not.toContain('response-example-citation-4')
    expect(rendered).not.toContain('response-example-citation-5')
  })
})
