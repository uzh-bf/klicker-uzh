import { describe, expect, it } from 'vitest'
import { markdownToPlainText } from '../src/plainText.js'

describe('markdownToPlainText', () => {
  it('projects headings and emphasis while keeping inline adjacency', () => {
    expect(
      markdownToPlainText(
        '# Heading\n\nSome **bold** and word**part**end text.'
      )
    ).toBe('Heading Some bold and wordpartend text.')
  })

  it('keeps link labels but omits destinations', () => {
    expect(
      markdownToPlainText('[KlickerUZH](https://klicker.uzh.ch) is a tool.')
    ).toBe('KlickerUZH is a tool.')
  })

  it('keeps image alt text but omits sources', () => {
    expect(markdownToPlainText('![Diagram](https://example.com/a.png)')).toBe(
      'Diagram'
    )
  })

  it('projects video and embed links as their visible labels', () => {
    expect(
      markdownToPlainText(
        '[video](https://www.youtube.com/watch?v=dQw4w9WgXcQ) and [embed](https://uzh.mediaspace.cast.switch.ch/media/x/0_abc123/123)'
      )
    ).toBe('video and embed')
  })

  it('decodes named and numeric character references', () => {
    expect(
      markdownToPlainText('A &amp; B &lt;tag&gt; &#39;quote&#39; &quot;x&quot;')
    ).toBe('A & B <tag> \'quote\' "x"')
  })

  it('keeps inline and fenced code values', () => {
    expect(
      markdownToPlainText('Use `const x = 1` now.\n\n```ts\nconst y = 2\n```')
    ).toBe('Use const x = 1 now. const y = 2')
  })

  it('keeps inline and display math values', () => {
    expect(
      markdownToPlainText('Inline $E(R_i)$ and display $$E(R_i) = R_f$$ math.')
    ).toBe('Inline E(R_i) and display E(R_i) = R_f math.')
  })

  it('omits raw HTML controls while retaining readable inline text', () => {
    expect(
      markdownToPlainText('Before <span class="x">inside</span> after.')
    ).toBe('Before inside after.')
  })

  it('omits raw active-content blocks', () => {
    expect(
      markdownToPlainText(
        'Before\n\n<script>alert("not visible")</script>\n\nAfter'
      )
    ).toBe('Before After')
  })

  it('projects lists, line breaks, and collapses whitespace', () => {
    expect(
      markdownToPlainText(
        '- one\n- two\n\n1. first\n2. second\n\nLine one  \nLine two'
      )
    ).toBe('one two first second Line one Line two')
  })

  it('returns empty string for empty input', () => {
    expect(markdownToPlainText('')).toBe('')
    expect(markdownToPlainText('   \n\n  ')).toBe('')
  })
})
