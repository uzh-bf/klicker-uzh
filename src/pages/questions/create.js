import React from 'react'
import Router from 'next/router'
import { compose } from 'recompose'
import { Query, Mutation } from 'react-apollo'
import { intlShape } from 'react-intl'

import { TeacherLayout } from '../../components/layouts'
import { QuestionCreationForm } from '../../components/forms'
import { pageWithIntl, withData, withDnD, withLogging } from '../../lib'
import { QuestionPoolQuery, TagListQuery, CreateQuestionMutation } from '../../graphql'

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
              onDiscard={() => {
                // handle discarding a new question
                Router.push('/questions')
              }}
              onSubmit={async ({
 content, options, tags, title, type,
}) => {
                await createQuestion({
                  // reload the list of questions and tags after creation
                  // TODO: replace with optimistic updates
                  refetchQueries: [{ query: QuestionPoolQuery }],
                  variables: {
                    description: content,
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

export default compose(withLogging(), withDnD, withData, pageWithIntl)(CreateQuestion)
