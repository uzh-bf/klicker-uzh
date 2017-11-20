import React from 'react'
import { compose, branch, renderComponent, withProps } from 'recompose'
import { intlShape } from 'react-intl'
import { graphql } from 'react-apollo'
import { PropTypes } from 'prop-types'
import _pick from 'lodash/pick'

import { TeacherLayout } from '../../components/layouts'
import { QuestionEditForm } from '../../components/forms'
import { pageWithIntl, withData } from '../../lib'
import { QuestionDetailsQuery } from '../../graphql/queries'

const propTypes = {
  intl: intlShape.isRequired,
  tags: PropTypes.arrayOf().isRequired,
  title: PropTypes.string.isRequired,
  type: PropTypes.string.isRequired,
  versions: PropTypes.arrayOf().isRequired,
}

const EditQuestion = ({
  intl, tags, title, type, versions,
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
    <QuestionEditForm
      intl={intl}
      tags={tags.map(tag => tag.name)}
      title={title}
      type={type}
      versions={versions}
    />
  </TeacherLayout>
)

EditQuestion.propTypes = propTypes

export default compose(
  withData,
  pageWithIntl,
  graphql(QuestionDetailsQuery, {
    options: ({ url }) => ({ variables: { id: url.query.questionId } }),
  }),
  branch(({ data }) => data.loading || !data.question, renderComponent(() => <div />)),
  withProps(({ data }) => ({
    ..._pick(data.question, ['title', 'type', 'tags', 'versions']),
  })),
)(EditQuestion)
