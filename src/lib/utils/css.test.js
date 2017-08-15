import React from 'react'

import { createLinks } from './css'

describe('createLinks', () => {
  it('works with full urls', () => {
    expect(createLinks(['http://www.google.com'])).toEqual([
      <link rel="stylesheet" href="http://www.google.com" />,
    ])
  })

  it('works with semantic components', () => {
    expect(createLinks(['dropdown', 'header', 'menu'])).toEqual([
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/2.2.11/components/dropdown.min.css"
      />,
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/2.2.11/components/header.min.css"
      />,
      <link
        rel="stylesheet"
        href="https://cdnjs.cloudflare.com/ajax/libs/semantic-ui/2.2.11/components/menu.min.css"
      />,
    ])
  })
})
