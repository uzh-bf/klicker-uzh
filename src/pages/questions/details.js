import React from 'react'
import { compose } from 'recompose'
import { intlShape } from 'react-intl'

import { TeacherLayout } from '../../components/layouts'
import { QuestionEditForm } from '../../components/forms'
import { pageWithIntl, withData } from '../../lib'

const propTypes = {
  intl: intlShape.isRequired,
}

const EditQuestion = ({ intl }) => (
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

export default compose(withData, pageWithIntl)(EditQuestion)
