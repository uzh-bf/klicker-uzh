import React from 'react'
import PropTypes from 'prop-types'
import Router from 'next/router'
import { compose, withHandlers, withProps } from 'recompose'
import { graphql } from 'react-apollo'
import { intlShape } from 'react-intl'

import { TeacherLayout } from '../../components/layouts'
import { QuestionCreationForm } from '../../components/forms'
import { pageWithIntl, withData, withDnD, withLogging } from '../../lib'
import { QuestionListQuery, TagListQuery, CreateQuestionMutation } from '../../graphql'

const propTypes = {
  handleDiscard: PropTypes.func.isRequired,
  handleSave: PropTypes.func.isRequired,
  intl: intlShape.isRequired,
  tags: PropTypes.array.isRequired,
}

const CreateQuestion = ({
  tags, intl, handleDiscard, handleSave,
}) => (
  <TeacherLayout
    intl={intl}
    navbar={{
      title: intl.formatMessage({
        defaultMessage: 'Create Question',
        id: 'createQuestion.title',
      }),
    }}
    pageTitle={intl.formatMessage({
      defaultMessage: 'Create Question',
      id: 'createQuestion.pageTitle',
    })}
    sidebar={{ activeItem: 'createQuestion' }}
  >
    <QuestionCreationForm intl={intl} tags={tags} onDiscard={handleDiscard} onSubmit={handleSave} />
  </TeacherLayout>
)

CreateQuestion.propTypes = propTypes

export default compose(
  withLogging(),
  withDnD,
  withData,
  pageWithIntl,
  graphql(TagListQuery),
  graphql(CreateQuestionMutation),
  withHandlers({
    // handle discarding a new question
    handleDiscard: () => () => {
      Router.push('/questions')
    },

    // handle saving a new question
    handleSave: ({ mutate }) => async ({
      content, options, tags, title, type,
    }) => {
      try {
        await mutate({
          // reload the list of questions and tags after creation
          // TODO: replace with optimistic updates
          refetchQueries: [{ query: QuestionListQuery }, { query: TagListQuery }],
          variables: {
            description: content,
            options,
            tags,
            title,
            type,
          },
        })

        // redirect to the question pool
        Router.push('/questions')
      } catch ({ message }) {
        console.error(message)
      }
    },
  }),
  withProps(({ data }) => ({
    tags: data.tags,
  })),
)(CreateQuestion)
