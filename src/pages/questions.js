import Link from 'next/link'
import React from 'react'

import App from '../components/App'
import QuestionList from '../components/QuestionList'
import withData from '../lib/withData'

export default withData(() =>
  (<App>
    All questions in our database:
    <QuestionList />
    <Link href="/">
      <a>Back to main</a>
    </Link>
  </App>),
)
