import React from 'react'
import Link from 'next/link'
import withData from '../lib/withData'
import App from '../components/App'
import QuestionList from '../components/QuestionList'

export default withData(() =>
  (<App>
    All questions in our database:
    <QuestionList />
    <Link href="/">
      <a>Back to main</a>
    </Link>
  </App>),
)
