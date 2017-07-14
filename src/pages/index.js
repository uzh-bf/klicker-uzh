import Link from 'next/link'
import React from 'react'
import { Grid } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

import App from '../components/App'
import Navbar from '../components/common/navbar/Navbar'
import pageWithIntl from '../lib/pageWithIntl'

export default pageWithIntl(() =>
  (<App>
    <Navbar search accountShort="AW" title="Fragenpool" />
    <Grid.Row columns="2">
      <Grid.Column>
        Welcome to the new Klicker!
        <Link prefetch href="/questions">
          <a>
            <FormattedMessage id="title" defaultMessage="tschege tschege" />
          </a>
        </Link>
      </Grid.Column>
      <Grid.Column>this is column 2</Grid.Column>
    </Grid.Row>
  </App>),
)
