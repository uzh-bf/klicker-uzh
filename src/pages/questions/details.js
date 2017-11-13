import React from 'react'
import { compose, branch, renderComponent } from 'recompose'
import { intlShape } from 'react-intl'
import { graphql } from 'react-apollo'
import { PropTypes } from 'prop-types'

import { TeacherLayout } from '../../components/layouts'
import { QuestionEditForm } from '../../components/forms'
import { pageWithIntl, withData } from '../../lib'
import { QuestionDetailsQuery } from '../../graphql/queries'

const propTypes = {
  intl: intlShape.isRequired,
  questionDetails: PropTypes.shape({}).isRequired,
}

const EditQuestion = ({ intl, data }) => {
  console.dir(data)

  const question = data.questions[0]

  const tagsArray = question.tags.map(tag => tag.name)
  // eslint-disable-next-line no-unused-expressions
  // question && question.tags.forEach(tag => tagsArray.push(tag.name))

  console.dir(question)

  return (
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
        title={question && question.title}
        tags={question && tagsArray}
        type={question && question.type}
        versions={question && question.versions}
      />
    </TeacherLayout>
  )
}

EditQuestion.propTypes = propTypes

export default compose(
  withData,
  pageWithIntl,
  graphql(QuestionDetailsQuery),
  branch(props => props.data.loading, renderComponent(() => <div />)),
  /*
  withProps(({ questionDetails }) => ({
    questionDetail: questionDetails.questions[0],
  })),
  */
)(EditQuestion)
