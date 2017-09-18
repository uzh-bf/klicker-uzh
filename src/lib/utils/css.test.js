import { createLinks } from './css'

describe('createLinks', () => {
  it('works with full urls', () => {
    expect(createLinks(['http://www.google.com'])).toMatchSnapshot()
  })

  it('works with semantic components', () => {
    expect(createLinks(['dropdown', 'header', 'menu'])).toMatchSnapshot()
  })

  it('works with combinations of both', () => {
    expect(createLinks(['http://www.google.com', 'header'])).toMatchSnapshot()
  })
})
