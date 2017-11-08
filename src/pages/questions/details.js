import React from 'react'
import PropTypes from 'prop-types'
import { compose } from 'recompose'
import { intlShape } from 'react-intl'

import { TeacherLayout } from '../../components/layouts'
import { QuestionEditForm } from '../../components/forms'
import { pageWithIntl, withData } from '../../lib'

const propTypes = {
  handleDiscard: PropTypes.func.isRequired,
  handleSave: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  tags: PropTypes.array.isRequired,
}

const EditQuestion = ({
  tags, intl, handleDiscard, handleSave,
}) => (
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
    <QuestionEditForm intl={intl} tags={tags} onSubmit={handleSave} onDiscard={handleDiscard} />
  </TeacherLayout>
)

EditQuestion.propTypes = propTypes

export default compose(withData, pageWithIntl)(EditQuestion)
