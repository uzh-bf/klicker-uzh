import React from 'react'
import Router from 'next/router'
import { compose } from 'recompose'
import { Query, Mutation } from 'react-apollo'
import { defineMessages, intlShape } from 'react-intl'
import { convertToRaw } from 'draft-js'
import axios from 'axios'

import { TeacherLayout } from '../../components/layouts'
import { QuestionCreationForm } from '../../components/forms'
import { pageWithIntl, withDnD, withLogging } from '../../lib'
import {
  QuestionListQuery,
  TagListQuery,
  CreateQuestionMutation,
  RequestPresignedURLMutation,
} from '../../graphql'

const messages = defineMessages({
  pageTitle: {
    defaultMessage: 'Create Question',
    id: 'createQuestion.pageTitle',
  },
  title: {
    defaultMessage: 'Create Question',
    id: 'createQuestion.title',
  },
})

const propTypes = {
  intl: intlShape.isRequired,
}

const CreateQuestion = ({ intl }) => (
  <TeacherLayout
    intl={intl}
    navbar={{
      title: intl.formatMessage(messages.title),
    }}
    pageTitle={intl.formatMessage(messages.pageTitle)}
    sidebar={{ activeItem: 'createQuestion' }}
  >
    <Query query={TagListQuery}>
      {({ data }) => (
        <Mutation mutation={CreateQuestionMutation}>
          {(createQuestion, { loading }) => (
            <Mutation mutation={RequestPresignedURLMutation}>
              {requestPresignedURL => (
                <QuestionCreationForm
                  intl={intl}
                  loading={loading}
                  tags={data.tags}
                  // handle discarding a new question
                  onDiscard={() => Router.push('/questions')}
                  // handle submitting a new question
                  onSubmit={async ({
                    content,
                    options,
                    tags,
                    title,
                    type,
                    files,
                  }) => {
                    // request presigned urls and filenames for all files
                    const fileEntities = await Promise.all(
                      files.map(async (file) => {
                        const result = await requestPresignedURL({
                          variables: {
                            fileType: file.type,
                          },
                        })
                        const {
                          fileName,
                          signedUrl,
                        } = result.data.requestPresignedURL
                        return { file, fileName, signedUrl }
                      }),
                    )

                    // upload (put) the files to the corresponding presigned urls
                    await Promise.all(
                      fileEntities.map(({ file, signedUrl }) => axios.put(signedUrl, file),
                      ),
                    )

                    // create the question
                    await createQuestion({
                      // reload the list of questions and tags after creation
                      // TODO: replace with optimistic updates
                      refetchQueries: [
                        { query: QuestionListQuery },
                        { query: TagListQuery },
                      ],
                      variables: {
                        content:
                          content.getCurrentContent()
                          |> convertToRaw
                          |> JSON.stringify,
                        files: fileEntities.map(({ file, fileName }) => ({
                          name: fileName,
                          originalName: file.name,
                          type: file.type,
                        })),
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
        </Mutation>
      )}
    </Query>
  </TeacherLayout>
)

CreateQuestion.propTypes = propTypes

export default compose(
  withLogging(),
  withDnD,
  pageWithIntl,
)(CreateQuestion)
