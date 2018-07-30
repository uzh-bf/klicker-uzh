import { ContentState } from 'draft-js'
import { toSanitizedHTML } from './html'

describe('toSanitizedHTML', () => {
  it('works', () => {
    // initialize a content state
    const contentState = ContentState.createFromText(
      '<script src="bla" /><br /><strong>Hello World</strong><br /><img src="blu" /><link rel="bla" />'
    )

    // use sanitizing function
    const sanitized = toSanitizedHTML(contentState)

    expect(sanitized).toMatchSnapshot()
  })
})
