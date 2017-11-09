import React from 'react'
import { compose } from 'recompose'
import { intlShape } from 'react-intl'
import { graphql } from 'react-apollo'
import { PropTypes } from 'prop-types'

import { TeacherLayout } from '../../components/layouts'
import { QuestionEditForm } from '../../components/forms'
import { pageWithIntl, withData } from '../../lib'
import { QuestionDetailsQuery } from '../../graphql/queries'

const propTypes = {
  intl: intlShape.isRequired,
  questionDetail: PropTypes.shape({}).isRequired,
}

const EditQuestion = ({ intl, questionDetail }) => (
  <TeacherLayout
    intl={intl}
    navbar={{
      title: intl.formatMessage({
        defaultMessage: 'Edit Question',
        id: 'teacher.editQuestion.title',
      }),
    }}
    pageTitle={intl.formatMessage({
      defaultMessage: 'Edit Question',
      id: 'teacher.editQuestion.pageTitle',
    })}
    sidebar={{ activeItem: 'editQuestion' }}
  >
    {console.dir(questionDetail)}
    <QuestionEditForm
      intl={intl}
      content={
        'Dies ist die lange Ausführung der Frage. Annahme du bist klein, wie möchtest du das mit deiner Grösse schaffen?'
      }
      options={{
        choices: [
          { correct: false, name: 'Hello' },
          { correct: true, name: 'You are small' },
          { correct: false, name: 'You are big' },
        ],
        randomized: false,
        restrictions: {
          type: 'NONE',
        },
      }}
      title={'Was ist das denn für eine Frage?'}
      tags={['Hallo Tag', 'CAPM', 'Internet']}
      type={'SC'}
      versions={[1, 2, 3, 4, 5]}
    />
  </TeacherLayout>
)

EditQuestion.propTypes = propTypes

export default compose(
  withData,
  pageWithIntl,
  graphql(QuestionDetailsQuery, { name: 'questionDetails' }),
  /*
  branch(
    ({ questionDetails }) => questionDetails.loading, renderComponent(() =>
      <div>No data TODO</div>),
  ),
  withProps(({ questionDetails }) => ({
    questionDetail: questionDetails.questions[0],
  })),
  */
)(EditQuestion)
