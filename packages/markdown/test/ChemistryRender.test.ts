import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import Markdown from '../src/Markdown.js'

function renderMarkdown(content: string): string {
  return renderToStaticMarkup(React.createElement(Markdown, { content }))
}

describe('Markdown chemistry rendering', () => {
  it.each([
    ['charge', String.raw`$$\ce{SO4^2-}$$`],
    ['isotope', String.raw`$$\ce{^{227}_{90}Th+}$$`],
    ['state of matter', String.raw`$$\ce{2 H2(g) + O2(g) -> 2 H2O(l)}$$`],
    ['single bond', String.raw`$$\ce{C-C}$$`],
    ['double bond', String.raw`$$\ce{C=C}$$`],
    ['triple bond', String.raw`$$\ce{C#C}$$`],
    ['equilibrium arrow', String.raw`$$\ce{A <=> B}$$`],
    [
      'arrow with condition above',
      String.raw`$$\ce{N2 + 3 H2 ->[\text{Fe}] 2 NH3}$$`,
    ],
    ['precipitate and gas markers', String.raw`$$\ce{AgCl v + CO2 ^}$$`],
    ['stoichiometric fraction', String.raw`$$\ce{1/2 H2O}$$`],
    ['hydrate', String.raw`$$\ce{CuSO4.5H2O}$$`],
    ['complex ion', String.raw`$$\ce{K4[Fe(CN)6]}$$`],
    ['redox half reaction', String.raw`$$\ce{Zn^2+ + 2 e- -> Zn}$$`],
    [
      'nuclear decay',
      String.raw`$$\ce{^{238}_{92}U -> ^{234}_{90}Th + ^{4}_{2}He}$$`,
    ],
    ['math and unit together', String.raw`$$M(\ce{H2O}) = 18.02 \pu{g/mol}$$`],
    ['unit with exponent', String.raw`$$\pu{6.022e23 mol-1}$$`],
    ['unit with degree', String.raw`$$\pu{25 °C}$$`],
  ])('renders the %s notation family', (_, content) => {
    const html = renderMarkdown(content)

    expect(html).toContain('class="katex"')
    expect(html).toContain('<math')
    expect(html).not.toContain('katex-error')
    // An unrecognized command renders as KaTeX's red fallback text instead of
    // throwing, so a successful render must also be free of that marker.
    expect(html).not.toContain('mathcolor="#cc0000"')
  })

  it.each([
    ['double-dollar', String.raw`$$\ce{H2O}$$`],
    ['display block', '$$\n\\ce{H2O}\n$$'],
  ])('renders chemistry inside %s delimiters', (_, content) => {
    expect(renderMarkdown(content)).toContain('class="katex"')
  })

  it.each([
    ['unicode prime', '$$\\ce{5\u2032-ATCG-3\u2032}$$'],
    ['prime command', String.raw`$$\ce{5^{\prime}-ATCG-3^{\prime}}$$`],
  ])('renders a DNA strand with %s ends', (_, content) => {
    const html = renderMarkdown(content)

    expect(html).toContain('class="katex"')
    expect(html).not.toContain('katex-error')
  })

  it('rejects a DNA strand written with a bare apostrophe prime', () => {
    // mhchem's prime parser consumes the following brace, so the raw
    // apostrophe form fails to parse; the supported forms are the unicode
    // prime and the explicit command above.
    const html = renderMarkdown(String.raw`$$\ce{5\'-ATCG-3\'}$$`)

    expect(html).toContain('katex-error')
  })

  it.each([
    ['bare command', String.raw`\ce{H2O}`],
    ['single-dollar', String.raw`$\ce{H2O}$`],
    ['parenthesis', String.raw`\(\ce{H2O}\)`],
    ['bracket', String.raw`\[\ce{H2O}\]`],
  ])('leaves %s delimiters as prose', (_, content) => {
    const html = renderMarkdown(content)

    expect(html).not.toContain('class="katex"')
    expect(html).not.toContain('<math')
  })

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
