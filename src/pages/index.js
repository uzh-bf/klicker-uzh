import Link from 'next/link'
import React from 'react'
import { Grid } from 'semantic-ui-react'

import App from '../components/App'
import Navbar from '../components/common/Navbar'

export default () =>
  (<App>
    <Navbar search />
    <Grid.Row columns="2">
      <Grid.Column>
        Welcome to the new Klicker!
        <Link prefetch href="/questions">
          <a>List of questions</a>
        </Link>
      </Grid.Column>
      <Grid.Column>this is column 2</Grid.Column>
    </Grid.Row>
  </App>)
