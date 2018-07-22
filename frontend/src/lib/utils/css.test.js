import { createLinks } from './css'

describe('createLinks', () => {
  it('works with full urls', () => {
    expect(createLinks(['http://www.google.com'])).toMatchSnapshot()
  })
})
