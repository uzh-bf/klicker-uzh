import Link from 'next/link'
import React from 'react'
import { Grid } from 'semantic-ui-react'
import { FormattedMessage } from 'react-intl'

import QuestionList from '../components/QuestionList'
import TeacherLayout from '../components/layouts/TeacherLayout'
import pageWithIntl from '../lib/pageWithIntl'
import withData from '../lib/withData'

class Questions extends React.Component {
  state = {}

  render() {
    return (
      <TeacherLayout>
        <Grid padded columns="2">
          <Grid.Column>
            All questions in our database:
            <QuestionList />
          </Grid.Column>
          <Grid.Column>
            <Link href="/">
              <a>
                Back to main <FormattedMessage id="title" defaultMessage="hehehe" />
              </a>
            </Link>
          </Grid.Column>
        </Grid>
      </TeacherLayout>
    )
  }
}

export default withData(pageWithIntl(Questions))
