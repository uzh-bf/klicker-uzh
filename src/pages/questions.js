import Link from 'next/link'
import React from 'react'
import { Grid } from 'semantic-ui-react'

import App from '../components/App'
import Navbar from '../components/common/navbar/Navbar'
import QuestionList from '../components/QuestionList'
import withData from '../lib/withData'

export default withData(() =>
  (<App>
    <Navbar accountShort="AW" title="Sessionübersicht" />
    <Grid.Row columns="2">
      <Grid.Column>
        All questions in our database:
        <QuestionList />
        <Link href="/">
          <a>Back to main</a>
        </Link>
      </Grid.Column>
      <Grid.Column>this is column 2</Grid.Column>
    </Grid.Row>
  </App>),
)
