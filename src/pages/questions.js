import Link from 'next/link'
import React from 'react'
import { Grid } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

import App from '../components/App'
import Navbar from '../components/common/navbar/Navbar'
import QuestionList from '../components/QuestionList'
import withData from '../lib/withData'
import pageWithIntl from '../lib/pageWithIntl'

export default withData(
  pageWithIntl(() =>
    (<App>
      <Navbar accountShort="AW" title="Sessionübersicht" />
      <Grid.Row columns="2">
        <Grid.Column>
          All questions in our database:
          <QuestionList />
          <Link href="/">
            <a>
              Back to main <FormattedMessage id="title" defaultMessage="hehehe" />
            </a>
          </Link>
        </Grid.Column>
        <Grid.Column>this is column 2</Grid.Column>
      </Grid.Row>
    </App>),
  ),
)
