import React from 'react'
import Link from 'next/link'
import App from '../components/App'

export default () => (
  <App>
    Welcome to the new Klicker!
    <Link prefetch href="/questions">
      <a>List of questions</a>
    </Link>
  </App>
)
