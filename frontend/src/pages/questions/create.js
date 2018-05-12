import React from 'react'
import Router from 'next/router'
import { compose } from 'recompose'
import { Query, Mutation } from 'react-apollo'
import { intlShape } from 'react-intl'
import { convertToRaw } from 'draft-js'

import { TeacherLayout } from '../../components/layouts'
import { QuestionCreationForm } from '../../components/forms'
import { pageWithIntl, withDnD, withLogging } from '../../lib'
import { QuestionListQuery, TagListQuery, CreateQuestionMutation } from '../../graphql'

const propTypes = {
  intl: intlShape.isRequired,
}

const CreateQuestion = ({ intl }) => (
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
    <Query query={TagListQuery}>
      {({ data }) => (
        <Mutation mutation={CreateQuestionMutation}>
          {(createQuestion, { loading }) => (
            <QuestionCreationForm
              intl={intl}
              loading={loading}
              tags={data.tags}
              // handle discarding a new question
              onDiscard={() => Router.push('/questions')}
              // handle submitting a new question
              onSubmit={async ({
 content, options, tags, title, type,
}) => {
                // create the question
                await createQuestion({
                  // reload the list of questions and tags after creation
                  // TODO: replace with optimistic updates
                  refetchQueries: [{ query: QuestionListQuery }, { query: TagListQuery }],
                  variables: {
                    content: content.getCurrentContent() |> convertToRaw |> JSON.stringify,
                    options,
                    tags,
                    title,
                    type,
                  },
                })

                Router.push('/questions')
              }}
            />
          )}
        </Mutation>
      )}
    </Query>
  </TeacherLayout>
)

CreateQuestion.propTypes = propTypes

export default compose(withLogging(), withDnD, pageWithIntl)(CreateQuestion)
